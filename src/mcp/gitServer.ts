import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GitHelper } from '../gitHelper.js';

/**
 * MCP Server for Git Tools
 * Provides git_branch and git_status tools via Model Context Protocol
 */
export class GitMCPServer {
  private server: McpServer;
  private gitHelper: GitHelper;

  constructor(gitPath: string) {
    this.gitHelper = new GitHelper(gitPath);

    // Create MCP server with capabilities
    this.server = new McpServer({
      name: 'git-mcp-server',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.setupHandlers();
  }

  /**
   * Setup MCP server request handlers
   */
  private setupHandlers(): void {
    /**
     * Register git_branch tool
     */
    this.server.tool(
      'git_branch',
      'Get the current git branch name',
      {},
      async () => {
        try {
          const result = await this.handleGitBranch();
          return {
            content: [
              {
                type: 'text' as const,
                text: result,
              },
            ],
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${errorMsg}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    /**
     * Register git_status tool
     */
    this.server.tool(
      'git_status',
      'Get the git repository status (staged, unstaged, untracked files)',
      {},
      async () => {
        try {
          const result = await this.handleGitStatus();
          return {
            content: [
              {
                type: 'text' as const,
                text: result,
              },
            ],
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${errorMsg}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Handle git_branch tool call
   */
  private async handleGitBranch(): Promise<string> {
    try {
      const stats = await this.gitHelper.getProjectStats();
      return `Current git branch: ${stats.branch}`;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get git branch: ${errorMsg}`);
    }
  }

  /**
   * Handle git_status tool call
   */
  private async handleGitStatus(): Promise<string> {
    try {
      const status = await this.gitHelper.getStatus();
      if (!status) {
        return 'Git repository is clean (no changes)';
      }
      return `Git Status:\n${status}`;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get git status: ${errorMsg}`);
    }
  }

  /**
   * Start the MCP server (use stdio transport)
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Git MCP Server] Started and listening on stdio');
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    // Server closes when transport closes
    console.error('[Git MCP Server] Stopped');
  }
}
