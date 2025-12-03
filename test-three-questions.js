import { CodeAssistant } from './dist/src/index.js';

const config = {
  projectName: 'Test',
  projectDescription: 'Testing CRM',
  paths: { root: process.cwd(), output: '.code-assistant', git: '.git' },
  indexing: { includeFolders: ['src'], excludeFolders: ['.claude', 'node_modules', 'dist'], includeFileTypes: ['.ts'], excludePatterns: [], maxFileSize: '10MB', chunkSize: 400, chunkOverlap: 100 },
  git: { enabled: true, includeCommitHistory: true, maxCommitsToFetch: 50 },
  llm: { model: 'llama3.2', temperature: 0.2, topP: 0.8, contextWindow: 4096, maxResults: 5 },
  prompt: { system: 'You are a helpful assistant.', language: 'en' },
};

(async () => {
  try {
    const assistant = new CodeAssistant(config);
    await assistant.initialize();

    const questions = [
      'Get information about user user_1',
      'List all tickets for user user_1',
      'Search for tickets about authentication'
    ];

    console.log('\n=== TESTING THREE QUESTIONS ===\n');
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      console.log(`\n📝 Q${i + 1}: "${q}"`);
      console.log('-'.repeat(60));
      const result = await assistant.ask(q);
      console.log(`✓ Answer: ${result.answer}\n`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
