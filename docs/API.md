# TypeScript API Reference

This document describes the TypeScript API for programmatic use of My Code Assistant.

## Installation

```bash
npm install my-code-assistant
```

## Quick Start

```typescript
import { CodeAssistant, ProjectConfig } from 'my-code-assistant';

// Load or create config
const config: ProjectConfig = {
  projectName: 'my-project',
  projectDescription: 'My project',
  paths: { root: '.', git: '.', output: 'node_modules/.code-assistant' },
  indexing: {
    includeFolders: ['src'],
    excludeFolders: ['node_modules', '.git'],
    includeFileTypes: ['.ts', '.js'],
    excludePatterns: ['*.test.*'],
    maxFileSize: '1MB',
    chunkSize: 400,
    chunkOverlap: 100
  },
  git: { enabled: true, includeCommitHistory: true, maxCommitsToFetch: 50 },
  llm: {
    model: 'llama3.2',
    temperature: 0.2,
    topP: 0.8,
    contextWindow: 20,
    maxResults: 5
  },
  prompt: {
    system: 'You are a code assistant for {projectName}',
    language: 'en'
  }
};

// Initialize assistant
const assistant = new CodeAssistant(config);
await assistant.initialize();

// Ask questions
const answer = await assistant.ask('How does authentication work?');
console.log(answer.answer);
answer.sources.forEach((source, i) => {
  console.log(`[${i+1}] ${source.source}`);
});
```

## Core Classes

### CodeAssistant

Main orchestrator class that combines all components.

#### Constructor

```typescript
constructor(config: ProjectConfig)
```

Creates a new CodeAssistant instance.

**Parameters**:
- `config` - Project configuration object

**Example**:
```typescript
const assistant = new CodeAssistant(config);
```

#### initialize()

```typescript
async initialize(): Promise<void>
```

Initialize the assistant by loading the index and project context.

**Throws**: Error if index doesn't exist and can't be created

**Example**:
```typescript
await assistant.initialize();
```

#### ask()

```typescript
async ask(question: string): Promise<AnswerWithSources>
```

Ask a question and get an answer with sources.

**Parameters**:
- `question` - The question to ask

**Returns**:
```typescript
{
  answer: string,           // The answer text
  sources: SearchResult[],  // Relevant code chunks
  confidence: number        // 0.0 to 1.0
}
```

**Example**:
```typescript
const result = await assistant.ask('How does authentication work?');
console.log(result.answer);
console.log(`Confidence: ${result.confidence}`);
result.sources.forEach(source => {
  console.log(`[${source.source}]`);
});
```

#### getProjectContext()

```typescript
async getProjectContext(): Promise<ProjectContext>
```

Get current project context (branch, commits, stats).

**Returns**:
```typescript
{
  name: string,
  description: string,
  branch: string,
  recentCommits: CommitInfo[],
  stats: {
    files: number,
    loc: number,
    chunks: number
  }
}
```

**Example**:
```typescript
const context = await assistant.getProjectContext();
console.log(`Branch: ${context.branch}`);
console.log(`Files: ${context.stats.files}`);
```

#### reindex()

```typescript
async reindex(): Promise<void>
```

Re-create the project index from scratch.

**Example**:
```typescript
await assistant.reindex();
```

#### getConversationHistory()

```typescript
getConversationHistory(): string
```

Get formatted conversation history.

**Returns**: Formatted string of recent messages

**Example**:
```typescript
const history = assistant.getConversationHistory();
console.log(history);
```

#### clearConversation()

```typescript
clearConversation(): void
```

Clear the conversation history.

**Example**:
```typescript
assistant.clearConversation();
```

#### getGitStatus()

```typescript
async getGitStatus(): Promise<string>
```

Get current git status.

**Returns**: Git status output

**Example**:
```typescript
const status = await assistant.getGitStatus();
console.log(status);
```

---

### ProjectIndexer

Handles code indexing and chunk creation.

#### Constructor

```typescript
constructor(config: ProjectConfig)
```

Create a new indexer instance.

#### indexProject()

```typescript
async indexProject(): Promise<void>
```

Index the entire project.

