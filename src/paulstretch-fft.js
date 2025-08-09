import { PaulStretchError } from './utils/errors.js';

// FFT implementation for PaulStretch algorithm
class FFT {
    constructor(size) {
        this.size = size;
        this.invSize = 1 / size;
        this.halfSize = Math.floor(size / 2);
        
        // Pre-calculate twiddle factors
        this.cosTable = new Float32Array(this.halfSize);
        this.sinTable = new Float32Array(this.halfSize);
        
        for (let i = 0; i < this.halfSize; i++) {
            const angle = -2 * Math.PI * i / size;
            this.cosTable[i] = Math.cos(angle);
            this.sinTable[i] = Math.sin(angle);
        }
    }
    
    // Cooley-Tukey FFT
    forward(real, imag) {
        const n = this.size;
        
        // Bit reversal
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
            let k = n >> 1;
            while (k <= j) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }
        
        // Cooley-Tukey decimation-in-time
        let len = 2;
        while (len <= n) {
            const halfLen = len >> 1;
            const tableStep = n / len;
            for (let i = 0; i < n; i += len) {
                let k = 0;
                for (let j = 0; j < halfLen; j++) {
                    const m = i + j;
                    const n = m + halfLen;
                    
                    const cos = this.cosTable[k];
                    const sin = this.sinTable[k];
                    
                    const tReal = real[n] * cos - imag[n] * sin;
                    const tImag = real[n] * sin + imag[n] * cos;
                    
                    real[n] = real[m] - tReal;
                    imag[n] = imag[m] - tImag;
                    real[m] += tReal;
                    imag[m] += tImag;
                    
                    k += tableStep;
                }
            }
            len <<= 1;
        }
    }
    
    inverse(real, imag) {
        // Conjugate
        for (let i = 0; i < this.size; i++) {
            imag[i] = -imag[i];
        }
        
        // Forward FFT
        this.forward(real, imag);
        
        // Conjugate and scale
        for (let i = 0; i < this.size; i++) {
            real[i] *= this.invSize;
            imag[i] *= -this.invSize;
        }
    }
}

class PaulStretchFFT {
    constructor(options = {}) {
        this.stretchFactor = options.stretchFactor || 8.0;
        this.windowSize = options.windowSize || 0.25;
        
        const AudioContextClass = options.audioContext || 
            (typeof window !== 'undefined' ? window.AudioContext : null);
            
        if (!AudioContextClass) {
            throw new PaulStretchError('AudioContext not available');
        }
        
        this.audioContext = new AudioContextClass();
        
        // Cache for FFT objects and windows
        this.fftCache = new Map();
        this.windowCache = new Map();
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
        const fftSize = this._nextPowerOf2(winSize * 2);
        const outputLength = Math.floor(audioBuffer.length * this.stretchFactor);
        
        const output = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            outputLength,
            audioBuffer.sampleRate
        );

        // Process each channel
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = await this._processChannelFFT(
                inputData, 
                winSize,
                fftSize,
                progressCallback ? (p) => progressCallback(p, channel, audioBuffer.numberOfChannels) : null
            );
            output.copyToChannel(outputData, channel);
        }

        return output;
    }

    async _processChannelFFT(inputData, winSize, fftSize, progressCallback) {
        const outputLength = Math.floor(inputData.length * this.stretchFactor);
        const output = new Float32Array(outputLength);
        
        // Get or create FFT processor
        const fft = this._getFFT(fftSize);
        
        // Get window function
        const window = this._getWindow(winSize);
        
        // Hop size for overlap
        const hopSize = Math.floor(winSize / 8);
        
        // Buffers for FFT
        const real = new Float32Array(fftSize);
        const imag = new Float32Array(fftSize);
        const magnitude = new Float32Array(fftSize / 2);
        const phase = new Float32Array(fftSize / 2);
        const randomPhase = new Float32Array(fftSize / 2);
        
        let inputPos = 0;
        let outputPos = 0;
        let processedFrames = 0;
        const totalFrames = Math.floor((inputData.length - winSize) / hopSize);
        
        while (inputPos + winSize <= inputData.length) {
            // Clear buffers
            real.fill(0);
            imag.fill(0);
            
            // Apply window and copy to FFT buffer
            for (let i = 0; i < winSize; i++) {
                real[i] = inputData[inputPos + i] * window[i];
            }
            
            // Forward FFT
            fft.forward(real, imag);
            
            // Convert to polar coordinates
            for (let i = 0; i < fftSize / 2; i++) {
                magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
                phase[i] = Math.atan2(imag[i], real[i]);
            }
            
            // Randomize phase (key to PaulStretch algorithm)
            for (let i = 0; i < fftSize / 2; i++) {
                randomPhase[i] = Math.random() * 2 * Math.PI - Math.PI;
            }
            
            // Apply randomized phase
            for (let i = 0; i < fftSize / 2; i++) {
                real[i] = magnitude[i] * Math.cos(randomPhase[i]);
                imag[i] = magnitude[i] * Math.sin(randomPhase[i]);
            }
            
            // Mirror for negative frequencies
            for (let i = 1; i < fftSize / 2; i++) {
                real[fftSize - i] = real[i];
                imag[fftSize - i] = -imag[i];
            }
            
            // Inverse FFT
            fft.inverse(real, imag);
            
            // Apply window and overlap-add to output
            const stretchedHopSize = Math.floor(hopSize * this.stretchFactor);
            for (let i = 0; i < winSize && outputPos + i < outputLength; i++) {
                output[outputPos + i] += real[i] * window[i];
            }
            
            inputPos += hopSize;
            outputPos += stretchedHopSize;
            processedFrames++;
            
            // Report progress
            if (progressCallback && processedFrames % 100 === 0) {
                progressCallback(processedFrames / totalFrames);
                // Yield to event loop
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        // Normalize
        this._normalizeInPlace(output);
        
        return output;
    }

    _getFFT(size) {
        if (!this.fftCache.has(size)) {
            this.fftCache.set(size, new FFT(size));
        }
        return this.fftCache.get(size);
    }

    _getWindow(size) {
        if (!this.windowCache.has(size)) {
            const window = new Float32Array(size);
            for (let i = 0; i < size; i++) {
                // Hann window
                window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
            }
            this.windowCache.set(size, window);
        }
        return this.windowCache.get(size);
    }

    _normalizeInPlace(buffer) {
        let maxValue = 0;
        for (let i = 0; i < buffer.length; i++) {
            const absValue = Math.abs(buffer[i]);
            if (absValue > maxValue) {
                maxValue = absValue;
            }
        }
        
        if (maxValue > 0) {
            const scale = 1 / maxValue;
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] *= scale;
            }
        }
    }

    _nextPowerOf2(n) {
        return Math.pow(2, Math.ceil(Math.log2(n)));
    }

    dispose() {
        this.fftCache.clear();
        this.windowCache.clear();
    }
}

export default PaulStretchFFT;