# @nikita-bekish/code-assistant

🤖 AI-powered code assistant CLI with RAG (Retrieval-Augmented Generation), LLM classification, and MCP tools for frontend development.

## Features

- 🔍 **Semantic Search** - Find relevant code using RAG with vector embeddings
- 💬 **Interactive Chat** - Ask questions about your codebase
- 🏷️ **Smart Classification** - LLM-based question routing (git/crm/tasks/rag)
- 🛠️ **MCP Tools** - Model Context Protocol for git operations, CRM, and task management
- 📊 **Project Analysis** - Automatic indexing and code understanding
- 🎯 **Frontend Focus** - Optimized for JavaScript/TypeScript projects

## Requirements

- **Node.js** >= 18.0.0
- **Ollama** - Local LLM runtime ([Installation guide](https://ollama.ai/))
  ```bash
  # Install Ollama
  curl https://ollama.ai/install.sh | sh
  
  # Pull required models
  ollama pull llama3.2
  ollama pull nomic-embed-text
  ```

## Installation

### Global (recommended)

```bash
npm install -g @nikita-bekish/code-assistant
```

### Local

```bash
npm install @nikita-bekish/code-assistant
npx code-assistant --help
```

## Quick Start

1. **Initialize in your project:**
```bash
cd your-project
code-assistant init
```

2. **Index your codebase:**
```bash
code-assistant index
```

3. **Start chatting:**
```bash
code-assistant chat
```

## Commands

### `code-assistant init`
Initialize configuration in your project.

```bash
code-assistant init
```

Creates `.code-assistant-config.json` with default settings.

### `code-assistant index`
Index your codebase for semantic search.

```bash
code-assistant index
```

Options:
- Indexes all files according to `.code-assistant-config.json`
- Generates embeddings using Ollama
- Stores chunks in `node_modules/.code-assistant/`

### `code-assistant chat`
Start interactive chat session.

```bash
code-assistant chat
```

Example questions:
- "How does authentication work?"
- "Show me high priority tasks"
- "What is the current git status?"
- "List all open tickets for user_1"

### `code-assistant reindex`
Reindex the project (use after major code changes).

```bash
code-assistant reindex
```

## Configuration

`.code-assistant-config.json` example:

```json
{
  "projectName": "My Project",
  "projectDescription": "A modern web application",
  "indexing": {
    "includeFolders": ["src", "lib"],
    "excludeFolders": ["node_modules", "dist", ".git"],
    "includeFileTypes": ["js", "ts", "jsx", "tsx", "vue", "svelte"],
    "chunkSize": 1024,
    "chunkOverlap": 256
  },
  "llm": {
    "model": "llama3.2",
    "temperature": 0.7,
    "maxResults": 5
  },
  "embedding": {
    "model": "nomic-embed-text",
    "provider": "ollama"
  }
}
```

## Features Overview

### 🔍 RAG (Retrieval-Augmented Generation)
- Semantic code search using vector embeddings
- Context-aware answers based on your codebase
- Conversation memory for follow-up questions

### 🏷️ Smart Question Classification
- Automatic routing: git → crm → tasks → rag
- LLM-based classification for ambiguous questions
- Heuristics for fast obvious cases

### 🛠️ MCP Tools
**Git Tools:**
- `git_branch` - Get current branch
- `git_status` - Show repository status

**CRM Tools:**
- `get_user` - User information
- `list_tickets` - User tickets
- `create_ticket` - New support ticket
- `update_ticket` - Update ticket status

**Tasks Tools:**
- `list_tasks` - Team tasks with filters
- `create_task` - New task
- `update_task` - Update task status

## Examples

### Basic Usage

```bash
# Initialize and index
code-assistant init
code-assistant index

# Ask about code
code-assistant chat
> How does authentication work in this project?

# Ask about tasks
> Show me high priority tasks
```

### With OpenAI (optional)

```bash
export OPENAI_API_KEY=your_key_here
code-assistant chat
```

## Troubleshooting

### "Ollama not found"
Install Ollama from https://ollama.ai/

### "Model not found"
Pull required models:
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

### "No index found"
Run indexing first:
```bash
code-assistant index
```

### Slow responses
- Reduce `chunkSize` in config
- Use smaller LLM model
- Consider using OpenAI API

## Development

```bash
# Clone repository
git clone https://github.com/nikita-bekish/my-code-assistant.git
cd my-code-assistant

# Install dependencies
npm install

# Build
npm run build

# Test locally
npm link
code-assistant --help
```

## License

MIT © Nikita Bekish

## Links

- [GitHub](https://github.com/nikita-bekish/my-code-assistant)
- [Issues](https://github.com/nikita-bekish/my-code-assistant/issues)
- [npm](https://www.npmjs.com/package/@nikita-bekish/code-assistant)