**Example**:
```typescript
const indexer = new ProjectIndexer(config);
await indexer.indexProject();
```

#### reindex()

```typescript
async reindex(): Promise<void>
```

Re-index the project.

#### getIndexStats()

```typescript
getIndexStats(): IndexStats
```

Get indexing statistics.

**Returns**:
```typescript
{
  totalFiles: number,
  totalChunks: number,
  totalSize: number,
  indexedAt: number,
  fileTypes: Record<string, number>
}
```

#### getChunks()

```typescript
getChunks(): TextChunk[]
```

Get all indexed chunks.

**Returns**: Array of text chunks with metadata

---

### GitHelper

Retrieves git repository information.

#### Constructor

```typescript
constructor(repoPath: string)
```

Create a new GitHelper instance.

#### getCurrentBranch()

```typescript
async getCurrentBranch(): Promise<string>
```

Get current git branch.

**Example**:
```typescript
const branch = await git.getCurrentBranch();
console.log(`Current branch: ${branch}`);
```

#### getLastCommits()

```typescript
async getLastCommits(count: number): Promise<CommitInfo[]>
```

Get recent commits.

**Parameters**:
- `count` - Number of commits to fetch

**Returns**: Array of commit information

**Example**:
```typescript
const commits = await git.getLastCommits(5);
commits.forEach(commit => {
  console.log(`${commit.hash} - ${commit.message}`);
});
```

#### getFileHistory()

```typescript
async getFileHistory(filepath: string): Promise<CommitInfo[]>
```

Get history of specific file.

**Parameters**:
- `filepath` - Path to the file

**Returns**: Commit history for that file

#### getProjectStats()

```typescript
async getProjectStats(): Promise<ProjectStats>
```

Get overall project statistics.

**Returns**:
```typescript
{
  branch: string,
  totalCommits: number,
  latestCommits: CommitInfo[],
  totalLOC: number,
  fileCount: number
}
```

#### getStatus()

```typescript
async getStatus(): Promise<string>
```

Get git status output.

---

### RAGPipeline

Handles search and prompt generation.

#### setChunks()

```typescript
setChunks(chunks: TextChunk[]): void
```

Set indexed chunks.

#### setModel()

```typescript
setModel(model: string): void
```

Set LLM model name.

#### search()

```typescript
search(query: string, maxResults?: number): SearchResult[]
```

Search for relevant chunks.

**Parameters**:
- `query` - Search query
- `maxResults` - Maximum results to return (default: 5)

**Returns**: Array of search results with metadata

**Example**:
```typescript
const results = rag.search('how does auth work', 5);
results.forEach((result, i) => {
  console.log(`[${i+1}] ${result.source} (${(result.similarity * 100).toFixed(1)}%)`);
  console.log(result.content);
});
```

#### formatContext()

```typescript
formatContext(results: SearchResult[]): string
```

Format search results into a string for LLM context.

**Example**:
```typescript
const context = rag.formatContext(results);
```

#### createPrompt()

```typescript
createPrompt(
  systemPrompt: string,
  question: string,
  context: string
): string
```

Create a complete LLM prompt with context.

**Returns**: Formatted prompt string

---

### ConversationManager

Manages conversation state and history.

#### Constructor

```typescript
constructor(projectContext: ProjectContext)
```

Create a new conversation manager.

#### addUserMessage()

```typescript
addUserMessage(content: string): void
```

Add a user message to conversation.

#### addAssistantMessage()

```typescript
addAssistantMessage(
  content: string,
  sources?: SearchResult[]
): void
```

Add an assistant message to conversation.

#### getHistory()

```typescript
getHistory(lastN?: number): string
```

Get formatted conversation history.

**Parameters**:
- `lastN` - Number of recent messages (default: 5)

**Returns**: Formatted conversation string

#### getMessages()

```typescript
getMessages(): Message[]
```

Get all raw messages.

#### getConversation()

```typescript
getConversation(): Conversation
```

Get full conversation object.

#### clear()

```typescript
clear(): void
```

Clear all messages.

#### getSummary()

```typescript
getSummary(): string
```

Get conversation summary.

---

### ChatBotCLI

Interactive command-line interface.

#### Constructor

