// Project configuration types
export interface ProjectConfig {
  projectName: string;
  projectDescription: string;

  paths: {
    root: string;
    git: string;
    output: string;
  };

  indexing: {
    includeFolders: string[];
    excludeFolders: string[];
    includeFileTypes: string[];
    excludePatterns: string[];
    maxFileSize: string;
    chunkSize: number;
    chunkOverlap: number;
  };

  git: {
    enabled: boolean;
    includeCommitHistory: boolean;
    maxCommitsToFetch: number;
  };

  llm: {
    model: string;
    temperature: number;
    topP: number;
    contextWindow: number;
    maxResults: number;
  };

  prompt: {
    system: string;
    language: string;
  };

  embedding?: {
    enabled: boolean;
    model: string;
    provider: 'ollama';
    baseUrl?: string;
  };

  mcp?: {
    enabled: boolean;
    port: number;
    tools: string[];
  };
}

// Indexing types
export interface IndexedFile {
  path: string;
  content: string;
  metadata: {
    type: string;
    size: number;
    lastModified: number;
  };
}

export interface TextChunk {
  id: string;
  content: string;
  embedding?: number[];
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

export interface IndexStats {
  totalFiles: number;
  totalChunks: number;
  totalSize: number;
  indexedAt: number;
  fileTypes: Record<string, number>;
}

// Git types
export interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

export interface ProjectStats {
  branch: string;
  totalCommits: number;
  latestCommits: CommitInfo[];
  totalLOC: number;
  fileCount: number;
}

// RAG types
export interface SearchResult {
  content: string;
  source: string;
  similarity: number;
  metadata: TextChunk['metadata'];
}

export interface AnswerWithSources {
  answer: string;
  sources: SearchResult[];
  confidence: number;
  toolsUsed?: string[]; // Tools that were invoked to generate this answer
  usedTools?: boolean; // Indicate if MCP tools were used
}

// Conversation types
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: SearchResult[];
}

export interface Conversation {
  id: string;
  messages: Message[];
  projectContext: ProjectContext;
  createdAt: number;
}

// Project context
export interface ProjectContext {
  name: string;
  description: string;
  branch: string;
  recentCommits: CommitInfo[];
  stats: {
    files: number;
    loc: number;
    chunks: number;
  };
}
