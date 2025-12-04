import { Ollama } from "@langchain/ollama";
import fs from "fs/promises";
import path from "path";
import { GitHelper } from "./gitHelper.js";
import { LLMConfig, LLMProvider } from "./llm/llmProvider.js";
import { OpenAIProvider } from "./llm/openaiProvider.js";
import { GitMCPServer } from "./mcp/gitServer.js";
import { ProjectIndexer } from "./projectIndexer.js";
import { ConversationManager } from "./rag/conversationManager.js";
import { initializeEmbeddings } from "./rag/embeddingUtils.js";
import { RAGPipeline } from "./rag/ragPipeline.js";
import { CRMService } from "./support/crmService.js";
import { TasksService } from "./support/tasksService.js";
import {
  AnswerWithSources,
  ProjectConfig,
  ProjectContext,
  SearchResult,
} from "./types/index.js";

export class CodeAssistant {
  private config: ProjectConfig;
  private indexer: ProjectIndexer;
  private git: GitHelper;
  private rag: RAGPipeline;
  private conversationManager: ConversationManager | null = null;
  private projectContext: ProjectContext | null = null;
  private llm: Ollama | LLMProvider | null = null;
  private mcpServer: GitMCPServer | null = null;
  private crm: CRMService | null = null;
  private tasks: TasksService | null = null;
  private toolsUsedInCurrentAnswer: string[] = [];

  constructor(config: ProjectConfig) {
    this.config = config;
    this.indexer = new ProjectIndexer(config);
    this.git = new GitHelper(config.paths.git);
    this.rag = new RAGPipeline();
  }

  /**
   * Initialize the assistant (load index, get project context)
   */
  async initialize(): Promise<void> {
    try {
      // Check if index exists
      const outputDir = path.join(
        this.config.paths.root,
        this.config.paths.output
      );
      const indexPath = path.join(outputDir, "chunks.json");
      const statsPath = path.join(outputDir, "stats.json");

      let chunks;
      try {
        const chunkData = await fs.readFile(indexPath, "utf-8");
        chunks = JSON.parse(chunkData);
        // Load stats from disk for existing index
        await this.indexer.loadStatsFromFile(statsPath);
      } catch (error) {
        console.log("Index not found. Creating index...");
        try {
          await this.indexer.indexProject();
          const chunkData = await fs.readFile(indexPath, "utf-8");
          chunks = JSON.parse(chunkData);
          // Stats are already loaded after indexProject()
        } catch (indexError) {
          const indexErrorMsg =
            indexError instanceof Error
              ? indexError.message
              : String(indexError);
          throw new Error(`Failed to create index: ${indexErrorMsg}`);
        }
      }

      // Set chunks in RAG
      this.rag.setChunks(chunks);
      this.rag.setConfig(this.config);

      // Initialize embeddings if available
      if (this.config.embedding?.enabled) {
        const embeddings = initializeEmbeddings(this.config);
        if (embeddings) {
          this.rag.setEmbeddings(embeddings);
        }
        console.log("Semantic search enabled with embeddings");
      }

      // Initialize LLM for answer generation
      // Use OpenAI if API key available (CI/CD or local testing), else Ollama
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        const llmConfig: LLMConfig = {
          provider: "openai",
          model: this.config.llm.model || "gpt-3.5-turbo",
          temperature: this.config.llm.temperature || 0.2,
          maxTokens: 2000,
          apiKey: openaiKey,
        };
        this.llm = new OpenAIProvider(llmConfig);
        console.log("Using OpenAI LLM provider");
      } else {
        this.llm = new Ollama({
          model: this.config.llm.model,
          baseUrl: "http://localhost:11434",
        });
        console.log("Using Ollama LLM provider");
      }

      // Initialize MCP server for git integration
      this.mcpServer = new GitMCPServer(this.config.paths.git);

      // Initialize CRM service
      const crmPath = path.join(this.config.paths.root, "src/data/crm.json");
      this.crm = new CRMService(crmPath);

      // Initialize Tasks service
      const tasksPath = path.join(
        this.config.paths.root,
        "src/data/tasks.json"
      );
      this.tasks = new TasksService(tasksPath);

      // Get project context
      this.projectContext = await this.getProjectContext();

      // Initialize conversation manager
      this.conversationManager = new ConversationManager(this.projectContext);

      console.log("CodeAssistant initialized successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize CodeAssistant: ${errorMessage}`);
    }
  }

