import { PaulStretchError } from './utils/errors.js';

class PaulStretchOptimized {
    constructor(options = {}) {
        this.stretchFactor = options.stretchFactor || 8.0;
        this.windowSize = options.windowSize || 0.25;
        this.useWorkers = options.useWorkers !== false && typeof Worker !== 'undefined';
        this.numWorkers = options.numWorkers || (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4);
        
        const AudioContextClass = options.audioContext || 
            (typeof window !== 'undefined' ? window.AudioContext : null);
            
        if (!AudioContextClass) {
            throw new PaulStretchError('AudioContext not available');
        }
        
        this.audioContext = new AudioContextClass();
        
        // Cache for window functions
        this.windowCache = new Map();
        
        // Pre-allocate buffers for reuse
        this.bufferPool = [];
        this.maxPoolSize = 10;
    }

    async loadAudio(input) {
        if (!input) {
            throw new PaulStretchError('Invalid input');
        }

        try {
            let arrayBuffer;
            if (input instanceof File || input instanceof Blob) {
                arrayBuffer = await input.arrayBuffer();
            } else if (typeof input === 'string') {
                const response = await fetch(input);
                arrayBuffer = await response.arrayBuffer();
            } else {
                throw new PaulStretchError('Input must be a File, Blob, or URL string');
            }

            return await this.audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            throw new PaulStretchError(`Failed to load audio: ${error.message}`);
        }
    }

    async stretch(audioBuffer, progressCallback = null) {
        if (!audioBuffer || !(audioBuffer instanceof AudioBuffer)) {
            throw new PaulStretchError('Invalid audio buffer');
        }

        const winSize = Math.floor(this.windowSize * audioBuffer.sampleRate);
        const outputLength = Math.floor(audioBuffer.length * this.stretchFactor);
        const output = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            outputLength,
            audioBuffer.sampleRate
        );

        // Get or create cached window
        const window = this._getCachedWindow(winSize);

        // Process channels in parallel if possible
        if (this.useWorkers && audioBuffer.numberOfChannels > 1) {
            await this._processChannelsParallel(audioBuffer, output, window, progressCallback);
        } else {
            // Process each channel sequentially with optimizations
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const inputData = audioBuffer.getChannelData(channel);
                const outputData = await this._processChannelOptimized(
                    inputData, 
                    winSize, 
                    window,
                    progressCallback ? (p) => progressCallback(p, channel, audioBuffer.numberOfChannels) : null
                );
                output.copyToChannel(outputData, channel);
            }
        }

        return output;
    }

    async _processChannelsParallel(audioBuffer, output, window, progressCallback) {
        const promises = [];
        
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            promises.push(
                this._processChannelOptimized(
                    inputData,
                    window.length,
                    window,
                    progressCallback ? (p) => progressCallback(p, channel, audioBuffer.numberOfChannels) : null
                )
            );
        }
        
        const results = await Promise.all(promises);
        
        for (let channel = 0; channel < results.length; channel++) {
            output.copyToChannel(results[channel], channel);
        }
    }

    async _processChannelOptimized(inputData, winSize, window, progressCallback) {
        const outputLength = Math.floor(inputData.length * this.stretchFactor);
        const output = this._getBuffer(outputLength);
        const stepSize = Math.floor(winSize / 4);
        
        // Pre-calculate constants
        const inputLength = inputData.length;
        const stretchFactor = this.stretchFactor;
        
        // Use typed arrays for better performance
        const fftSize = this._nextPowerOf2(winSize * 2);
        const fftBuffer = new Float32Array(fftSize);
        const spectrum = new Float32Array(fftSize);
        
        // Process in chunks to avoid blocking
        const chunkSize = 1024;
        let pos = 0;
        let processedChunks = 0;
        const totalChunks = Math.ceil((inputLength - winSize) / stepSize);
        
        // Main processing loop with optimizations
        while (pos < inputLength - winSize) {
            // Extract chunk without slice (faster)
            for (let i = 0; i < winSize; i++) {
                fftBuffer[i] = inputData[pos + i] * window[i];
            }
            
            // Apply FFT for spectral processing (simulated here, would use Web Audio API or library)
            this._applySpectralProcessing(fftBuffer, spectrum, winSize);
            
            // Stretch and overlap-add
            const outputPos = Math.floor(pos * stretchFactor);
            const stretchedLength = Math.floor(winSize * stretchFactor);
            
            // Optimized overlap-add
            this._overlapAdd(spectrum, output, outputPos, stretchedLength, winSize, stretchFactor);
            
            pos += stepSize;
            processedChunks++;
            
            // Report progress and yield to avoid blocking
            if (progressCallback && processedChunks % chunkSize === 0) {
                const progress = processedChunks / totalChunks;
                progressCallback(progress);
                // Yield to event loop
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        // Normalize in-place
        this._normalizeInPlace(output);
        
        return output;
    }

    _applySpectralProcessing(input, output, winSize) {
        // Simplified spectral processing
        // In a real implementation, this would use FFT
        for (let i = 0; i < winSize; i++) {
            output[i] = input[i];
        }
    }

    _overlapAdd(spectrum, output, outputPos, stretchedLength, winSize, stretchFactor) {
        // Optimized overlap-add with bounds checking
        const outputLength = output.length;
        const limit = Math.min(stretchedLength, outputLength - outputPos);
        
        for (let i = 0; i < limit; i++) {
            const sourceIndex = Math.floor(i / stretchFactor);
            if (sourceIndex < winSize) {
                output[outputPos + i] += spectrum[sourceIndex];
            }
        }
    }

    _getCachedWindow(size) {
        if (!this.windowCache.has(size)) {
            const window = this._createWindow(size);
            this.windowCache.set(size, window);
        }
        return this.windowCache.get(size);
    }

    _createWindow(size) {
        const window = new Float32Array(size);
        const twoPi = 2 * Math.PI;
        const sizeMinus1 = size - 1;
        
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos((twoPi * i) / sizeMinus1));
        }
        return window;
    }

    _getBuffer(size) {
        // Reuse buffers from pool if available
        for (let i = 0; i < this.bufferPool.length; i++) {
            if (this.bufferPool[i].length === size) {
                const buffer = this.bufferPool.splice(i, 1)[0];
                buffer.fill(0); // Clear the buffer
                return buffer;
            }
        }
        return new Float32Array(size);
    }

    _releaseBuffer(buffer) {
        // Return buffer to pool for reuse
        if (this.bufferPool.length < this.maxPoolSize) {
            this.bufferPool.push(buffer);
        }
    }

    _normalizeInPlace(buffer) {
        let maxValue = 0;
        const length = buffer.length;
        
        // Find max value with optimized loop
        for (let i = 0; i < length; i++) {
            const absValue = Math.abs(buffer[i]);
            if (absValue > maxValue) {
                maxValue = absValue;
            }
        }
        
        if (maxValue > 0 && maxValue !== 1) {
            const scale = 1 / maxValue;
            for (let i = 0; i < length; i++) {
                buffer[i] *= scale;
            }
        }
    }

    _nextPowerOf2(n) {
        return Math.pow(2, Math.ceil(Math.log2(n)));
    }

    // Clean up resources
    dispose() {
        this.windowCache.clear();
        this.bufferPool = [];
    }
}

export default PaulStretchOptimized;