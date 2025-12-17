import OpenAI from 'openai';
import fs from 'fs';

export class SpeechToText {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Transcribe audio file to text using Whisper API
   * @param audioFilePath - Path to audio file (mp3, wav, etc.)
   * @param language - Optional language code (e.g., 'ru', 'en'). Auto-detected if not provided.
   * @returns Transcribed text
   */
  async transcribe(audioFilePath: string, language?: string): Promise<string> {
    try {
      console.log('🎤 Transcribing audio...');

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: language, // optional: 'ru' for Russian, 'en' for English
      });

      console.log('✅ Transcription complete');
      return transcription.text;
    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio with additional metadata
   */
  async transcribeVerbose(audioFilePath: string, language?: string) {
    try {
      console.log('🎤 Transcribing audio (verbose mode)...');

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: language,
        response_format: 'verbose_json',
      });

      console.log('✅ Transcription complete');
      return transcription;
    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw error;
    }
  }
}
