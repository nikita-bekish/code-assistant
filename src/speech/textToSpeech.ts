import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import readline from 'readline';

export type Voice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export class TextToSpeech {
  private openai: OpenAI;
  private defaultVoice: Voice;

  constructor(apiKey?: string, voice: Voice = 'nova') {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.defaultVoice = voice;
  }

  /**
   * Convert text to speech and save to file
   * @param text - Text to convert to speech
   * @param outputPath - Path where to save audio file
   * @param voice - Voice to use (default: nova)
   * @returns Path to generated audio file
   */
  async synthesize(
    text: string,
    outputPath?: string,
    voice?: Voice
  ): Promise<string> {
    try {
      const selectedVoice = voice || this.defaultVoice;
      console.log(`🔊 Synthesizing speech with voice: ${selectedVoice}...`);

      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: selectedVoice,
        input: text,
      });

      // Generate output path if not provided
      const finalOutputPath =
        outputPath || path.join(process.cwd(), `speech-${Date.now()}.mp3`);

      // Save to file
      const buffer = Buffer.from(await mp3.arrayBuffer());
      await fs.promises.writeFile(finalOutputPath, buffer);

      console.log(`✅ Speech saved to: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      console.error('❌ Speech synthesis error:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech and play immediately (macOS)
   * Press ESC or SPACE to stop playback
   * @param text - Text to convert to speech
   * @param voice - Voice to use
   */
  async speak(text: string, voice?: Voice): Promise<void> {
    try {
      // Generate speech
      const audioPath = await this.synthesize(text, undefined, voice);

      // Play audio with ability to stop
      await this.playWithStopKey(audioPath);

      // Clean up
      await fs.promises.unlink(audioPath);
      console.log('✅ Playback complete');
    } catch (error) {
      console.error('❌ Playback error:', error);
      throw error;
    }
  }

  /**
   * Play audio file with ability to stop by pressing ESC or SPACE
   * @param audioPath - Path to audio file
   */
  private async playWithStopKey(audioPath: string): Promise<void> {
    console.log('🔊 Playing audio... (press ESC or SPACE to stop)');

    return new Promise((resolve, reject) => {
      // Start afplay process
      const afplayProcess = spawn('afplay', [audioPath]);
      let stopped = false;

      // Setup keypress listener
      const wasRawMode = process.stdin.isTTY && process.stdin.isRaw;

      if (!process.stdin.listenerCount('keypress')) {
        readline.emitKeypressEvents(process.stdin);
      }

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      const keypressHandler = (_str: any, key: any) => {
        // Stop on ESC or SPACE
        if (key && (key.name === 'escape' || key.name === 'space')) {
          if (!stopped) {
            stopped = true;
            console.log('\n⏹️  Playback stopped by user');
            afplayProcess.kill();
          }
        }
      };

      process.stdin.on('keypress', keypressHandler);

      // Handle process completion
      afplayProcess.on('close', (code) => {
        // Cleanup keypress listener
        process.stdin.removeListener('keypress', keypressHandler);

        // Restore raw mode state
        if (process.stdin.isTTY && !wasRawMode) {
          try {
            process.stdin.setRawMode(false);
          } catch (err) {
            // Ignore error if already in correct state
          }
        }

        if (code === 0 || stopped) {
          resolve();
        } else {
          reject(new Error(`afplay exited with code ${code}`));
        }
      });

      afplayProcess.on('error', (error) => {
        process.stdin.removeListener('keypress', keypressHandler);

        if (process.stdin.isTTY && !wasRawMode) {
          try {
            process.stdin.setRawMode(false);
          } catch (err) {
            // Ignore
          }
        }

        reject(error);
      });
    });
  }

  /**
   * Convert text to speech with HD quality
   * @param text - Text to convert
   * @param outputPath - Output file path
   * @param voice - Voice to use
   */
  async synthesizeHD(
    text: string,
    outputPath?: string,
    voice?: Voice
  ): Promise<string> {
    try {
      const selectedVoice = voice || this.defaultVoice;
      console.log(`🔊 Synthesizing HD speech with voice: ${selectedVoice}...`);

      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1-hd', // HD model
        voice: selectedVoice,
        input: text,
      });

      const finalOutputPath =
        outputPath || path.join(process.cwd(), `speech-hd-${Date.now()}.mp3`);

      const buffer = Buffer.from(await mp3.arrayBuffer());
      await fs.promises.writeFile(finalOutputPath, buffer);

      console.log(`✅ HD speech saved to: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      console.error('❌ HD speech synthesis error:', error);
      throw error;
    }
  }
}