  /**
   * Ask a question and get an answer with sources
   */
  async ask(question: string): Promise<AnswerWithSources> {
    if (!this.conversationManager) {
      throw new Error(
        "CodeAssistant not initialized. Call initialize() first."
      );
    }

    // Reset tools tracking for this answer
    this.toolsUsedInCurrentAnswer = [];

    // Add user message to conversation
    this.conversationManager.addUserMessage(question);

    // Classify the question using LLM-based classifier
    const category = await this._classifyQuestion(question);
    const hasLLM = !!this.llm;

    // Detect if this is an analytical question that needs RAG + tools
    const isAnalytical = await this._isAnalyticalQuestion(question);

    // DEBUG: Log classification results
    console.log(`[DEBUG] Question: "${question}"`);
    console.log(`[DEBUG] Category: ${category}`);
    console.log(`[DEBUG] IsAnalytical: ${isAnalytical}`);

    // Search for relevant context based on category and question type
    const searchResults =
      category === "rag" || isAnalytical
        ? this.rag.search(question, this.config.llm.maxResults)
        : [];
    const hasSearchResults = searchResults.length > 0;

    // Create prompt
    const systemPrompt = this.config.prompt.system.replace(
      "{projectName}",
      this.config.projectName
    );

    // Generate answer based on category
    let answer: string;
    try {
      if (
        hasLLM &&
        (category === "git" || category === "crm" || category === "tasks")
      ) {
        // PRIORITY 1: Tool-based questions (Git/CRM/Tasks)
        // Use RAG context only for analytical questions
        answer = await this._generateAnswerWithTools(
          systemPrompt,
          question,
          isAnalytical ? searchResults : []
        );
      } else if (hasLLM && hasSearchResults) {
        // PRIORITY 2: RAG-based questions with search results
        const context = this.rag.formatContext(searchResults);
        const ragPrompt = this.rag.createPrompt(
          systemPrompt,
          question,
          context
        );
        answer = await this._generateAnswerWithRAG(ragPrompt);
      } else {
        // FALLBACK: No tools, no search results
        answer = this._generateAnswer(question, searchResults);
      }
    } catch (error) {
      // Fallback if LLM fails
      answer = this._generateAnswer(question, searchResults);
    }

    // Add assistant message to conversation
    this.conversationManager.addAssistantMessage(answer, searchResults);

    return {
      answer,
      sources: searchResults,
      confidence: this._calculateConfidence(searchResults),
      toolsUsed:
        this.toolsUsedInCurrentAnswer.length > 0
          ? this.toolsUsedInCurrentAnswer
          : undefined,
      usedTools: this.toolsUsedInCurrentAnswer.length > 0,
    };
  }

  /**
   * Get project context (branch, commits, stats)
   */
  async getProjectContext(): Promise<ProjectContext> {
    const stats = await this.git.getProjectStats();
    const indexStats = this.indexer.getIndexStats();

    return {
      name: this.config.projectName,
      description: this.config.projectDescription,
      branch: stats.branch,
      recentCommits: stats.latestCommits,
      stats: {
        files: stats.fileCount,
        loc: stats.totalLOC,
        chunks: indexStats.totalChunks,
      },
    };
  }

  /**
   * Reindex the project
   */
  async reindex(): Promise<void> {
    console.log("Reindexing project...");
    await this.indexer.reindex();
    await this.initialize();
    console.log("Reindexing completed");
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): string {
    if (!this.conversationManager) {
      return "";
    }
    return this.conversationManager.getHistory();
  }

