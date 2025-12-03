import fs from 'fs/promises';
import path from 'path';
import { ProjectConfig, AnswerWithSources, ProjectContext, SearchResult } from './types/index.js';
import { ProjectIndexer } from './projectIndexer.js';
import { GitHelper } from './gitHelper.js';
import { RAGPipeline } from './rag/ragPipeline.js';
import { ConversationManager } from './rag/conversationManager.js';
import { initializeEmbeddings } from './rag/embeddingUtils.js';
import { Ollama } from '@langchain/ollama';
import { GitMCPServer } from './mcp/gitServer.js';
import { LLMProvider, LLMConfig } from './llm/llmProvider.js';
import { OpenAIProvider } from './llm/openaiProvider.js';
import { CRMService } from './support/crmService.js';

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
      const indexPath = path.join(outputDir, 'chunks.json');
      const statsPath = path.join(outputDir, 'stats.json');

      let chunks;
      try {
        const chunkData = await fs.readFile(indexPath, 'utf-8');
        chunks = JSON.parse(chunkData);
        // Load stats from disk for existing index
        await this.indexer.loadStatsFromFile(statsPath);
      } catch (error) {
        console.log('Index not found. Creating index...');
        try {
          await this.indexer.indexProject();
          const chunkData = await fs.readFile(indexPath, 'utf-8');
          chunks = JSON.parse(chunkData);
          // Stats are already loaded after indexProject()
        } catch (indexError) {
          const indexErrorMsg = indexError instanceof Error ? indexError.message : String(indexError);
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
        console.log('Semantic search enabled with embeddings');
      }

      // Initialize LLM for answer generation
      // Use OpenAI if API key available (CI/CD or local testing), else Ollama
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        const llmConfig: LLMConfig = {
          provider: 'openai',
          model: this.config.llm.model || 'gpt-3.5-turbo',
          temperature: this.config.llm.temperature || 0.2,
          maxTokens: 2000,
          apiKey: openaiKey,
        };
        this.llm = new OpenAIProvider(llmConfig);
        console.log('Using OpenAI LLM provider');
      } else {
        this.llm = new Ollama({
          model: this.config.llm.model,
          baseUrl: 'http://localhost:11434',
        });
        console.log('Using Ollama LLM provider');
      }

      // Initialize MCP server for git integration
      this.mcpServer = new GitMCPServer(this.config.paths.git);

      // Initialize CRM service
      const crmPath = path.join(this.config.paths.root, 'src/data/crm.json');
      this.crm = new CRMService(crmPath);

      // Get project context
      this.projectContext = await this.getProjectContext();

      // Initialize conversation manager
      this.conversationManager = new ConversationManager(this.projectContext);

      console.log('CodeAssistant initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize CodeAssistant: ${errorMessage}`);
    }
  }

  /**
   * Ask a question and get an answer with sources
   */
  async ask(question: string): Promise<AnswerWithSources> {
    if (!this.conversationManager) {
      throw new Error('CodeAssistant not initialized. Call initialize() first.');
    }

    // Add user message to conversation
    this.conversationManager.addUserMessage(question);

    // Check if this is a tool-based question FIRST (before RAG search)
    const isToolQuestion = this._isGitQuestion(question);
    const hasLLM = !!this.llm;

    // Search for relevant context (only if NOT a tool question)
    const searchResults = !isToolQuestion ? this.rag.search(question, this.config.llm.maxResults) : [];
    const hasSearchResults = searchResults.length > 0;

    // Create prompt
    const systemPrompt = this.config.prompt.system
      .replace('{projectName}', this.config.projectName);

    // Generate answer using LLM with tools if available
    let answer: string;
    try {
      if (hasLLM && isToolQuestion) {
        // PRIORITY 1: Tool-based questions (Git/CRM) - use tool calling
        answer = await this._generateAnswerWithTools(systemPrompt, question);
      } else if (hasLLM && hasSearchResults) {
        // PRIORITY 2: RAG-based questions with search results
        const context = this.rag.formatContext(searchResults);
        const ragPrompt = this.rag.createPrompt(systemPrompt, question, context);
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
      toolsUsed: this.toolsUsedInCurrentAnswer.length > 0 ? this.toolsUsedInCurrentAnswer : undefined,
      usedTools: this.toolsUsedInCurrentAnswer.length > 0
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
        chunks: indexStats.totalChunks
      }
    };
  }

  /**
   * Reindex the project
   */
  async reindex(): Promise<void> {
    console.log('Reindexing project...');
    await this.indexer.reindex();
    await this.initialize();
    console.log('Reindexing completed');
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): string {
    if (!this.conversationManager) {
      return '';
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
      throw new Error('MCP Server not initialized');
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
  private async _generateAnswerWithTools(systemPrompt: string, question: string): Promise<string> {
    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    this.toolsUsedInCurrentAnswer = []; // Reset tools tracking
    const toolsDescription = this._getToolsDescription();
    let fullPrompt = `${systemPrompt}\n\nQuestion: ${question}\n\n${toolsDescription}`;
    let finalAnswer = '';
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      iterations++;

      try {
        const response = await this.llm.invoke(fullPrompt);
        const responseText = typeof response === 'string' ? response : String(response);

        // Check if tool was called in the response
        // Support both formats: <tool>name</tool> and <tool>name</tool><input>{"param": "value"}</input>
        const toolMatch = responseText.match(/<tool>(\w+)<\/tool>(?:\s*<input>([\s\S]*?)<\/input>)?/s);

        if (!toolMatch) {
          // No tool called, we're done - this is the final answer
          finalAnswer = responseText;
          break;
        }

        // Tool was found, don't add tool XML to final answer, just extract the text before tool call
        const textBeforeTool = responseText.substring(0, toolMatch.index).trim();
        if (textBeforeTool) {
          finalAnswer += textBeforeTool + '\n\n';
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
      throw new Error('LLM not initialized');
    }

    try {
      const response = await this.llm.invoke(prompt);
      return typeof response === 'string' ? response : String(response);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error generating answer with RAG: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Detect if a question is git-related or CRM-related
   */
  private _isGitQuestion(question: string): boolean {
    const gitKeywords = [
      'branch', 'status', 'commit', 'git', 'changes', 'modified',
      'staged', 'untracked', 'push', 'pull', 'merge', 'rebase',
      'checkout', 'tag', 'git log', 'diff', 'stash', 'reset', // Use 'git log' instead of 'log'
      'what branch', 'current branch', 'which branch',
      'git status', 'repository status', 'repo status',
      'what changes', 'modified files', 'changed files'
    ];

    const crmKeywords = [
      'user', 'ticket', 'support', 'customer',
      'get_user', 'list_tickets', 'create_ticket', 'update_ticket',
      'add_message', 'search_tickets',
      'support ticket', 'create ticket', 'update ticket' // More specific patterns
    ];

    const lowerQuestion = question.toLowerCase();

    // Use word boundary regex for more precise matching
    const isGit = gitKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lowerQuestion);
    });

    const isCRM = crmKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lowerQuestion);
    });

    return isGit || isCRM;
  }

  /**
   * Get description of available tools for the LLM
   */
  private _getToolsDescription(): string {
    return `
**🚨 CRITICAL: You MUST ALWAYS use tools to answer questions about git and CRM!**

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

**TOOL DETECTION RULES:**
- ANY mention of "user" → use get_user
- ANY mention of "tickets", "ticket", "issue", "support" → use list_tickets, search_tickets, or create_ticket
- ANY mention of "branch" → use git_branch
- ANY mention of "git", "status", "changes", "modified" → use git_status

**MANDATORY FORMAT - YOU MUST FOLLOW THIS EXACTLY:**
<tool>tool_name</tool>
<input>{"key1": "value1", "key2": "value2"}</input>

AFTER using the tool, incorporate results naturally in your response.

**EXAMPLES:**
User asks: "Get information about user user_1"
You MUST respond:
<tool>get_user</tool>
<input>{"user_id": "user_1"}</input>
[Then your answer based on tool result]

User asks: "List all tickets for user user_1"
You MUST respond:
<tool>list_tickets</tool>
<input>{"user_id": "user_1"}</input>
[Then your answer based on tool result]

User asks: "Search for tickets about authentication"
You MUST respond:
<tool>search_tickets</tool>
<input>{"query": "authentication"}</input>
[Then your answer based on tool result]

**IMPORTANT REQUIREMENTS:**
- For list_tickets: ALWAYS require user_id in the input
- For get_user: ALWAYS require user_id
- For create_ticket: ALWAYS require user_id, title, and description
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
        case 'git_branch': {
          const stats = await this.git.getProjectStats();
          return `Current git branch: ${stats.branch}`;
        }
        case 'git_status': {
          const status = await this.git.getStatus();
          return status ? `Git Status:\n${status}` : 'Git repository is clean (no changes)';
        }
        // CRM tools
        case 'get_user': {
          const { user_id } = input || {};
          if (!user_id) return 'Error: user_id is required for get_user';
          const user = this.crm.getUser(user_id);
          if (!user) return `Error: User ${user_id} not found`;
          return JSON.stringify({ success: true, user }, null, 2);
        }
        case 'list_tickets': {
          const { user_id, status } = input || {};
          if (!user_id) return 'Error: user_id is required for list_tickets';
          const tickets = this.crm.getUserTickets(user_id);
          const filtered = status ? tickets.filter((t: any) => t.status === status) : tickets;
          return JSON.stringify({ success: true, count: filtered.length, tickets: filtered }, null, 2);
        }
        case 'create_ticket': {
          const { user_id, title, description, category, priority } = input || {};
          if (!user_id || !title || !description) {
            return 'Error: user_id, title, and description are required for create_ticket';
          }
          const user = this.crm.getUser(user_id);
          if (!user) return `Error: User ${user_id} not found`;

          const ticketId = `ticket_${Date.now()}`;
          const ticket = {
            id: ticketId,
            user_id,
            title,
            description,
            category: category || 'other',
            priority: priority || 'medium',
            status: 'open' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            messages: [{
              sender: 'user' as const,
              text: description,
              timestamp: new Date().toISOString(),
            }],
          };
          this.crm.createTicket(ticket);
          return JSON.stringify({ success: true, ticket_id: ticketId, message: 'Ticket created successfully' }, null, 2);
        }
        case 'update_ticket': {
          const { ticket_id, status, priority } = input || {};
          if (!ticket_id) return 'Error: ticket_id is required for update_ticket';
          const ticket = this.crm.getTicket(ticket_id);
          if (!ticket) return `Error: Ticket ${ticket_id} not found`;

          const updates: any = {};
          if (status) updates.status = status;
          if (priority) updates.priority = priority;
          updates.updated_at = new Date().toISOString();

          this.crm.updateTicket(ticket_id, updates);
          const updatedTicket = this.crm.getTicket(ticket_id);
          return JSON.stringify({ success: true, message: `Ticket ${ticket_id} updated successfully`, ticket: updatedTicket }, null, 2);
        }
        case 'add_message': {
          const { ticket_id, text, sender } = input || {};
          if (!ticket_id || !text) return 'Error: ticket_id and text are required for add_message';
          const ticket = this.crm.getTicket(ticket_id);
          if (!ticket) return `Error: Ticket ${ticket_id} not found`;

          this.crm.addTicketMessage(ticket_id, {
            sender: sender || 'support_agent',
            text,
            timestamp: new Date().toISOString(),
          });
          return JSON.stringify({ success: true, message: `Message added to ticket ${ticket_id}` }, null, 2);
        }
        case 'search_tickets': {
          const { query, user_id } = input || {};
          if (!query && !user_id) return 'Error: Either query or user_id is required for search_tickets';

          let results: any[] = [];
          if (user_id) {
            results = this.crm.getUserTickets(user_id);
          } else {
            results = (this.crm as any).data.tickets;
          }

          if (query) {
            const q = query.toLowerCase();
            results = results.filter((t: any) =>
              t.title.toLowerCase().includes(q) ||
              t.description.toLowerCase().includes(q)
            );
          }

          return JSON.stringify({ success: true, count: results.length, tickets: results }, null, 2);
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
      answer += `I found information about: ${keywords.join(', ')}. `;
    }

    answer += `The most relevant files are [1] ${sources[0].metadata.source}`;

    if (sources.length > 1) {
      answer += ` and [2] ${sources[1].metadata.source}`;
    }

    answer += '.';

    return answer;
  }

  private _extractKeywords(sources: SearchResult[]): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
      'import', 'export', 'from', 'default', 'function', 'class', 'const',
      'let', 'var', 'return', 'if', 'else', 'try', 'catch', 'throw', 'new',
      'private', 'public', 'static', 'async', 'await', 'get', 'set'
    ]);

    const keywords = new Set<string>();

    for (const source of sources) {
      const words = source.content
        .toLowerCase()
        .split(/\s+/)
        .map((w: string) => w.replace(/[^a-z0-9]/g, '')) // Remove non-alphanumeric chars
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
