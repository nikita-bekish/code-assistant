import { initializeSupportServer, startSupportServer } from './src/server/supportServer.js';
import { ProjectConfig } from './src/types/index.js';

async function main() {
  const config: ProjectConfig = {
    projectName: 'Support Assistant Server',
    projectDescription: 'REST API for customer support',
    paths: {
      root: process.cwd(),
      output: '.code-assistant',
      git: '.git',
    },
    indexing: {
      includeFolders: ['docs'],
      excludeFolders: ['.claude', 'node_modules', 'dist'],
      includeFileTypes: ['md'],
      excludePatterns: [],
      maxFileSize: '10MB',
      chunkSize: 1024,
      chunkOverlap: 256,
    },
    git: {
      enabled: false,
      includeCommitHistory: false,
      maxCommitsToFetch: 50,
    },
    llm: {
      model: 'llama3.2',
      temperature: 0.7,
      topP: 0.9,
      contextWindow: 4096,
      maxResults: 5,
    },
    prompt: {
      system: 'You are a helpful customer support assistant.',
      language: 'en',
    },
    embedding: {
      enabled: true,
      model: 'nomic-embed-text',
      provider: 'ollama',
    },
  };

  try {
    console.log('🚀 Initializing Support Assistant...');
    const crmPath = `${process.cwd()}/src/data/crm.json`;

    await initializeSupportServer(config, crmPath);
    console.log('✅ Support Assistant initialized');
    console.log('🌐 Starting API server...\n');

    startSupportServer();

    // Keep server running and handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down server...');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