  /**
   * Clear conversation
   */
  clearConversation(): void {
    if (this.conversationManager && this.projectContext) {
      this.conversationManager.clear();
    }
  }

  /**
   * Search for relevant documentation using RAG
   */
  async search(query: string): Promise<SearchResult[]> {
    return this.rag.search(query);
  }

  /**
   * Start MCP server for git tools
   */
  async startMCPServer(): Promise<void> {
    if (!this.mcpServer) {
      throw new Error("MCP Server not initialized");
    }
    await this.mcpServer.start();
  }

  /**
   * Stop MCP server
   */
  async stopMCPServer(): Promise<void> {
    if (this.mcpServer) {
      await this.mcpServer.stop();
    }
  }

  /**
   * Get git status
   */
  async getGitStatus(): Promise<string> {
    return await this.git.getStatus();
  }

  /**
   * Generate answer using LLM with tool support
   * Allows LLM to call git tools when needed
   */
  private async _generateAnswerWithTools(
    systemPrompt: string,
    question: string,
    searchResults: SearchResult[] = []
  ): Promise<string> {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    const toolsDescription = this._getToolsDescription();

    // Add RAG context if available (hybrid mode: tools + RAG)
    let contextSection = "";
    if (searchResults.length > 0) {
      const context = this.rag.formatContext(searchResults);
      contextSection = `\n\n**Additional Context from Codebase:**\n${context}\n`;
    }

    let fullPrompt = `${systemPrompt}\n\nQuestion: ${question}${contextSection}\n\n${toolsDescription}`;
    let finalAnswer = "";
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      iterations++;

      try {
        const response = await this.llm.invoke(fullPrompt);
        const responseText =
          typeof response === "string" ? response : String(response);

        // Check if tool was called in the response
        // Support both formats: <tool>name</tool> and <tool>name</tool><input>{"param": "value"}</input>
        const toolMatch = responseText.match(
          /<tool>(\w+)<\/tool>(?:\s*<input>([\s\S]*?)<\/input>)?/s
        );

        if (!toolMatch) {
          // No tool called, we're done - this is the final answer
          finalAnswer = responseText;
          break;
        }

        // Tool was found, don't add tool XML to final answer, just extract the text before tool call
        const textBeforeTool = responseText
          .substring(0, toolMatch.index)
          .trim();
        if (textBeforeTool) {
          finalAnswer += textBeforeTool + "\n\n";
        }

        const [, toolName, inputStr] = toolMatch;

        // Track tool usage
        if (!this.toolsUsedInCurrentAnswer.includes(toolName)) {
          this.toolsUsedInCurrentAnswer.push(toolName);
        }

        let input: any = undefined;
        if (inputStr) {
          try {
            input = JSON.parse(inputStr);
          } catch (e) {
            // Failed to parse input, continue without it
          }
        }
        const toolResult = await this._executeTool(toolName, input);

        // Add tool result and continue with a clearer prompt
        fullPrompt = `ORIGINAL USER QUESTION: "${question}"

Tool Result (this is the data you need to use):
${toolResult}

Based ONLY on the tool result above, provide a complete and detailed answer to the user's question. Include ALL relevant information from the tool result. Be specific and thorough. Do NOT make up information. Just answer the question naturally using the data provided.`;
      } catch (error) {
        // Error during iteration, break and return what we have
        break;
      }
    }

