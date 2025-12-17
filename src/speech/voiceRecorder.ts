import recorder from 'node-record-lpcm16';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

export class VoiceRecorder {
  private recording: any = null;
  private outputPath: string = '';
  private fileStream: fs.WriteStream | null = null;
  private isSetup: boolean = false;

  /**
   * Start recording audio
   * @param outputPath - Path where to save the recording
   * @returns Output file path
   */
  async startRecording(outputPath?: string): Promise<string> {
    this.outputPath =
      outputPath || path.join(process.cwd(), `recording-${Date.now()}.wav`);

    console.log('🔴 Recording... (press Space again to stop)');

    return new Promise((resolve, reject) => {
      try {
        // Create write stream
        this.fileStream = fs.createWriteStream(this.outputPath);

        // Start recording
        this.recording = recorder.record({
          sampleRate: 16000,
          channels: 1,
          audioType: 'wav',
        });

        const recordingStream = this.recording.stream();

        // Handle recording stream errors (sox can throw errors on stop)
        recordingStream.on('error', (error: Error) => {
          console.error('Recording stream error (ignoring):', error.message);
          // Don't reject - file was likely written successfully
        });

        // Pipe to file
        recordingStream.pipe(this.fileStream);

        this.fileStream.on('finish', () => {
          resolve(this.outputPath);
        });

        this.fileStream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop current recording
   */
  stopRecording(): void {
    if (this.recording) {
      console.log('⏹️  Stopping recording...');
      this.recording.stop();
      this.recording = null;
    }
  }

  /**
   * Setup stdin for keypress events (call once at start)
   */
  setupStdin(): void {
    if (!this.isSetup) {
      readline.emitKeypressEvents(process.stdin);
      this.isSetup = true;
    }
    // Always ensure raw mode is enabled
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
  }

  /**
   * Cleanup stdin (call once at end)
   */
  cleanupStdin(): void {
    if (this.isSetup) {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeAllListeners('keypress');
      this.isSetup = false;
    }
  }

  /**
   * Record audio with Space bar trigger
   * Press Space once to start, press again to stop
   * Note: Call setupStdin() once before using this in a loop
   */
  async recordWithSpaceTrigger(): Promise<string> {
    console.log('\n🎙️  Press [SPACE] to start recording, press again to stop\n');

    // Ensure stdin is setup and force raw mode
    if (!this.isSetup) {
      readline.emitKeypressEvents(process.stdin);
      this.isSetup = true;
    }

    // Resume stdin to keep event loop alive (inquirer may have paused it)
    process.stdin.resume();

    // Force raw mode every time (inquirer may have disabled it)
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(true);
      } catch (err) {
        console.error('Warning: Could not set raw mode:', err);
      }
    }

    return new Promise((resolve, reject) => {
      let isRecording = false;
      let recordingPromise: Promise<string> | null = null;
      let resolved = false;

      const keypressHandler = async (_str: any, key: any) => {
        if (resolved) return; // Ignore events after resolution

        // Handle Ctrl+C
        if (key && key.ctrl && key.name === 'c') {
          resolved = true;
          process.stdin.removeListener('keypress', keypressHandler);
          this.cleanupStdin();
          process.exit();
        }

        // Space key pressed
        if (key && key.name === 'space') {
          if (!isRecording) {
            // Start recording
            isRecording = true;
            recordingPromise = this.startRecording();
          } else {
            // Stop recording
            this.stopRecording();
            if (recordingPromise && !resolved) {
              try {
                const outputPath = await recordingPromise;
                resolved = true;
                // Remove THIS handler but keep stdin setup for next iteration
                process.stdin.removeListener('keypress', keypressHandler);
                resolve(outputPath);
              } catch (error) {
                resolved = true;
                process.stdin.removeListener('keypress', keypressHandler);
                reject(error);
              }
            }
          }
        }
      };

      process.stdin.on('keypress', keypressHandler);
    });
  }

  /**
   * Simple timed recording (for testing)
   * @param durationMs - Duration in milliseconds
   * @param outputPath - Output file path
   */
  async recordForDuration(
    durationMs: number,
    outputPath?: string
  ): Promise<string> {
    const finalPath =
      outputPath || path.join(process.cwd(), `recording-${Date.now()}.wav`);

    console.log(`🔴 Recording for ${durationMs / 1000}s...`);

    return new Promise((resolve, reject) => {
      try {
        const fileStream = fs.createWriteStream(finalPath);
        const recording = recorder.record({
          sampleRate: 16000,
          channels: 1,
          audioType: 'wav',
        });

        recording.stream().pipe(fileStream);

        setTimeout(() => {
          recording.stop();
          fileStream.end();
          console.log('⏹️  Recording complete');
          resolve(finalPath);
        }, durationMs);

        fileStream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}
