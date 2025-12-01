import fs from 'fs/promises';
import path from 'path';
import { ProjectConfig, AnswerWithSources, ProjectContext, SearchResult } from './types/index.js';
import { ProjectIndexer } from './projectIndexer.js';
import { GitHelper } from './gitHelper.js';
import { RAGPipeline } from './rag/ragPipeline.js';
import { ConversationManager } from './rag/conversationManager.js';

export class CodeAssistant {
  private config: ProjectConfig;
  private indexer: ProjectIndexer;
  private git: GitHelper;
  private rag: RAGPipeline;
  private conversationManager: ConversationManager | null = null;
  private projectContext: ProjectContext | null = null;

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

    // Format context
    const context = this.rag.formatContext(searchResults);

    // Create prompt
    const systemPrompt = this.config.prompt.system
      .replace('{projectName}', this.config.projectName);

    const prompt = this.rag.createPrompt(systemPrompt, question, context);

    // In production, this would call the actual LLM
    // For now, return a structured response
    const answer = this._generateAnswer(question, searchResults);

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
   * Get git status
   */
  async getGitStatus(): Promise<string> {
    return await this.git.getStatus();
  }

  private _generateAnswer(question: string, sources: SearchResult[]): string {
    // Simple answer generation based on sources
    // In production, this would use the actual LLM
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
      'let', 'var', 'return', 'if', 'else', 'try', 'catch', 'throw', 'new'
    ]);

    const keywords = new Set<string>();

    for (const source of sources) {
      const words = source.content
        .toLowerCase()
        .split(/\s+/)
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