    return finalAnswer.trim();
  }

  /**
   * Generate answer using LLM with RAG context (for non-git questions)
   */
  private async _generateAnswerWithRAG(prompt: string): Promise<string> {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    try {
      const response = await this.llm.invoke(prompt);
      return typeof response === "string" ? response : String(response);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error generating answer with RAG: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Detect if question requires analytical thinking (RAG + tools hybrid mode)
   * Analytical questions need both tool results AND codebase context
   * Uses simple heuristics + LLM for ambiguous cases
   */
  private async _isAnalyticalQuestion(question: string): Promise<boolean> {
    const lower = question.toLowerCase();

    // OBVIOUS analytical questions (fast path)
    if (/what should (we|i) do (first|next)/.test(lower)) {
      return true;
    }
    if (/\b(recommend|suggest|advise)\b/.test(lower)) {
      return true;
    }
    if (/\b(analyze|compare|evaluate)\b/.test(lower)) {
      return true;
    }
    if (/what.*(best|better|optimal)/.test(lower)) {
      return true;
    }
    if (/which.*(should|to)/.test(lower)) {
      return true;
    }

    // OBVIOUS simple tool calls (fast path)
    if (
      /^(show|list|get|create|update)\s+(me\s+)?(high|low|medium|open|all)?\s*(priority\s*)?(tasks?|tickets?|user)/i.test(
        question
      )
    ) {
      return false;
    }
    if (/^create\s+(a\s+)?(task|ticket)/i.test(question)) {
      return false;
    }

    // AMBIGUOUS cases - ask LLM
    return await this._llmIsAnalytical(question);
  }

  /**
   * Use LLM to determine if question is analytical
   */
  private async _llmIsAnalytical(question: string): Promise<boolean> {
    if (!this.llm) {
      // Default to simple tool call if LLM not available
      return false;
    }

    const prompt = `Determine if this question requires ANALYTICAL THINKING or is a SIMPLE TOOL CALL.

ANALYTICAL questions need:
- Recommendation based on multiple factors
- Comparison or evaluation
- Decision making ("what should we do")
- Prioritization advice
- Understanding context beyond raw data

SIMPLE TOOL CALL questions:
- Just list/show/get data
- Create/update with specific values
- Direct information retrieval

Question: "${question}"

Answer with ONLY ONE WORD: analytical or simple`;

    try {
      const response = await this.llm.invoke(prompt);
      const answer =
        typeof response === "string"
          ? response.trim().toLowerCase()
          : String(response).trim().toLowerCase();

      return answer.includes("analytical");
    } catch (error) {
      console.error("Error in LLM analytical detection:", error);
      return false; // Default to simple
    }
  }

  /**
   * Classify question into categories: git, crm, tasks, or rag
   * Uses simple heuristics for obvious cases, falls back to LLM for ambiguous ones
   */
  private async _classifyQuestion(
    question: string
  ): Promise<"git" | "crm" | "tasks" | "rag"> {
    const lower = question.toLowerCase();

    // Simple heuristic - fast checks for obvious cases
    // Git commands
    if (
      lower.startsWith("git ") ||
      lower.includes("git status") ||
      lower.includes("git branch")
    ) {
      return "git";
    }
    if (
      /\b(branch|commit|push|pull|merge|rebase)\b/.test(lower) &&
      lower.includes("git")
    ) {
      return "git";
    }

    // CRM - explicit user/ticket references (CHECK BEFORE TASKS!)
    if (lower.includes("user_") || lower.includes("ticket_")) {
      return "crm";
    }
    if (
      /\b(ticket|support)\b/.test(lower) &&
      /\bupdate\b|\bcreate\b|\blist\b|\bget\b|\bshow\b/.test(lower)
    ) {
      return "crm";
    }
    if (
      lower.startsWith("list tickets") ||
      lower.startsWith("create ticket") ||
      lower.startsWith("get user") ||
      lower.startsWith("update ticket")
    ) {
      return "crm";
    }

    // Tasks - explicit task management (team work tasks, NOT support tickets)
    if (
      lower.startsWith("create task") ||
      lower.startsWith("create a task") ||
      lower.startsWith("show tasks") ||
      lower.startsWith("list tasks")
    ) {
      return "tasks";
    }
    // Create task patterns with different phrasings
    if (
      /create\s+(a\s+)?task\s+to/.test(lower) ||
      /add\s+(a\s+)?task\s+to/.test(lower)
    ) {
      return "tasks";
    }
    // Assign to dev_X pattern (clear sign of task management)
    if (/assign\s+to\s+dev_\d+/.test(lower)) {
      return "tasks";
    }
    // Show/list tasks for developers
    if (
      /\b(show|list|get)\b/.test(lower) &&
      /\btask/.test(lower) &&
      /\bfor\s+dev_\d+/.test(lower)
    ) {
      return "tasks";
    }
    // Tasks with priority keywords
    if (
      /\btask\b/.test(lower) &&
      (/\bhigh\b|\blow\b|\bmedium\b/.test(lower) ||
        /\bopen\b|\bcompleted\b|\bin.progress/.test(lower))
    ) {
      return "tasks";
    }

    // For ambiguous cases - use LLM classifier
    return await this._llmClassify(question);
  }

  /**
   * Use LLM to classify ambiguous questions
   */
  private async _llmClassify(
    question: string
  ): Promise<"git" | "crm" | "tasks" | "rag"> {
    if (!this.llm) {
      // Fallback to RAG if LLM not available
      return "rag";
    }

    const prompt = `Classify this user question into ONE category:

Categories:
- git: Questions about git commands, branches, commits, repository status, code changes
- crm: Questions about users, support tickets, customers, customer support (tickets are for customer support)
- tasks: Questions about team tasks, work priorities, task assignments, project management, what to do next, recommendations (tasks are for team work)
- rag: Questions about documentation, code explanation, architecture, how things work, general questions

User question: "${question}"

Key Rules:
- Answer with ONLY ONE WORD: git, crm, tasks, or rag
- "ticket" + customer/user context → crm
- "task" + team work/priorities → tasks
- "what should we do" or "what to do first" → tasks
- git/repository questions → git
- code explanation/docs → rag

Examples:
- "Show me high priority tasks" → tasks
- "What should we do first from high priority tasks?" → tasks
- "Create a task to add logging, assign to dev_1" → tasks
- "Show open tasks for dev_1" → tasks
- "List tickets for user_1" → crm
- "Update ticket ticket_1 status" → crm
- "What is git status?" → git
- "How does authentication work?" → rag

Answer:`;

    try {
      const response = await this.llm.invoke(prompt);
      const classification =
        typeof response === "string"
          ? response.trim().toLowerCase()
          : String(response).trim().toLowerCase();

      // Validate response
      if (classification.includes("git")) return "git";
      if (classification.includes("crm")) return "crm";
      if (classification.includes("task")) return "tasks";
      if (classification.includes("rag")) return "rag";

      // Default fallback
      return "rag";
    } catch (error) {
      console.error("Error classifying question with LLM:", error);
      return "rag"; // Fallback to RAG
    }
  }

  /**
   * Get description of available tools for the LLM
   */
  private _getToolsDescription(): string {
    return `
**🚨 CRITICAL: You MUST ALWAYS use tools to answer questions about git, CRM, and Tasks!**

You have access to these tools - USE THEM FOR EVERY RELEVANT QUESTION:

**Git Tools:**
1. git_branch - Get current git branch name
2. git_status - Get git repository status (shows modified, untracked files, etc)

**CRM Tools:**
3. get_user - Get user information (input: {"user_id": "..."})
4. list_tickets - List tickets for a user (input: {"user_id": "...", "status": "optional"})
5. create_ticket - Create a new ticket (input: {"user_id": "...", "title": "...", "description": "...", "category": "optional", "priority": "optional"})
6. update_ticket - Update ticket status/priority (input: {"ticket_id": "...", "status": "optional", "priority": "optional"})
7. add_message - Add message to ticket (input: {"ticket_id": "...", "text": "..."})
8. search_tickets - Search tickets (input: {"query": "optional", "user_id": "optional"})

**Tasks Tools:**
9. list_tasks - List team tasks (input: {"priority": "optional (high/medium/low)", "status": "optional (open/in_progress/completed)", "assignee": "optional"})
10. get_task - Get task details (input: {"task_id": "..."})
11. create_task - Create new task (input: {"title": "...", "description": "...", "assignee": "...", "priority": "optional", "depends_on": "optional"})
12. update_task - Update task (input: {"task_id": "...", "status": "optional", "priority": "optional", "assignee": "optional"})

**TOOL DETECTION RULES:**
- Get user info → use get_user with user_id
- List/show tickets → use list_tickets with user_id
- Search tickets by query → use search_tickets with query
- CREATE NEW ticket → use create_ticket (only when explicitly creating)
- UPDATE EXISTING ticket → use update_ticket (when ticket_id is provided and needs update)
- Add message to ticket → use add_message with ticket_id
- Git branch info → use git_branch
- Git repository status → use git_status
- List/show TASKS → use list_tasks with filters (priority, status, assignee)
- Get specific task → use get_task with task_id
- Create team TASK → use create_task (for team work, NOT support tickets)
- Update team TASK → use update_task (for team work, NOT support tickets)

**MANDATORY FORMAT - YOU MUST FOLLOW THIS EXACTLY:**
<tool>tool_name</tool>
<input>{"key1": "value1", "key2": "value2"}</input>

AFTER using the tool, incorporate results naturally in your response.

**EXAMPLES:**
User: "Get information about user user_1"
You MUST respond:
<tool>get_user</tool>
<input>{"user_id": "user_1"}</input>
[Then your answer based on tool result]

User: "List all tickets for user user_1"
You MUST respond:
<tool>list_tickets</tool>
<input>{"user_id": "user_1"}</input>
[Then your answer based on tool result]

User: "Update ticket ticket_1 priority to high"
You MUST respond:
<tool>update_ticket</tool>
<input>{"ticket_id": "ticket_1", "priority": "high"}</input>
[Then your answer based on tool result]

User: "Create a ticket for user_1 about login issue"
You MUST respond:
<tool>create_ticket</tool>
<input>{"user_id": "user_1", "title": "Login issue", "description": "User cannot login"}</input>
[Then your answer based on tool result]

User: "Search for tickets about authentication"
You MUST respond:
<tool>search_tickets</tool>
<input>{"query": "authentication"}</input>
[Then your answer based on tool result]

User: "Show me high priority tasks"
You MUST respond:
<tool>list_tasks</tool>
<input>{"priority": "high"}</input>
[Then your answer based on tool result]

User: "Create a task to add logging, assign to dev_1"
You MUST respond:
<tool>create_task</tool>
<input>{"title": "Add logging", "description": "Add logging functionality to the project", "assignee": "dev_1", "priority": "medium"}</input>
[Then your answer based on tool result]

User: "Show open tasks for dev_1"
You MUST respond:
<tool>list_tasks</tool>
<input>{"status": "open", "assignee": "dev_1"}</input>
[Then your answer based on tool result]

User: "What should we do first from high priority tasks?"
You MUST respond:
<tool>list_tasks</tool>
<input>{"priority": "high", "status": "open"}</input>
[Then analyze results and give recommendation based on the tasks returned]

**IMPORTANT REQUIREMENTS:**
- For list_tickets: ALWAYS require user_id in the input
- For get_user: ALWAYS require user_id
- For create_ticket: ALWAYS require user_id, title, and description
- For create_task: ALWAYS require title, description, and assignee
- For list_tasks: Use filters (priority, status, assignee) as provided in question
- If a question is about a specific user, extract their ID and use it
- If user_id is not provided but needed, ask the user to provide it

DO NOT provide generic answers - ALWAYS use the available tools!`;
  }

  /**
   * Execute a tool and return its result
   */
  private async _executeTool(toolName: string, input?: any): Promise<string> {
    if (!this.crm) {
      return `Error: CRM Service not initialized`;
    }

    try {
      switch (toolName) {
        // Git tools
        case "git_branch": {
          const stats = await this.git.getProjectStats();
          return `Current git branch: ${stats.branch}`;
        }
        case "git_status": {
          const status = await this.git.getStatus();
          return status
            ? `Git Status:\n${status}`
            : "Git repository is clean (no changes)";
        }
        // CRM tools
        case "get_user": {
          const { user_id } = input || {};
          if (!user_id) return "Error: user_id is required for get_user";
          const user = this.crm.getUser(user_id);
          if (!user) return `Error: User ${user_id} not found`;
          return JSON.stringify({ success: true, user }, null, 2);
        }
        case "list_tickets": {
          const { user_id, status } = input || {};
          if (!user_id) return "Error: user_id is required for list_tickets";
          const tickets = this.crm.getUserTickets(user_id);
          const filtered = status
            ? tickets.filter((t: any) => t.status === status)
            : tickets;
          return JSON.stringify(
            { success: true, count: filtered.length, tickets: filtered },
            null,
            2
          );
        }
        case "create_ticket": {
          const { user_id, title, description, category, priority } =
            input || {};
          if (!user_id || !title || !description) {
            return "Error: user_id, title, and description are required for create_ticket";
          }
          const user = this.crm.getUser(user_id);
          if (!user) return `Error: User ${user_id} not found`;

          const ticketId = `ticket_${Date.now()}`;
          const ticket = {
            id: ticketId,
            user_id,
            title,
            description,
            category: category || "other",
            priority: priority || "medium",
            status: "open" as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            messages: [
              {
                sender: "user" as const,
                text: description,
                timestamp: new Date().toISOString(),
              },
            ],
          };
          this.crm.createTicket(ticket);
          return JSON.stringify(
            {
              success: true,
              ticket_id: ticketId,
              message: "Ticket created successfully",
            },
            null,
            2
          );
        }
        case "update_ticket": {
          const { ticket_id, status, priority } = input || {};
          if (!ticket_id)
            return "Error: ticket_id is required for update_ticket";
          const ticket = this.crm.getTicket(ticket_id);
          if (!ticket) return `Error: Ticket ${ticket_id} not found`;

          const updates: any = {};
          if (status) updates.status = status;
          if (priority) updates.priority = priority;
          updates.updated_at = new Date().toISOString();

          this.crm.updateTicket(ticket_id, updates);
          const updatedTicket = this.crm.getTicket(ticket_id);
          return JSON.stringify(
            {
              success: true,
              message: `Ticket ${ticket_id} updated successfully`,
              ticket: updatedTicket,
            },
            null,
            2
          );
        }
        case "add_message": {
          const { ticket_id, text, sender } = input || {};
          if (!ticket_id || !text)
            return "Error: ticket_id and text are required for add_message";
          const ticket = this.crm.getTicket(ticket_id);
          if (!ticket) return `Error: Ticket ${ticket_id} not found`;

          this.crm.addTicketMessage(ticket_id, {
            sender: sender || "support_agent",
            text,
            timestamp: new Date().toISOString(),
          });
          return JSON.stringify(
            { success: true, message: `Message added to ticket ${ticket_id}` },
            null,
            2
          );
        }
        case "search_tickets": {
          const { query, user_id } = input || {};
          if (!query && !user_id)
            return "Error: Either query or user_id is required for search_tickets";

          let results: any[] = [];
          if (user_id) {
            results = this.crm.getUserTickets(user_id);
          } else {
            results = (this.crm as any).data.tickets;
          }

          if (query) {
            const q = query.toLowerCase();
            results = results.filter(
              (t: any) =>
                t.title.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q)
            );
          }

          return JSON.stringify(
            { success: true, count: results.length, tickets: results },
            null,
            2
          );
        }
        // Tasks tools
        case "list_tasks": {
          if (!this.tasks) return "Error: Tasks service not initialized";
          const { priority, status, assignee } = input || {};
          const filters: any = {};
          if (priority) filters.priority = priority;
          if (status) filters.status = status;
          if (assignee) filters.assignee = assignee;
          const tasks = this.tasks.getTasks(filters);
          return JSON.stringify(
            { success: true, count: tasks.length, tasks },
            null,
            2
          );
        }
        case "get_task": {
          if (!this.tasks) return "Error: Tasks service not initialized";
          const { task_id } = input || {};
          if (!task_id) return "Error: task_id is required for get_task";
          const task = this.tasks.getTask(task_id);
          if (!task) return `Error: Task ${task_id} not found`;
          return JSON.stringify({ success: true, task }, null, 2);
        }
        case "create_task": {
          if (!this.tasks) return "Error: Tasks service not initialized";
          const { title, description, priority, assignee } = input || {};
          if (!title || !description || !assignee) {
            return "Error: title, description, and assignee are required for create_task";
          }
          const taskId = `task_${Date.now()}`;
          const newTask = {
            id: taskId,
            title,
            description,
            priority: priority || "medium",
            status: "open" as const,
            assignee,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            depends_on: input.depends_on || [],
          };
          this.tasks.createTask(newTask);
          return JSON.stringify(
            {
              success: true,
              task_id: taskId,
              message: "Task created successfully",
              task: newTask,
            },
            null,
            2
          );
        }
        case "update_task": {
          if (!this.tasks) return "Error: Tasks service not initialized";
          const { task_id, status, priority, assignee } = input || {};
          if (!task_id) return "Error: task_id is required for update_task";
          const task = this.tasks.getTask(task_id);
          if (!task) return `Error: Task ${task_id} not found`;
          const updates: any = {};
          if (status) updates.status = status;
          if (priority) updates.priority = priority;
          if (assignee) updates.assignee = assignee;
          this.tasks.updateTask(task_id, updates);
          const updatedTask = this.tasks.getTask(task_id);
          return JSON.stringify(
            {
              success: true,
              message: `Task ${task_id} updated successfully`,
              task: updatedTask,
            },
            null,
            2
          );
        }
        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return `Error executing tool: ${errorMsg}`;
    }
  }

  private _generateAnswer(question: string, sources: SearchResult[]): string {
    // Simple answer generation based on sources (fallback)
    if (sources.length === 0) {
      return `I could not find relevant information in the codebase for: "${question}". Please try a more specific question or check the documentation.`;
    }

    let answer = `Based on the codebase, `;

    // Extract key terms from sources
    const keywords = this._extractKeywords(sources);

    if (keywords.length > 0) {
      answer += `I found information about: ${keywords.join(", ")}. `;
    }

    answer += `The most relevant files are [1] ${sources[0].metadata.source}`;

    if (sources.length > 1) {
      answer += ` and [2] ${sources[1].metadata.source}`;
    }

    answer += ".";

    return answer;
  }

  private _extractKeywords(sources: SearchResult[]): string[] {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "was",
      "are",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "should",
      "could",
      "can",
      "may",
      "might",
      "must",
      "shall",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "what",
      "which",
      "who",
      "when",
      "where",
      "why",
      "how",
      "all",
      "each",
      "import",
      "export",
      "from",
      "default",
      "function",
      "class",
      "const",
      "let",
      "var",
      "return",
      "if",
      "else",
      "try",
      "catch",
      "throw",
      "new",
      "private",
      "public",
      "static",
      "async",
      "await",
      "get",
      "set",
    ]);

    const keywords = new Set<string>();

    for (const source of sources) {
      const words = source.content
        .toLowerCase()
        .split(/\s+/)
        .map((w: string) => w.replace(/[^a-z0-9]/g, "")) // Remove non-alphanumeric chars
        .filter((w: string) => w.length > 3 && !stopWords.has(w))
        .slice(0, 5);
      words.forEach((w: string) => keywords.add(w));
    }

    return Array.from(keywords).slice(0, 5);
  }

  private _calculateConfidence(sources: SearchResult[]): number {
    if (sources.length === 0) return 0;
    if (sources.length >= 3) return 0.9;
    if (sources.length >= 1) return 0.7;
    return 0.5;
  }
}
