import fs from 'fs/promises';
import path from 'path';
import { CodeAssistant } from './src/codeAssistant.ts';
import type { ProjectConfig } from './src/types/index.ts';

async function runEmbeddingTests() {
  try {
    console.log('🧪 Testing Semantic Search with Embeddings\n');
    console.log('='.repeat(70));

    // Load config
    const configPath = path.join(process.cwd(), 'projectConfig.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData) as ProjectConfig;

    // Initialize assistant
    console.log('\n📚 Initializing Code Assistant...');
    const assistant = new CodeAssistant(config);
    await assistant.initialize();

    // Get project context
    const context = await assistant.getProjectContext();
    console.log(`\n✓ Project: ${context.name}`);
    console.log(`✓ Files indexed: ${context.stats.files}`);
    console.log(`✓ Code chunks: ${context.stats.chunks}`);
    console.log(`✓ Total LOC: ${context.stats.loc}`);

    // Test queries
    const testQueries = [
      'How does code indexing work?',
      'What is the RAG pipeline?',
      'How do I use the chat interface?',
      'How does git integration work?',
      'What are embeddings?',
      'How does semantic search work?',
      'What is the project structure?',
      'How to authenticate users?',
    ];

    console.log('\n' + '='.repeat(70));
    console.log('🔍 SEARCH RESULTS WITH SEMANTIC SEARCH\n');

    for (const query of testQueries) {
      console.log(`\n❓ Query: "${query}"`);
      console.log('-'.repeat(70));

      try {
        const result = await assistant.ask(query);

        console.log(`\n✓ Answer Preview:`);
        console.log(`  ${result.answer.substring(0, 100)}...`);

        console.log(`\n📊 Sources (Confidence: ${(result.confidence * 100).toFixed(0)}%):`);
        result.sources.forEach((source, idx) => {
          const similarity = (source.similarity * 100).toFixed(1);
          console.log(
            `  [${idx + 1}] ${source.source.padEnd(30)} | Relevance: ${similarity.padStart(5)}%`
          );
        });
      } catch (error) {
        console.error(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📈 SUMMARY\n');

    // Show embedding status
    const hasSemanticSearch = assistant['rag'].isSemanticSearchAvailable?.();
    console.log(`Semantic Search Status: ${hasSemanticSearch ? '✅ ENABLED' : '❌ DISABLED'}`);

    if (hasSemanticSearch) {
      console.log(`\n🚀 Embedding Configuration:`);
      console.log(`   Model: ${config.embedding?.model || 'N/A'}`);
      console.log(`   Provider: ${config.embedding?.provider || 'N/A'}`);
      console.log(`   Base URL: ${config.embedding?.baseUrl || 'N/A'}`);
      console.log('\n✨ Semantic search is active! Results include:');
      console.log('   • Keyword matching (exact and prefix matches)');
      console.log('   • Semantic similarity (vector embeddings)');
      console.log('   • RRF (Reciprocal Rank Fusion) combination');
    } else {
      console.log('\n⚠️  Semantic search is disabled or embeddings not available.');
      console.log('   Using keyword-only search.');
      console.log('\n   To enable embeddings:');
      console.log('   1. Start Ollama: ollama serve');
      console.log('   2. Pull model: ollama pull nomic-embed-text');
      console.log('   3. Regenerate index: node bin/cli.js index');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Test completed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runEmbeddingTests();