```typescript
constructor(assistant: CodeAssistant)
```

Create a new chatbot instance.

#### start()

```typescript
async start(): Promise<void>
```

Start interactive chat loop.

**Example**:
```typescript
const chatbot = new ChatBotCLI(assistant);
await chatbot.start();
```

---

## Interfaces

### ProjectConfig

Complete project configuration.

```typescript
interface ProjectConfig {
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
}
```

### SearchResult

```typescript
interface SearchResult {
  content: string;
  source: string;
  similarity: number;
  metadata: TextChunk['metadata'];
}
```

### AnswerWithSources

```typescript
interface AnswerWithSources {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}
```

### CommitInfo

```typescript
interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}
```

### ProjectContext

```typescript
interface ProjectContext {
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
```

---

## Usage Examples

### Example 1: Basic Usage

```typescript
import { CodeAssistant } from 'my-code-assistant';

const assistant = new CodeAssistant({
  projectName: 'my-project',
  projectDescription: 'My project',
  // ... rest of config
});

await assistant.initialize();
const result = await assistant.ask('How does auth work?');
console.log(result.answer);
```

### Example 2: Building a Custom Interface

```typescript
import { CodeAssistant, ChatBotCLI } from 'my-code-assistant';

const assistant = new CodeAssistant(config);
await assistant.initialize();

// Create custom CLI
const messages = [];
while (true) {
  const question = await getUserInput();
  const result = await assistant.ask(question);
  messages.push({
    question,
    answer: result.answer,
    sources: result.sources
  });

  displayAnswer(result);
}
```

### Example 3: Batch Processing

```typescript
const questions = [
  'What is the architecture?',
  'How does authentication work?',
  'Where is error handling?'
];

for (const q of questions) {
  const result = await assistant.ask(q);
  console.log(`Q: ${q}`);
  console.log(`A: ${result.answer}\n`);
}
```

### Example 4: Accessing Project Information

```typescript
const context = await assistant.getProjectContext();
const status = await assistant.getGitStatus();

console.log(`Project: ${context.name}`);
console.log(`Branch: ${context.branch}`);
console.log(`Files: ${context.stats.files}`);
console.log(`LOC: ${context.stats.loc}`);
console.log(`Git status:\n${status}`);
```

---

## Error Handling

All async methods can throw errors. Wrap in try-catch:

```typescript
try {
  await assistant.initialize();
  const result = await assistant.ask('What is X?');
  console.log(result.answer);
} catch (error) {
  console.error('Error:', error);
}
```

---

## Advanced Configuration

### Custom Indexing

```typescript
const config: ProjectConfig = {
  // ...
  indexing: {
    // Large project - bigger chunks
    chunkSize: 800,
    chunkOverlap: 200,
    // Only index specific file types
    includeFileTypes: ['.ts', '.tsx'],
    // Skip test files
    excludePatterns: ['**/*.test.ts', '**/*.spec.ts']
  }
};
```

### Custom Prompt

```typescript
const config: ProjectConfig = {
  // ...
  prompt: {
    system: `You are an expert developer for {projectName}.
             Answer questions about the codebase.
             Be concise and cite sources.
             Use technical language.`,
    language: 'en'
  }
};
```

---

## Performance Tuning

### For Large Projects

```typescript
const config: ProjectConfig = {
  indexing: {
    // Larger chunks = fewer chunks
    chunkSize: 600,
    // Less overlap = faster search
    chunkOverlap: 50,
    // Skip large files
    maxFileSize: '500KB',
    // Exclude build artifacts
    excludeFolders: ['dist', 'build', '.next', 'node_modules']
  },
  llm: {
    // Return fewer results per query
    maxResults: 3,
    // Smaller context window
    contextWindow: 10
  }
};
```

### For Small Projects

```typescript
const config: ProjectConfig = {
  indexing: {
    // Smaller chunks = more chunks but better context
    chunkSize: 200,
    // More overlap for continuity
    chunkOverlap: 150,
    // Include everything
    maxFileSize: '10MB'
  },
  llm: {
    // More results for comprehensive answers
    maxResults: 10,
    // Larger context window
    contextWindow: 30
  }
};
```

