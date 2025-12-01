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

export class CodeAssistant {
  private config: ProjectConfig;
  private indexer: ProjectIndexer;
  private git: GitHelper;
  private rag: RAGPipeline;
  private conversationManager: ConversationManager | null = null;
  private projectContext: ProjectContext | null = null;
  private llm: Ollama | null = null;
  private mcpServer: GitMCPServer | null = null;

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
      this.rag.setModel(this.config.llm.model);

      // Initialize embeddings if available
      if (this.config.embedding?.enabled) {
        const embeddings = initializeEmbeddings(this.config);
        if (embeddings) {
          this.rag.setEmbeddings(embeddings);
          console.log('Semantic search enabled with embeddings');
        }
      }

      // Initialize LLM for answer generation
      this.llm = new Ollama({
        model: this.config.llm.model,
        baseUrl: 'http://localhost:11434',
      });

      // Initialize MCP server for git integration
      this.mcpServer = new GitMCPServer(this.config.paths.git);

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

    // Search for relevant context
    const searchResults = this.rag.search(question, this.config.llm.maxResults);

    // Create prompt
    const systemPrompt = this.config.prompt.system
      .replace('{projectName}', this.config.projectName);

    // Generate answer using LLM with tools if available
    let answer: string;
    try {
      const isGitQuestion = this._isGitQuestion(question);
      if (this.llm && isGitQuestion) {
        // For git questions, use tool calling without RAG context
        answer = await this._generateAnswerWithTools(systemPrompt, question);
      } else if (this.llm && searchResults.length > 0) {
        // For non-git questions with search results, use RAG + LLM
        const context = this.rag.formatContext(searchResults);
        const ragPrompt = this.rag.createPrompt(systemPrompt, question, context);
        answer = await this._generateAnswerWithRAG(ragPrompt);
      } else {
        // Fallback: no LLM or no search results
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
      confidence: this._calculateConfidence(searchResults)
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
        finalAnswer += responseText;

        // Check if tool was called in the response
        // Support both formats: <tool>name</tool> and <tool>name</tool><input></input>
        const toolMatch = responseText.match(/<tool>(\w+)<\/tool>(?:\s*<input>(.*?)<\/input>)?/s);

        if (!toolMatch) {
          // No tool called, we're done
          break;
        }

        const [, toolName] = toolMatch;
        const toolResult = await this._executeTool(toolName);

        // Debug logging
        console.error(`[Tool Execution] Tool: ${toolName}, Result: ${toolResult}`);

        // Add tool result and continue with a clearer prompt
        fullPrompt = `Based on the tool result below, answer the user's original question directly and naturally.

Tool Result:
${toolResult}

Now provide your final answer to the user's question. Use the tool result above as your source of truth. Do NOT add explanations about tools or how they work. Just answer the question naturally.`;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Error during tool iteration: ${errorMsg}`);
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
   * Detect if a question is git-related
   */
  private _isGitQuestion(question: string): boolean {
    const gitKeywords = [
      'branch', 'status', 'commit', 'git', 'changes', 'modified',
      'staged', 'untracked', 'push', 'pull', 'merge', 'rebase',
      'checkout', 'tag', 'log', 'diff', 'stash', 'reset',
      'what branch', 'current branch', 'which branch',
      'git status', 'repository status', 'repo status',
      'what changes', 'modified files', 'changed files'
    ];

    const lowerQuestion = question.toLowerCase();
    return gitKeywords.some(keyword => lowerQuestion.includes(keyword));
  }

  /**
   * Get description of available tools for the LLM
   */
  private _getToolsDescription(): string {
    return `
**IMPORTANT: You MUST use tools to answer questions about git!**

You have access to two tools:

1. git_branch - Returns the current git branch name
2. git_status - Returns git repository status (M for modified, ?? for untracked, etc)

**When to use tools:**
- If question asks "what branch", use: <tool>git_branch</tool>
- If question asks "status" or "changes", use: <tool>git_status</tool>
- If question mentions "branch", use: <tool>git_branch</tool>

**REQUIRED FORMAT:**
<tool>tool_name</tool>

Then in your response, incorporate the tool result naturally.

Example:
User: "What branch are we on?"
You: <tool>git_branch</tool>
Then say: "We are on the main branch." (with actual result from tool)`;
  }

  /**
   * Execute a tool and return its result
   */
  private async _executeTool(toolName: string): Promise<string> {
    try {
      switch (toolName) {
        case 'git_branch': {
          const stats = await this.git.getProjectStats();
          return `Current git branch: ${stats.branch}`;
        }
        case 'git_status': {
          const status = await this.git.getStatus();
          return status ? `Git Status:\n${status}` : 'Git repository is clean (no changes)';
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
