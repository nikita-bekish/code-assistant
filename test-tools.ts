import { CodeAssistant } from './src/codeAssistant.js';
import { ProjectConfig } from './src/types/index.js';

/**
 * Test Tool Calling in Chat
 * Demonstrates how the LLM can call git tools automatically
 */

async function testToolCalling() {
  const config: ProjectConfig = {
    projectName: 'My Code Assistant',
    projectDescription: 'A universal code assistant with RAG and git integration',
    paths: {
      root: '.',
      git: '.',
      output: 'node_modules/.code-assistant'
    },
    indexing: {
      includeFolders: ['.', 'src', 'docs'],
      excludeFolders: ['node_modules', '.git', 'build', 'dist', '.next', 'venv']
    },
    llm: {
      model: 'llama3.2',
      maxResults: 5
    },
    embedding: {
      enabled: true,
      model: 'nomic-embed-text'
    },
    prompt: {
      system: 'You are a helpful code assistant for the project "{projectName}". Provide clear and concise answers based on the available information.'
    }
  };

  const assistant = new CodeAssistant(config);
  await assistant.initialize();

  console.log('🧪 Testing Tool Calling with Ollama\n');
  console.log('━'.repeat(60));

  // Test 1: Question that should trigger git_branch tool
  console.log('\n📝 Test 1: Ask about current branch\n');
  console.log('Question: "What branch are we currently working on?"\n');

  try {
    const result1 = await assistant.ask('What branch are we currently working on?');
    console.log('Answer:', result1.answer);
    console.log('\nSources:', result1.sources.length > 0 ? result1.sources.map(s => s.source) : 'None');
    console.log('Confidence:', Math.round(result1.confidence * 100) + '%');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log('Error:', msg);
  }

  console.log('\n' + '━'.repeat(60));

  // Test 2: Question that should trigger git_status tool
  console.log('\n📝 Test 2: Ask about git status\n');
  console.log('Question: "Show me the current git status of the project"\n');

  try {
    const result2 = await assistant.ask('Show me the current git status of the project');
    console.log('Answer:', result2.answer);
    console.log('\nSources:', result2.sources.length > 0 ? result2.sources.map(s => s.source) : 'None');
    console.log('Confidence:', Math.round(result2.confidence * 100) + '%');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log('Error:', msg);
  }

  console.log('\n' + '━'.repeat(60));

  // Test 3: Combined question
  console.log('\n📝 Test 3: Combined RAG + Tools question\n');
  console.log('Question: "What is the project structure and which branch are we on?"\n');

  try {
    const result3 = await assistant.ask('What is the project structure and which branch are we on?');
    console.log('Answer:', result3.answer);
    console.log('\nSources:', result3.sources.length > 0 ? result3.sources.map(s => s.source) : 'None');
    console.log('Confidence:', Math.round(result3.confidence * 100) + '%');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log('Error:', msg);
  }

  console.log('\n' + '━'.repeat(60) + '\n');
  console.log('✅ Tool calling tests completed!\n');
}

testToolCalling().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
