#!/usr/bin/env node

import chalk from "chalk";
import fs from "fs/promises";
import inquirer from "inquirer";
import path from "path";
import { fileURLToPath } from "url";
import {
  ChatBotCLI,
  CodeAssistant,
  ProjectIndexer,
} from "../dist/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CONFIG = {
  projectName: "my-project",
  projectDescription: "My project",
  paths: {
    root: ".",
    git: ".",
    output: "node_modules/.code-assistant",
  },
  indexing: {
    includeFolders: ["src", "lib", "docs"],
    excludeFolders: [
      "node_modules",
      ".git",
      "build",
      "dist",
      ".next",
      "venv",
      ".claude",
    ],
    includeFileTypes: [".ts", ".tsx", ".js", ".jsx", ".md", ".json", ".py"],
    excludePatterns: ["*.test.*", "*.spec.*", "*.min.js"],
    maxFileSize: "1MB",
    chunkSize: 400,
    chunkOverlap: 100,
  },
  git: {
    enabled: true,
    includeCommitHistory: true,
    maxCommitsToFetch: 50,
  },
  llm: {
    model: "llama3.2",
    temperature: 0.2,
    topP: 0.8,
    contextWindow: 20,
    maxResults: 5,
  },
  prompt: {
    system:
      "You are a helpful code assistant for {projectName}. Help developers understand the codebase, explain architecture, suggest implementations. Always cite sources.",
    language: "en",
  },
};

async function loadConfig(configPath) {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load config from ${configPath}:`, error);
    process.exit(1);
  }
}

async function saveConfig(config, configPath) {
  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(chalk.green(`✓ Config saved to ${configPath}`));
  } catch (error) {
    console.error(`Failed to save config:`, error);
    process.exit(1);
  }
}

async function initProject() {
  console.log(
    chalk.cyan.bold("\n🚀 My Code Assistant - Project Initialization\n")
  );

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "Project name:",
      default: "my-project",
    },
    {
      type: "input",
      name: "projectDescription",
      message: "Project description:",
      default: "My awesome project",
    },
    {
      type: "checkbox",
      name: "includeFolders",
      message: "Folders to index:",
      choices: [
        "src",
        "lib",
        "app",
        "backend",
        "frontend",
        "components",
        "utils",
        "docs",
      ],
      default: ["src"],
    },
    {
      type: "input",
      name: "model",
      message: "LLM model name:",
      default: "llama3.2",
    },
  ]);

  const config = {
    ...DEFAULT_CONFIG,
    projectName: answers.projectName,
    projectDescription: answers.projectDescription,
    indexing: {
      ...DEFAULT_CONFIG.indexing,
      includeFolders: answers.includeFolders,
    },
    llm: {
      ...DEFAULT_CONFIG.llm,
      model: answers.model,
    },
    services: {
      tasksApiBaseUrl: "http://localhost:3000",
    },
  };

  await saveConfig(config, "projectConfig.json");
  console.log(chalk.green("\n✓ Project initialized successfully!\n"));
}

async function indexProject() {
  console.log(chalk.cyan.bold("\n📚 Indexing Project\n"));

  const config = await loadConfig("projectConfig.json");
  const indexer = new ProjectIndexer(config);

  try {
    console.log("Indexing project...");
    await indexer.indexProject();
    const stats = indexer.getIndexStats();

    console.log(chalk.green("\n✓ Indexing completed!"));
    console.log(chalk.gray(`  Files indexed: ${stats.totalFiles}`));
    console.log(chalk.gray(`  Chunks created: ${stats.totalChunks}`));
    console.log(
      chalk.gray(`  Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`)
    );
    console.log("");
  } catch (error) {
    console.error(chalk.red(`\n✗ Indexing failed: ${error}\n`));
    process.exit(1);
  }
}

async function startChat() {
  console.log(chalk.cyan.bold("\n💬 Starting Chat\n"));

  const config = await loadConfig("projectConfig.json");

  try {
    const assistant = new CodeAssistant(config);
    await assistant.initialize();

    const chatbot = new ChatBotCLI(assistant);
    await chatbot.start();
  } catch (error) {
    console.error(chalk.red(`\n✗ Chat failed: ${error}\n`));
    process.exit(1);
  }
}

async function showHelp() {
  console.log(chalk.cyan.bold("\n🚀 My Code Assistant - CLI\n"));
  console.log(chalk.white("Usage: mca <command>\n"));
  console.log("Commands:");
  console.log(chalk.white("  init     Initialize a new project configuration"));
  console.log(chalk.white("  index    Index the project codebase"));
  console.log(chalk.white("  chat     Start interactive chat"));
  console.log(chalk.white("  help     Show this help message\n"));
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "init":
      await initProject();
      break;
    case "index":
      await indexProject();
      break;
    case "chat":
      await startChat();
      break;
    case "help":
    case "--help":
    case "-h":
      await showHelp();
      break;
    default:
      if (command) {
        console.error(chalk.red(`Unknown command: ${command}`));
      }
      await showHelp();
      process.exit(command ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(chalk.red(`Fatal error: ${error}`));
  process.exit(1);
});
