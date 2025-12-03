import { SupportAssistant } from './src/support/supportAssistant.js';
import { ProjectConfig } from './src/types/index.js';

/**
 * Simple test script for Support Assistant
 */
async function testSupportAssistant() {
  console.log('🧪 Testing Support Assistant...\n');

  // Create a minimal project config
  const config: ProjectConfig = {
    projectName: 'Support Assistant Test',
    projectDescription: 'Testing the support assistant system',
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
      enabled: false,
      model: 'nomic-embed-text',
      provider: 'ollama',
    },
  };

  try {
    // Initialize support assistant
    const crmPath = `${process.cwd()}/src/data/crm.json`;
    const assistant = new SupportAssistant(crmPath, config);
    console.log('✅ Support Assistant created');

    await assistant.initialize();
    console.log('✅ Support Assistant initialized');

    // Test 1: Answer a question for an existing user
    console.log('\n📝 Test 1: Answer support question');
    console.log('Question: "Why is authentication not working?"');
    console.log('User: user_1, Ticket: ticket_1\n');

    const response1 = await assistant.answerQuestion(
      'Why is authentication not working? I can\'t login to my account.',
      'user_1',
      'ticket_1'
    );

    console.log('📤 Response:');
    console.log(`Answer: ${response1.answer.substring(0, 200)}...`);
    console.log(`Related docs: ${response1.relatedDocs.length} found`);
    console.log(`Suggested actions: ${response1.suggestedActions.join(', ')}`);
    console.log(`Ticket updated: ${response1.ticket_updated}`);

    // Test 2: Question without ticket
    console.log('\n\n📝 Test 2: Support question without ticket');
    console.log('Question: "How do I upgrade my plan?"');
    console.log('User: user_2\n');

    const response2 = await assistant.answerQuestion(
      'How do I upgrade my plan to pro?',
      'user_2'
    );

    console.log('📤 Response:');
    console.log(`Answer: ${response2.answer.substring(0, 200)}...`);
    console.log(`Related docs: ${response2.relatedDocs.length} found`);
    console.log(`Suggested actions: ${response2.suggestedActions.join(', ')}`);

    console.log('\n\n✨ All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run tests
testSupportAssistant().catch(console.error);
