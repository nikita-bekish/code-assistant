declare module 'node-record-lpcm16' {
  export interface RecordOptions {
    sampleRate?: number;
    channels?: number;
    audioType?: string;
    threshold?: number;
    silence?: string;
    endOnSilence?: boolean;
    recorder?: string;
  }

  export interface Recording {
    stream(): NodeJS.ReadableStream;
    stop(): void;
    pause(): void;
    resume(): void;
  }

  export function record(options?: RecordOptions): Recording;
}
