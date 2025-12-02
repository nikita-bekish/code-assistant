# My Code Assistant - Setup Guide

## Overview

My Code Assistant is a universal code assistant framework that can be integrated into any project. It uses RAG (Retrieval Augmented Generation) to understand your codebase and provide context-aware answers.

## Installation

### Option 1: Global Installation

```bash
npm install -g my-code-assistant
```

Then in your project:

```bash
mca init
```

### Option 2: Local Installation

```bash
npm install my-code-assistant --save-dev
```

Then update your `package.json` scripts:

```json
{
  "scripts": {
    "mca:init": "mca init",
    "mca:index": "mca index",
    "mca:chat": "mca chat"
  }
}
```

## Quick Start

### Step 1: Initialize Project

```bash
mca init
```

This will interactively ask you:

- Project name
- Project description
- Folders to index
- LLM model to use

It creates a `projectConfig.json` file.

### Step 2: Index Your Codebase

```bash
mca index
```

This will:

- Read all files in included folders
- Create text chunks for RAG
- Save the index to `node_modules/.code-assistant`

### Step 3: Start Chatting

```bash
mca chat
```

You can now ask questions about your codebase!

## Configuration

The project is configured via `projectConfig.json`. See [CONFIG.md](./CONFIG.md) for all options.

## Project Structure

After initialization, you'll have:

```
your-project/
├── projectConfig.json          # Project configuration
├── node_modules/
│   └── .code-assistant/        # Index cache
│       ├── chunks.json
│       └── stats.json
└── ...
```

## Requirements

- Node.js 18+
- npm or yarn
- A git repository (optional, but recommended)
- Ollama or other LLM backend (for actual LLM integration)

## Environment Setup

### For Ollama Users

1. Install Ollama from https://ollama.ai
2. Run Ollama: `ollama serve`
3. In another terminal, pull a model: `ollama pull llama3.2`

Then use `mca chat` to interact with your code assistant.

## CLI Commands

```bash
mca init          # Initialize a new project configuration
mca index         # Index the project codebase
mca chat          # Start interactive chat
mca help          # Show help message
```

## Chat Commands

Inside the chat, you can use:

```
/help             # Show available commands
/git              # Show git status and recent commits
/history          # Show conversation history
/context          # Show project context
/clear            # Clear conversation history
/exit             # Exit the assistant
```

## Troubleshooting

### Issue: "projectConfig.json not found"

Solution: Run `mca init` first to create the configuration.

### Issue: "No chunks found"

Solution: Make sure you ran `mca index` after initialization, and that your included folders contain files with the right extensions.

### Issue: Chat doesn't respond

Solution: Check that your LLM backend (Ollama) is running and the model is available.

## Next Steps

- Read [CONFIG.md](./CONFIG.md) for advanced configuration
- Check [EXAMPLES.md](./EXAMPLES.md) for usage examples
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
