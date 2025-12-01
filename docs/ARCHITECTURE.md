# Architecture Guide

## Overview

My Code Assistant is built on a modular architecture with four main components:

```
┌─────────────────────────────────────────────────┐
│           ChatBotCLI (Interactive UI)           │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│         CodeAssistant (Orchestrator)            │
├──────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐             │
│  │ ProjectIndex │  │  GitHelper   │             │
│  │     er       │  │              │             │
│  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ RAG Pipeline │  │  Conversation│             │
│  │              │  │   Manager    │             │
│  └──────────────┘  └──────────────┘             │
└──────────────────────────────────────────────────┘
```

## Component Details

### 1. ProjectIndexer

**File**: `src/projectIndexer.ts`

Responsible for:
- Reading `projectConfig.json`
- Traversing included folders
- Filtering files by extension, size, and patterns
- Splitting files into text chunks
- Saving index to disk

**Key Methods**:
- `indexProject()` - Create/update the index
- `reindex()` - Re-create the index
- `getIndexStats()` - Get indexing statistics
- `getChunks()` - Get all indexed chunks

**Process**:

```
1. Read projectConfig.json
2. For each includeFolders:
   - Recursively traverse directory
   - Filter by excludeFolders, excludePatterns
   - Filter by includeFileTypes, maxFileSize
3. Read file contents
4. Split into chunks (with overlap)
5. Save chunks.json and stats.json
```

### 2. GitHelper

**File**: `src/gitHelper.ts`

Responsible for:
- Getting git repository information
- Retrieving commit history
- File history tracking
- Project statistics (branch, LOC, file count)

**Key Methods**:
- `getCurrentBranch()` - Get current git branch
- `getLastCommits(count)` - Get recent commits
- `getFileHistory(filepath)` - Get history of a specific file
- `getProjectStats()` - Get overall project statistics
- `getStatus()` - Get current git status

**Note**: Uses `child_process.execSync` to run git commands. No external dependencies needed.

### 3. RAG Pipeline

**File**: `src/rag/ragPipeline.ts`

Responsible for:
- Searching indexed chunks based on user query
- Calculating text similarity
- Formatting search results for LLM context
- Creating prompts with context

**Key Methods**:
- `search(query, maxResults)` - Find relevant chunks
- `formatContext(results)` - Format results into context string
- `createPrompt(systemPrompt, question, context)` - Create LLM prompt

**Search Algorithm**:

Currently uses simple keyword matching with Jaccard similarity:
1. Tokenize query and each chunk
2. Calculate word overlap (Jaccard similarity)
3. Sort by score
4. Return top N results

**Future Improvement**: Replace with semantic search using embeddings.

### 4. ConversationManager

**File**: `src/rag/conversationManager.ts`

Responsible for:
- Maintaining conversation history
- Adding user and assistant messages
- Formatting conversation for context
- Providing conversation summary

**Key Methods**:
- `addUserMessage(content)` - Add user message
- `addAssistantMessage(content, sources)` - Add assistant message
- `getHistory(lastN)` - Get recent conversation history
- `getMessages()` - Get all messages
- `clear()` - Clear conversation

### 5. CodeAssistant

**File**: `src/codeAssistant.ts`

Orchestrates all components. This is the main API.

**Key Methods**:
- `initialize()` - Load index, get context
- `ask(question)` - Ask a question, get answer with sources
- `getProjectContext()` - Get project information
- `reindex()` - Re-create the index
- `getConversationHistory()` - Get chat history
- `clearConversation()` - Clear chat history
- `getGitStatus()` - Get git status

**Flow for asking a question**:

```
1. User asks question
2. ConversationManager.addUserMessage()
3. RAGPipeline.search() finds relevant code chunks
4. RAGPipeline.formatContext() formats results
5. RAGPipeline.createPrompt() creates LLM prompt
6. LLM generates answer (placeholder in MVP)
7. ConversationManager.addAssistantMessage()
8. Return answer with sources
```

### 6. ChatBotCLI

**File**: `src/chatbot.ts`

Responsible for:
- Interactive command-line interface
- User input handling
- Pretty-printed output
- Built-in commands (/help, /git, /history, etc.)

**Key Methods**:
- `start()` - Start the chat loop
- `_handleCommand(command)` - Process CLI commands

**Built-in Commands**:
- `/help` - Show help
- `/git` - Show git status
- `/history` - Show conversation
- `/context` - Show project context
- `/clear` - Clear conversation
- `/exit` - Exit chat

