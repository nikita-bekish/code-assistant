import 'dotenv/config';
import { SpeechToText } from './speech/speechToText.js';
import path from 'path';

/**
 * Test script for Whisper Speech-to-Text
 *
 * Usage:
 * 1. Record audio file (any format: mp3, wav, m4a, etc.)
 * 2. Run: npm run test-whisper <path-to-audio-file>
 *
 * Example:
 * npm run test-whisper ./test-audio.mp3
 */
async function testWhisper() {
  const audioFile = process.argv[2];

  if (!audioFile) {
    console.error('❌ Error: Please provide audio file path');
    console.log('\nUsage: npm run test-whisper <audio-file-path>');
    console.log('Example: npm run test-whisper ./test-audio.mp3');
    process.exit(1);
  }

  try {
    console.log('🧪 Testing Whisper Speech-to-Text\n');
    console.log(`📁 Audio file: ${audioFile}\n`);

    // Initialize STT
    const stt = new SpeechToText();

    // Test 1: Auto-detect language
    console.log('--- Test 1: Auto-detect language ---');
    const text1 = await stt.transcribe(audioFile);
    console.log(`📝 Result: "${text1}"\n`);

    // Test 2: Specify Russian
    console.log('--- Test 2: Specify Russian language ---');
    const text2 = await stt.transcribe(audioFile, 'ru');
    console.log(`📝 Result: "${text2}"\n`);

    // Test 3: Verbose mode (with metadata)
    console.log('--- Test 3: Verbose mode ---');
    const verbose = await stt.transcribeVerbose(audioFile, 'ru');
    console.log(`📝 Text: "${verbose.text}"`);
    console.log(`🌍 Language: ${verbose.language}`);
    console.log(`⏱️  Duration: ${verbose.duration}s\n`);

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testWhisper();
