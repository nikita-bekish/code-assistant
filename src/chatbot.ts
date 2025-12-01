import readline from 'readline';
import chalk from 'chalk';
import { CodeAssistant } from './codeAssistant.js';

export class ChatBotCLI {
  private assistant: CodeAssistant;
  private rl: readline.Interface;
  private isRunning: boolean = false;

  constructor(assistant: CodeAssistant) {
    this.assistant = assistant;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Start the interactive chat
   */
  async start(): Promise<void> {
    this.isRunning = true;

    console.log(chalk.cyan.bold('\n🤖 My Code Assistant\n'));

    // Show project context
    const context = await this.assistant.getProjectContext();
    console.log(chalk.gray(`Project: ${chalk.white(context.name)}`));
    console.log(chalk.gray(`Branch: ${chalk.white(context.branch)}`));
    console.log(chalk.gray(`Files: ${chalk.white(context.stats.files)}, LOC: ${chalk.white(context.stats.loc)}, Chunks: ${chalk.white(context.stats.chunks)}`));
    console.log(chalk.gray(`Recent commits: ${context.recentCommits.length > 0 ? context.recentCommits[0].message : 'N/A'}`));

    console.log(chalk.cyan('\nType /help for commands or ask a question\n'));

    this._prompt();
  }

  private _prompt(): void {
    if (!this.isRunning) return;

    this.rl.question(chalk.blue('You: '), async (input) => {
      const trimmedInput = input.trim();

      if (!trimmedInput) {
        this._prompt();
        return;
      }

      // Handle commands
      if (trimmedInput.startsWith('/')) {
        await this._handleCommand(trimmedInput);
      } else {
        // Ask question
        try {
          const result = await this.assistant.ask(trimmedInput);

          console.log(chalk.green('\nAssistant: ') + result.answer);

          if (result.sources.length > 0) {
            console.log(chalk.gray('\nSources:'));
            for (let i = 0; i < result.sources.length; i++) {
              console.log(chalk.gray(`  [${i + 1}] ${result.sources[i].source} (similarity: ${(result.sources[i].similarity * 100).toFixed(1)}%)`));
            }
          }

          console.log(chalk.gray(`\nConfidence: ${(result.confidence * 100).toFixed(0)}%\n`));
        } catch (error) {
          console.log(chalk.red(`\nError: ${error}\n`));
        }
      }

      this._prompt();
    });
  }

  private async _handleCommand(command: string): Promise<void> {
    const args = command.split(' ');
    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case '/help':
        this._showHelp();
        break;

      case '/git':
        await this._showGitStatus();
        break;

      case '/history':
        this._showHistory();
        break;

      case '/clear':
        this.assistant.clearConversation();
        console.log(chalk.green('Conversation cleared\n'));
        break;

      case '/context':
        await this._showContext();
        break;

      case '/exit':
      case '/quit':
        this._exit();
        break;

      default:
        console.log(chalk.yellow(`Unknown command: ${cmd}. Type /help for available commands\n`));
    }
  }

  private _showHelp(): void {
    console.log(chalk.cyan('\nAvailable Commands:'));
    console.log(chalk.white('  /help      - Show this help message'));
    console.log(chalk.white('  /git       - Show git status and recent commits'));
    console.log(chalk.white('  /history   - Show conversation history'));
    console.log(chalk.white('  /context   - Show project context'));
    console.log(chalk.white('  /clear     - Clear conversation history'));
    console.log(chalk.white('  /exit      - Exit the assistant\n'));
  }

  private async _showGitStatus(): Promise<void> {
    try {
      const status = await this.assistant.getGitStatus();
      console.log(chalk.cyan('\nGit Status:'));
      if (status) {
        console.log(chalk.white(status));
      } else {
        console.log(chalk.gray('No changes'));
      }
      console.log('');
    } catch (error) {
      console.log(chalk.red(`\nError: ${error}\n`));
    }
  }

  private _showHistory(): void {
    const history = this.assistant.getConversationHistory();
    if (history) {
      console.log(chalk.cyan('\nConversation History:'));
      console.log(chalk.white(history));
      console.log('');
    } else {
      console.log(chalk.gray('\nNo conversation history\n'));
    }
  }

  private async _showContext(): Promise<void> {
    try {
      const context = await this.assistant.getProjectContext();
      console.log(chalk.cyan('\nProject Context:'));
      console.log(chalk.white(`  Name: ${context.name}`));
      console.log(chalk.white(`  Description: ${context.description}`));
      console.log(chalk.white(`  Branch: ${context.branch}`));
      console.log(chalk.white(`  Files: ${context.stats.files}`));
      console.log(chalk.white(`  LOC: ${context.stats.loc}`));
      console.log(chalk.white(`  Chunks: ${context.stats.chunks}`));

      if (context.recentCommits.length > 0) {
        console.log(chalk.cyan('\n  Recent Commits:'));
        for (const commit of context.recentCommits.slice(0, 3)) {
          console.log(chalk.white(`    - ${commit.message} (${commit.author})`));
        }
      }
      console.log('');
    } catch (error) {
      console.log(chalk.red(`\nError: ${error}\n`));
    }
  }

  private _exit(): void {
    console.log(chalk.cyan('\nGoodbye! 👋\n'));
    this.isRunning = false;
    this.rl.close();
    process.exit(0);
  }
}
