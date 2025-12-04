import chalk from "chalk";
import readline from "readline";
import { CodeAssistant } from "./codeAssistant.js";

export class ChatBotCLI {
  private assistant: CodeAssistant;
  private rl: readline.Interface;
  private isRunning: boolean = false;

  constructor(assistant: CodeAssistant) {
    this.assistant = assistant;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Start the interactive chat
   */
  async start(): Promise<void> {
    this.isRunning = true;

    console.log(chalk.cyan.bold("\n🤖 My Code Assistant\n"));

    // Show project context
    const context = await this.assistant.getProjectContext();
    console.log(chalk.gray(`Project: ${chalk.white(context.name)}`));
    console.log(chalk.gray(`Branch: ${chalk.white(context.branch)}`));
    console.log(
      chalk.gray(
        `Files: ${chalk.white(context.stats.files)}, LOC: ${chalk.white(
          context.stats.loc
        )}, Chunks: ${chalk.white(context.stats.chunks)}`
      )
    );
    console.log(
      chalk.gray(
        `Recent commits: ${
          context.recentCommits.length > 0
            ? context.recentCommits[0].message
            : "N/A"
        }`
      )
    );

    console.log(chalk.cyan("\nType /help for commands or ask a question\n"));

    this._prompt();
  }

  private _prompt(): void {
    if (!this.isRunning) return;

    this.rl.question(chalk.blue("You: "), async (input) => {
      const trimmedInput = input.trim();

      if (!trimmedInput) {
        this._prompt();
        return;
      }

      // Handle commands
      if (trimmedInput.startsWith("/")) {
        await this._handleCommand(trimmedInput);
      } else {
        // Ask question
        try {
          const result = await this.assistant.ask(trimmedInput);

          console.log(chalk.green("\nAssistant: ") + result.answer);

          // Show tools used
          if (result.toolsUsed && result.toolsUsed.length > 0) {
            console.log(chalk.cyan(`\n🔧 Tools used: ${result.toolsUsed.join(", ")}`));
          }

          if (result.sources.length > 0) {
            console.log(chalk.gray("\nSources:"));
            for (let i = 0; i < result.sources.length; i++) {
              console.log(
                chalk.gray(
                  `  [${i + 1}] ${result.sources[i].source} (similarity: ${(
                    result.sources[i].similarity * 100
                  ).toFixed(1)}%)`
                )
              );
            }
          }

          // Only show confidence for RAG-based answers (not tools)
          if (!result.usedTools) {
            console.log(
              chalk.gray(
                `\nConfidence: ${(result.confidence * 100).toFixed(0)}%\n`
              )
            );
          } else {
            console.log(); // Empty line for spacing
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.log(chalk.red(`\nError: ${errorMessage}\n`));
        }
      }

      this._prompt();
    });
  }

  private async _handleCommand(command: string): Promise<void> {
    const args = command.split(" ");
    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case "/help":
        // If there's a question after /help, use RAG to answer
        if (args.length > 1) {
          const question = args.slice(1).join(" ");
          await this._helpWithRAG(question);
        } else {
          this._showHelp();
        }
        break;

      case "/git":
        await this._showGitStatus();
        break;

      case "/history":
        this._showHistory();
        break;

      case "/clear":
        this.assistant.clearConversation();
        console.log(chalk.green("Conversation cleared\n"));
        break;

      case "/context":
        await this._showContext();
        break;

      case "/mcp":
        await this._handleMCPCommand(args);
        break;

      case "/exit":
      case "/quit":
        this._exit();
        break;

      default:
        console.log(
          chalk.yellow(
            `Unknown command: ${cmd}. Type /help for available commands\n`
          )
        );
    }
  }

  private async _handleMCPCommand(args: string[]): Promise<void> {
    try {
      console.log(chalk.magenta("called _handleMCPCommand", args));
      if (args[1] === "start") {
        await this.assistant.startMCPServer();
        console.log(chalk.magenta("MCP Server started"));
      }
      if (args[1] === "stop") {
        await this.assistant.stopMCPServer();
        console.log(chalk.magenta("MCP Server stopped"));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(chalk.bgMagenta(`\nError: ${errorMessage}\n`));
    }
  }

  private async _helpWithRAG(question: string): Promise<void> {
    try {
      console.log(chalk.cyan("\n📚 Searching project documentation...\n"));
      const result = await this.assistant.ask(question);

      console.log(chalk.green("Answer: ") + result.answer);

      if (result.sources.length > 0) {
        console.log(chalk.gray("\nRelevant Documentation:"));
        for (let i = 0; i < result.sources.length; i++) {
          console.log(
            chalk.gray(
              `  [${i + 1}] ${result.sources[i].source} (relevance: ${(
                result.sources[i].similarity * 100
              ).toFixed(1)}%)`
            )
          );
        }
      }

      console.log(
        chalk.gray(`\nConfidence: ${(result.confidence * 100).toFixed(0)}%\n`)
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`\nError: ${errorMessage}\n`));
    }
  }

  private _showHelp(): void {
    console.log(chalk.cyan("\nAvailable Commands:"));
    console.log(
      chalk.white(
        "  /help [question] - Ask about project (RAG search + Git tools)"
      )
    );
    console.log(
      chalk.white("  /git             - Show git status and recent commits")
    );
    console.log(chalk.white("  /history         - Show conversation history"));
    console.log(chalk.white("  /context         - Show project context"));
    console.log(chalk.white("  /mcp             - MCP commands"));
    console.log(chalk.white("  /clear           - Clear conversation history"));
    console.log(chalk.white("  /exit            - Exit the assistant\n"));
    console.log(chalk.cyan("💡 Available Tools (LLM can use automatically):"));
    console.log(chalk.gray("  • git_branch     - Get current git branch"));
    console.log(chalk.gray("  • git_status     - Get repository status\n"));
    console.log(chalk.gray("Examples:"));
    console.log(chalk.gray("  /help What is the project structure?"));
    console.log(chalk.gray("  /help What branch are we on?"));
    console.log(chalk.gray("  /help Show me the git status"));
    console.log(chalk.gray("  /help How do I install this project?\n"));
  }

  private async _showGitStatus(): Promise<void> {
    try {
      const status = await this.assistant.getGitStatus();
      console.log(chalk.cyan("\nGit Status:"));
      if (status) {
        console.log(chalk.white(status));
      } else {
        console.log(chalk.gray("No changes"));
      }
      console.log("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`\nError: ${errorMessage}\n`));
    }
  }

  private _showHistory(): void {
    const history = this.assistant.getConversationHistory();
    if (history) {
      console.log(chalk.cyan("\nConversation History:"));
      console.log(chalk.white(history));
      console.log("");
    } else {
      console.log(chalk.gray("\nNo conversation history\n"));
    }
  }

  private async _showContext(): Promise<void> {
    try {
      const context = await this.assistant.getProjectContext();
      console.log(chalk.cyan("\nProject Context:"));
      console.log(chalk.white(`  Name: ${context.name}`));
      console.log(chalk.white(`  Description: ${context.description}`));
      console.log(chalk.white(`  Branch: ${context.branch}`));
      console.log(chalk.white(`  Files: ${context.stats.files}`));
      console.log(chalk.white(`  LOC: ${context.stats.loc}`));
      console.log(chalk.white(`  Chunks: ${context.stats.chunks}`));

      if (context.recentCommits.length > 0) {
        console.log(chalk.cyan("\n  Recent Commits:"));
        for (const commit of context.recentCommits.slice(0, 3)) {
          console.log(
            chalk.white(`    - ${commit.message} (${commit.author})`)
          );
        }
      }
      console.log("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`\nError: ${errorMessage}\n`));
    }
  }

  private _exit(): void {
    console.log(chalk.cyan("\nGoodbye! 👋\n"));
    this.isRunning = false;
    this.rl.close();
    process.exit(0);
  }
}