## Data Flow

### Initialization Flow

```
User runs: mca init
    ↓
CLI asks questions (name, folders, model)
    ↓
Creates projectConfig.json
```

### Indexing Flow

```
User runs: mca index
    ↓
CLI reads projectConfig.json
    ↓
ProjectIndexer traverses folders
    ↓
Files filtered, content read
    ↓
Split into chunks with overlap
    ↓
Save chunks.json and stats.json
    ↓
Display statistics
```

### Chat Flow

```
User runs: mca chat
    ↓
CodeAssistant.initialize()
  ├─ Load chunks from chunks.json
  ├─ Get project context (git stats)
  └─ Initialize ConversationManager
    ↓
ChatBotCLI.start()
  └─ Display project info
    ↓
User asks question
    ↓
CodeAssistant.ask()
  ├─ RAGPipeline.search() - find relevant chunks
  ├─ Format context
  ├─ Create prompt
  ├─ Call LLM (placeholder)
  └─ ConversationManager.addMessage()
    ↓
Display answer with sources
```

## File Structure

```
src/
├── types/
│   └── index.ts                 # TypeScript interfaces
├── rag/
│   ├── ragPipeline.ts          # Search and prompt creation
│   └── conversationManager.ts  # Conversation state
├── projectIndexer.ts            # Code indexing
├── gitHelper.ts                 # Git integration
├── codeAssistant.ts             # Main orchestrator
├── chatbot.ts                   # CLI interface
└── index.ts                     # Exports

bin/
└── cli.js                       # CLI entry point

templates/
├── config-default.json
├── config-web.json
├── config-backend.json
└── config-monorepo.json

docs/
├── SETUP.md
├── CONFIG.md
├── ARCHITECTURE.md
├── EXAMPLES.md
└── API.md
```

## Design Patterns

### 1. Composition over Inheritance
All components are composed in `CodeAssistant`, not inherited.

### 2. Configuration-Driven
All behavior is driven by `projectConfig.json`, making the tool reusable.

### 3. Async/Await
All I/O operations are async for better performance.

### 4. Error Handling
Errors are caught gracefully with user-friendly messages.

### 5. Separation of Concerns
Each component has a single responsibility:
- Indexing: ProjectIndexer
- Git info: GitHelper
- Search: RAGPipeline
- Conversation: ConversationManager
- Orchestration: CodeAssistant
- UI: ChatBotCLI

## Key Design Decisions

### 1. Simple Keyword Search (not embeddings)
**Why**: Avoids external dependencies and API costs
**Trade-off**: Less semantic understanding than embedding-based search

### 2. Text Chunks (not AST)
**Why**: Works with any language, simpler implementation
**Trade-off**: Less precise than proper code analysis

### 3. Git via execSync (not git library)
**Why**: No external dependencies
**Trade-off**: Requires git to be installed

### 4. LLM as placeholder
**Why**: Allows easy integration with any LLM later
**Trade-off**: MVP doesn't use actual LLM

## Future Improvements

1. **Semantic Search**: Use embeddings (ollama, openai) for better search
2. **Code Analysis**: Parse AST for better understanding
3. **Web UI**: Web interface instead of CLI-only
4. **Plugin System**: Allow custom analyzers
5. **Watch Mode**: Auto-reindex on file changes
6. **Database Storage**: Use proper database instead of JSON files
7. **Caching**: Cache embeddings and search results
8. **Multi-Language Support**: Better support for different languages
9. **Real LLM Integration**: Connect to ollama, OpenAI, etc.
10. **Distributed Indexing**: Support large monorepos

## Performance Considerations

### Indexing
- **Time**: O(n*m) where n=files, m=avg file size
- **Space**: Stored in chunks.json
- **Optimization**: Can run in background/cron

### Search
- **Time**: O(k*c) where k=chunks, c=chunk size (linear scan)
- **Optimization**: Could use inverted index for O(log k)

### Chat
- **Memory**: Keeps last 50 messages
- **Network**: No external calls in MVP

## Testing Strategy

**Unit Tests**:
- ProjectIndexer file filtering
- GitHelper command parsing
- RAGPipeline similarity calculation
- ConversationManager message handling

**Integration Tests**:
- Full workflow: init -> index -> chat
- Error scenarios: missing config, empty folders

**Manual Testing**:
- Test with different project types
- Test with different configurations
