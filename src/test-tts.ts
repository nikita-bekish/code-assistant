import 'dotenv/config';
import { TextToSpeech } from './speech/textToSpeech.js';

/**
 * Test script for Text-to-Speech
 *
 * Usage:
 * npm run test-tts
 * npm run test-tts "Ваш текст для озвучивания"
 *
 * Example:
 * npm run test-tts "Привет, я голосовой помощник!"
 */
async function testTTS() {
  // Get text from command line or use default
  const text =
    process.argv[2] ||
    'Привет! Я искусственный интеллект код-ассистент. Могу помочь с анализом кода, логов и ответить на вопросы о проекте.';

  try {
    console.log('🧪 Testing Text-to-Speech\n');
    console.log(`📝 Text: "${text}"\n`);

    // Test 1: nova voice (female, warm - default)
    console.log('--- Test 1: Voice "nova" (female, warm) ---');
    const ttsNova = new TextToSpeech(undefined, 'nova');
    await ttsNova.speak(text);
    console.log();

    // Test 2: shimmer voice (female, bright)
    console.log('--- Test 2: Voice "shimmer" (female, bright) ---');
    const ttsShimmer = new TextToSpeech(undefined, 'shimmer');
    await ttsShimmer.speak(text);
    console.log();

    // Test 3: Save to file (without playing)
    console.log('--- Test 3: Save to file ---');
    const tts = new TextToSpeech();
    const outputPath = await tts.synthesize(text, './test-output.mp3');
    console.log(`💾 Saved to: ${outputPath}`);
    console.log('You can play it later with: afplay ./test-output.mp3\n');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testTTS();
