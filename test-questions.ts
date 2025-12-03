import { CodeAssistant } from './dist/src/index.js';
import { ProjectConfig } from './dist/src/types/index.js';

async function main() {
  const config: ProjectConfig = {
    projectName: 'Test Project',
    projectDescription: 'Testing CRM tools',
    paths: {
      root: process.cwd(),
      output: '.code-assistant',
      git: '.git',
    },
    indexing: {
      includeFolders: ['src'],
      excludeFolders: ['.claude', 'node_modules', 'dist'],
      includeFileTypes: ['.ts', '.tsx'],
      excludePatterns: ['*.test.ts'],
      maxFileSize: '10MB',
      chunkSize: 400,
      chunkOverlap: 100,
    },
    git: {
      enabled: true,
      includeCommitHistory: true,
      maxCommitsToFetch: 50,
    },
    llm: {
      model: 'llama3.2',
      temperature: 0.2,
      topP: 0.8,
      contextWindow: 4096,
      maxResults: 5,
    },
    prompt: {
      system: 'You are a helpful code assistant for {projectName}. Help developers understand the codebase, explain architecture, suggest implementations. Always cite sources.',
      language: 'en',
    },
  };

  try {
    const assistant = new CodeAssistant(config);
    await assistant.initialize();
    console.log('✅ Assistant initialized\n');

    // Test 3 questions
    const questions = [
      'Get information about user user_1',
      'List all tickets for user user_1',
      'Search for tickets about authentication',
    ];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log(`\n📝 Q${i + 1}: "${question}"`);
      console.log('-'.repeat(60));

      try {
        const result = await assistant.ask(question);
        console.log(`Answer: ${result.answer.substring(0, 200)}...`);
        console.log(`Sources: ${result.sources.length} found, Confidence: ${(result.confidence * 100).toFixed(0)}%`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${msg}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize assistant:', error);
    process.exit(1);
  }
}

main();
