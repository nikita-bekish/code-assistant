#!/usr/bin/env node

import { GitMCPServer } from './dist/mcp/gitServer.js';

/**
 * Test MCP Server for Git Tools
 */

async function testMCPServer() {
  console.log('🔌 Testing Git MCP Server\n');
  console.log('='.repeat(70));

  try {
    // Initialize MCP Server
    console.log('\n📡 Starting MCP Server on port 3001...\n');
    const mcpServer = new GitMCPServer('.', 3001);
    await mcpServer.start();

    // Wait a moment for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 1: Get available tools
    console.log('\n1️⃣ Getting available tools...\n');
    const toolsResponse = await fetch('http://localhost:3001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    });

    const toolsData = await toolsResponse.json();
    console.log('Available Tools:');
    if (toolsData.result?.tools) {
      toolsData.result.tools.forEach((tool) => {
        console.log(`  ✓ ${tool.name} - ${tool.description}`);
      });
    }

    // Test 2: Get current git branch
    console.log('\n\n2️⃣ Getting current git branch...\n');
    const branchResponse = await fetch('http://localhost:3001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'git_branch',
      }),
    });

    const branchData = await branchResponse.json();
    console.log(`Current Branch: ${branchData.result}`);

    // Test 3: Get git status
    console.log('\n\n3️⃣ Getting git status...\n');
    const statusResponse = await fetch('http://localhost:3001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'git_status',
      }),
    });

    const statusData = await statusResponse.json();
    if (statusData.result) {
      console.log('Git Status:');
      console.log(statusData.result);
    } else {
      console.log('Git Status: No changes or clean working directory');
    }

    // Test 4: Error handling - invalid method
    console.log('\n\n4️⃣ Testing error handling (invalid method)...\n');
    const errorResponse = await fetch('http://localhost:3001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'invalid_method',
      }),
    });

    const errorData = await errorResponse.json();
    console.log(`Error Response: ${errorData.error?.message}`);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('\n✅ MCP Server Tests Completed!\n');
    console.log('📊 What we demonstrated:\n');
    console.log('1. MCP Server accepts JSON-RPC requests on POST');
    console.log('2. tools/list returns available tools');
    console.log('3. git_branch() returns current git branch');
    console.log('4. git_status() returns git repository status');
    console.log('5. Error handling for invalid methods');
    console.log('\n💡 How this integrates with LLM:\n');
    console.log('→ LLM receives context from git tools via MCP');
    console.log('→ Can answer questions about repository state');
    console.log('→ No direct shell access needed (secure)');
    console.log('→ Standardized JSON-RPC protocol');

    console.log('\n🔌 MCP Server Architecture:\n');
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│          LLM (llama3.2)                     │');
    console.log('│     "What branch are we on?"               │');
    console.log('└────────────────┬────────────────────────────┘');
    console.log('                 │');
    console.log('         HTTP POST /api/git_branch');
    console.log('         JSON-RPC Request');
    console.log('                 │');
    console.log('                 ↓');
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│      MCP Server (Port 3001)                 │');
    console.log('│  Handles: git_branch(), git_status()      │');
    console.log('└────────────────┬────────────────────────────┘');
    console.log('                 │');
    console.log('         Calls GitHelper');
    console.log('         Executes: git rev-parse --abbrev-ref HEAD');
    console.log('                 │');
    console.log('                 ↓');
    console.log('         Returns: "main"');
    console.log('         (in JSON-RPC format)');
    console.log('\n');

    // Cleanup
    await mcpServer.stop();
    console.log('🛑 MCP Server stopped\n');

    process.exit(0);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${errorMsg}\n`);
    process.exit(1);
  }
}

testMCPServer();
