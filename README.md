# My Code Assistant

A universal code assistant framework that can be integrated into **any project**. It uses RAG (Retrieval Augmented Generation) to understand your codebase and help you navigate, understand, and develop features faster.

## 🎯 What It Does

My Code Assistant:
- **Indexes** your codebase and documentation
- **Understands** your project structure through git
- **Answers** questions about your code with citations
- **Helps** with understanding architecture, debugging, and implementing features
- **Works** with any language or project type

## 🚀 Quick Start

```bash
# Install globally
npm install -g my-code-assistant

# Initialize in your project
cd your-project
mca init

# Index your code
mca index

# Start chatting!
mca chat
```

## 💡 Example Usage

```
You: How does authentication work in this project?
Assistant: Authentication uses JWT tokens stored in httpOnly cookies:
  [1] src/auth/jwtService.ts - JWT generation and validation
  [2] src/middleware/auth.ts - Route protection middleware
  [3] src/api/login.ts - Login endpoint implementation
Confidence: 92%

You: Where's the database schema?
Assistant: Database models are in src/models/:
  [1] src/models/User.ts - User model with validation
  [2] src/models/Message.ts - Message storage structure
  [3] src/models/index.ts - Database configuration
Confidence: 88%
```

## ✨ Features

### Core Features
- ✅ **Code Indexing** - Automatically index any codebase
- ✅ **RAG Search** - Find relevant code chunks by semantic similarity
- ✅ **Git Integration** - Understand project history and branches
- ✅ **Interactive Chat** - Ask questions, get answers with sources
- ✅ **Project Context** - Automatic project structure detection

### Chat Commands
- `/help` - Show available commands
- `/git` - View git status and recent commits
- `/history` - See conversation history
- `/context` - View project information
- `/clear` - Clear conversation
- `/exit` - Exit the chat

### Configuration
- **Universal** - Works with any language (TypeScript, Python, Go, etc.)
- **Flexible** - Choose what to index (folders, file types)
- **Configurable** - Customize via `projectConfig.json`
- **Templates** - Pre-built configs for common project types

## 📋 Project Types

Pre-configured templates for:
- Default projects
- Web applications (React, Vue, Angular)
- Backend services (Node, Python, Java)
- Monorepos (Lerna, Turborepo, pnpm)

## 🛠️ Installation Options

### Option 1: Global Installation

```bash
npm install -g my-code-assistant
mca init
mca index
mca chat
```

### Option 2: Local Installation

```bash
npm install my-code-assistant --save-dev
npx mca init
npx mca index
npx mca chat
```

### Option 3: As a Library

```bash
npm install my-code-assistant
```

```typescript
import { CodeAssistant } from 'my-code-assistant';

const config = { /* ... */ };
const assistant = new CodeAssistant(config);
await assistant.initialize();
const answer = await assistant.ask('How does auth work?');
```

## 📚 Documentation

- [**SETUP.md**](./docs/SETUP.md) - Installation and quick start
- [**CONFIG.md**](./docs/CONFIG.md) - Configuration options and templates
- [**ARCHITECTURE.md**](./docs/ARCHITECTURE.md) - Technical architecture
- [**EXAMPLES.md**](./docs/EXAMPLES.md) - Real-world usage examples
- [**API.md**](./docs/API.md) - TypeScript API reference

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│      ChatBotCLI (CLI UI)       │
└──────────────────┬──────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    ┌───▼────────┐    ┌──────▼────┐
    │  CodeAss.  │    │ RAGQuery  │
    └───┬────────┘    └──────┬────┘
        │                    │
    ┌───┴───────────────────┴────┐
    │                            │
 ┌──▼────────┐   ┌──────────┐   │
 │  Indexer  │   │Git Helper│   │
 └───────────┘   └──────────┘   │
                                │
              ┌─────────────────┴───┐
              │                     │
         ┌────▼────┐           ┌───▼──┐
         │Chunks   │           │Cache │
         └─────────┘           └──────┘
