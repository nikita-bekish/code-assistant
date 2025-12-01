#!/usr/bin/env node

/**
 * MCP Server Entry Point
 *
 * This script starts the Git MCP server and listens via stdio transport.
 * This is the correct way to implement MCP servers.
 *
 * Usage:
 *   node mcp-server.js
 *
 * The server communicates via stdin/stdout using JSON-RPC protocol.
 */

import { GitMCPServer } from './dist/mcp/gitServer.js';

async function main() {
  try {
    console.error('[Git MCP Server] Initializing...');

    // Create and start MCP server
    const mcpServer = new GitMCPServer('.');

    console.error('[Git MCP Server] Starting...');
    await mcpServer.start();

    // Server is now listening on stdio
    console.error('[Git MCP Server] Ready and listening on stdio');

    // Keep the process alive
    process.on('SIGINT', async () => {
      console.error('[Git MCP Server] Shutting down...');
      await mcpServer.stop();
      process.exit(0);
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Git MCP Server] Fatal error: ${errorMsg}`);
    process.exit(1);
  }
}

main();
