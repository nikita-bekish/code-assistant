import http from 'http';
import { GitHelper } from '../gitHelper.js';

/**
 * MCP Server for Git Tools
 * Provides git_branch and git_status tools via JSON-RPC
 */
export class GitMCPServer {
  private server: http.Server | null = null;
  private gitHelper: GitHelper;
  private port: number;

  constructor(gitPath: string, port: number = 3001) {
    this.gitHelper = new GitHelper(gitPath);
    this.port = port;
  }

  /**
   * Start the MCP server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405);
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const request = JSON.parse(body);
            const response = await this.handleRequest(request);
            res.writeHead(200);
            res.end(JSON.stringify(response));
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.writeHead(400);
            res.end(JSON.stringify({ error: errorMsg }));
          }
        });
      });

      this.server.listen(this.port, () => {
        console.log(`🔌 Git MCP Server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Handle MCP JSON-RPC request
   */
  private async handleRequest(request: any): Promise<any> {
    const { id, method, params } = request;

    try {
      let result;

      switch (method) {
        case 'git_branch':
          result = await this.getGitBranch();
          break;

        case 'git_status':
          result = await this.getGitStatus();
          break;

        case 'tools/list':
          result = this.listTools();
          break;

        default:
          throw new Error(`Unknown method: ${method}`);
      }

      return {
        jsonrpc: '2.0',
        id,
        result,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: errorMsg,
        },
      };
    }
  }

  /**
   * Get current git branch
   */
  private async getGitBranch(): Promise<string> {
    const stats = await this.gitHelper.getProjectStats();
    return stats.branch;
  }

  /**
   * Get git status
   */
  private async getGitStatus(): Promise<string> {
    return await this.gitHelper.getStatus();
  }

  /**
   * List available tools
   */
  private listTools(): any {
    return {
      tools: [
        {
          name: 'git_branch',
          description: 'Get current git branch name',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'git_status',
          description: 'Get git repository status (staged, unstaged, untracked files)',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    };
  }

  /**
   * Stop the MCP server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