```

## 🔄 Workflow

1. **Initialize** - `mca init` creates `projectConfig.json`
2. **Index** - `mca index` reads and chunks your code
3. **Chat** - `mca chat` starts interactive assistant
4. **Ask** - Type questions, get answers with sources

## ⚙️ Configuration

Create `projectConfig.json`:

```json
{
  "projectName": "my-project",
  "projectDescription": "My awesome project",

  "paths": {
    "root": ".",
    "git": ".",
    "output": "node_modules/.code-assistant"
  },

  "indexing": {
    "includeFolders": ["src", "lib"],
    "excludeFolders": ["node_modules", ".git", "dist"],
    "includeFileTypes": [".ts", ".tsx", ".js", ".md"],
    "excludePatterns": ["*.test.*", "*.spec.*"],
    "maxFileSize": "1MB",
    "chunkSize": 400,
    "chunkOverlap": 100
  },

  "git": {
    "enabled": true,
    "includeCommitHistory": true,
    "maxCommitsToFetch": 50
  },

  "llm": {
    "model": "llama3.2",
    "temperature": 0.2,
    "topP": 0.8,
    "contextWindow": 20,
    "maxResults": 5
  },

  "prompt": {
    "system": "You are a code assistant for {projectName}. Help developers understand the codebase...",
    "language": "en"
  }
}
```

Or use templates:

```bash
cp templates/config-web.json projectConfig.json     # Web apps
cp templates/config-backend.json projectConfig.json # Backend
cp templates/config-monorepo.json projectConfig.json # Monorepos
```

## 🎬 Real-World Examples

### Understanding Architecture
```
You: What's the overall architecture?
Assistant: [explains with 3-5 source citations]
```

### Debugging
```
You: Why does auth fail sometimes?
Assistant: [identifies issue with specific file references]
```

### Implementation Help
```
You: How do I add email notifications?
Assistant: [guides through existing patterns and files]
```

See [EXAMPLES.md](./docs/EXAMPLES.md) for more scenarios.

## 🔧 Technology Stack

- **TypeScript** - Type-safe implementation
- **LangChain** - RAG and LLM integration (optional)
- **Ollama** - Local LLM backend (optional, recommended)
- **Chalk** - Colored terminal output
- **Inquirer** - Interactive CLI prompts

## 📦 What's Included

```
my-code-assistant/
├── src/                          # Source code
│   ├── types/                   # TypeScript interfaces
│   ├── rag/                     # RAG pipeline & conversation
│   ├── projectIndexer.ts        # Code indexing
│   ├── gitHelper.ts             # Git integration
│   ├── codeAssistant.ts         # Main orchestrator
│   ├── chatbot.ts               # CLI interface
│   └── index.ts                 # Exports
├── bin/cli.js                   # CLI entry point
├── templates/                   # Config templates
├── docs/                        # Documentation
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 Use Cases

1. **Onboarding** - New developer understanding codebase
2. **Navigation** - Finding relevant files and features
3. **Debugging** - Understanding error flows and root causes
4. **Documentation** - Generating docs from code
5. **Refactoring** - Understanding impact of changes
6. **Feature Development** - Finding where to add new code
7. **Code Review** - Understanding what reviewer is seeing

## 🚦 Requirements

- Node.js 18+
- npm or yarn
- Git repository (optional but recommended)
- Ollama or other LLM (for actual LLM responses)

## 🔄 Upcoming Features

- Semantic search with embeddings
- Web UI for management
- Watch mode for auto-reindexing
- Database backend for large projects
- Real LLM integration
- Multi-language support
- Plugin system
- Distributed indexing

## 💬 Chat Commands

```
/help      - Show available commands
/git       - Git status and recent commits
/history   - Conversation history
/context   - Project information
/clear     - Clear conversation
/exit      - Exit chat
```

## 🐛 Troubleshooting

### "projectConfig.json not found"
Run `mca init` first to create the configuration.

### "No chunks found"
Run `mca index` after initialization.

### Poor search results
- Increase `maxResults` in LLM config
- Adjust `chunkSize` (try 200-600 words)
- Improve `system` prompt with domain knowledge

### Chat doesn't respond
- Ensure `indexing.includeFolders` contains files
- Check that `indexing.includeFileTypes` matches your files
- Verify Ollama is running (if using local LLM)

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for technical details.

## 📞 Support

- Check [documentation](./docs/)
- Review [examples](./docs/EXAMPLES.md)
- Read [API reference](./docs/API.md)

## 🎓 Learning Resources

- **Architecture** - [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Setup** - [SETUP.md](./docs/SETUP.md)
- **Configuration** - [CONFIG.md](./docs/CONFIG.md)
- **Examples** - [EXAMPLES.md](./docs/EXAMPLES.md)
- **API** - [API.md](./docs/API.md)

---

**Happy coding! 🚀**

Built with ❤️ for developers who want to understand their code better.
