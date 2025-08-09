declare module 'paulstretch' {
  interface PaulStretchOptions {
    stretchFactor?: number;
    windowSize?: number;
    audioContext?: AudioContext;
  }

  export default class PaulStretch {
    constructor(options?: PaulStretchOptions);
    
    // Core methods
    loadAudio(input: File | Blob | string): Promise<AudioBuffer>;
    stretch(audioBuffer: AudioBuffer, stretchFactor?: number, windowSize?: number): Promise<AudioBuffer>;
    
    // Utility methods
    toBlob(audioBuffer: AudioBuffer, format?: string): Promise<Blob>;
    toUrl(audioBuffer: AudioBuffer, format?: string): Promise<string>;
    play(audioBuffer: AudioBuffer): Promise<void>;
    download(audioBuffer: AudioBuffer, filename?: string, format?: string): Promise<void>;
    
    // Convenience methods
    processAndPlay(input: File | Blob | string): Promise<AudioBuffer>;
    processAndDownload(input: File | Blob | string, filename?: string, format?: string): Promise<AudioBuffer>;
    
    // Progress callback
    onProgress?: (progress: number) => void;
  }
}