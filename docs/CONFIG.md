# Configuration Guide

This document describes all available configuration options in `projectConfig.json`.

## Full Configuration Example

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
    "includeFolders": ["src", "docs"],
    "excludeFolders": ["node_modules", ".git", "build", "dist"],
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
    "system": "You are a code assistant for {projectName}...",
    "language": "en"
  }
}
```

## Configuration Options

### Root Level

#### `projectName` (string, required)
The name of your project. Used in prompts and logs.

#### `projectDescription` (string, required)
A short description of what your project does.

### paths

Configuration for file and directory paths.

#### `paths.root` (string, default: ".")
Root directory of your project. Usually the current directory.

#### `paths.git` (string, default: ".")
Path to the git repository. Usually same as root.

#### `paths.output` (string, default: "node_modules/.code-assistant")
Where to store the index cache. Should be in .gitignore.

### indexing

Controls which files are indexed and how they're split into chunks.

#### `indexing.includeFolders` (array of strings)
Folders to index. Examples:
- `["src", "lib", "app"]` - Index source code
- `["src", "docs"]` - Index code and documentation
- `["packages"]` - For monorepos, index all packages

#### `indexing.excludeFolders` (array of strings)
Folders to skip. Common exclusions:
- `node_modules` - npm packages
- `.git` - git metadata
- `build`, `dist` - compiled output
- `.next`, `.nuxt`, `.vercel` - build caches
- `coverage` - test coverage reports

#### `indexing.includeFileTypes` (array of strings)
File extensions to index. Examples:
- `[".ts", ".tsx", ".js"]` - TypeScript/JavaScript
- `[".py"]` - Python
- `[".md"]` - Markdown
- `[".json"]` - JSON config files

#### `indexing.excludePatterns` (array of strings)
Glob patterns to exclude. Examples:
- `"*.test.*"` - Exclude test files
- `"*.min.js"` - Exclude minified files
- `"*.spec.*"` - Exclude spec files

#### `indexing.maxFileSize` (string, default: "1MB")
Maximum file size to index. Format: `"1MB"`, `"500KB"`, `"2MB"`

Useful to skip large generated files or logs.

#### `indexing.chunkSize` (number, default: 400)
Number of words per chunk. Larger = more context but fewer chunks.

Recommended: 300-500

#### `indexing.chunkOverlap` (number, default: 100)
Number of overlapping words between chunks. Helps with context continuity.

Recommended: 50-150

### git

Git integration options.

#### `git.enabled` (boolean, default: true)
Enable git information in the assistant (branch, commits, history).

#### `git.includeCommitHistory` (boolean, default: true)
Fetch and display commit history. Useful for understanding recent changes.

#### `git.maxCommitsToFetch` (number, default: 50)
Maximum number of commits to fetch. Set lower for faster startup.

### llm

LLM configuration.

#### `llm.model` (string, default: "llama3.2")
The LLM model to use. Examples:
- `"llama3.2"` - Ollama
- `"mistral"` - Ollama
- `"neural-chat"` - Ollama
- `"gpt-4"` - OpenAI (if integrated)

#### `llm.temperature` (number, default: 0.2)
Controls randomness of responses. Range: 0.0-1.0
- `0.0` - Deterministic (best for code)
- `0.5` - Balanced
- `1.0` - Creative

For code assistant, keep it low (0.2-0.3).

#### `llm.topP` (number, default: 0.8)
Alternative to temperature. Controls diversity via nucleus sampling.

#### `llm.contextWindow` (number, default: 20)
Number of previous messages to include in context. Helps maintain conversation flow.

#### `llm.maxResults` (number, default: 5)
Maximum number of code chunks to include in context for each question.

### prompt

Prompt configuration.

#### `prompt.system` (string)
The system prompt that defines the assistant's behavior.

Available placeholders:
- `{projectName}` - Replaced with projectName

Example:
```
"You are a helpful code assistant for {projectName}. Help developers understand the codebase, explain architecture, suggest implementations. Always cite sources with [1], [2], etc."
```

#### `prompt.language` (string, default: "en")
Response language. Examples: "en", "es", "fr", "de", "ru"

## Template Configurations

We provide pre-configured templates in the `templates/` folder:

### Default Project
```bash
cp templates/config-default.json projectConfig.json
```

### Web Application (React, Vue, Angular)
```bash
cp templates/config-web.json projectConfig.json
```

### Backend Service
```bash
cp templates/config-backend.json projectConfig.json
```

### Monorepo (Lerna, Turborepo, pnpm workspaces)
```bash
cp templates/config-monorepo.json projectConfig.json
```

## Best Practices

1. **Start simple**: Use default config, then customize as needed
2. **Exclude build outputs**: Always exclude `dist`, `build`, `.next`, etc.
3. **Adjust chunk size**: Smaller chunks for larger projects, larger for smaller ones
4. **Set reasonable maxFileSize**: Prevents indexing huge generated files
5. **Use templates**: Start with a template that matches your project type
6. **Re-index regularly**: After major code changes, run `mca index` again

## Troubleshooting

### Too many chunks / slow search
- Reduce `chunkSize` or `chunkOverlap`
- Exclude more files with `excludePatterns`
- Reduce `includeFileTypes` to necessary extensions only

### Missing important files
- Check `includeFolders` includes your source directories
- Verify file extensions are in `includeFileTypes`
- Check `excludePatterns` doesn't accidentally exclude them

### Poor answer quality
- Increase `maxResults` to provide more context
- Adjust `temperature` to 0.0-0.3 for more factual answers
- Improve `system` prompt with project-specific guidance
