import { PaulStretchError } from './utils/errors.js';

// FFT implementation for PaulStretch algorithm
class FFT {
    constructor(size) {
        this.size = size;
        this.invSize = 1 / size;
    }
    
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
        
        // Cooley-Tukey FFT
        let len = 2;
        while (len <= n) {
            const halfLen = len >> 1;
            const angleStep = -2 * Math.PI / len;
            for (let i = 0; i < n; i += len) {
                for (let j = 0; j < halfLen; j++) {
                    const m = i + j;
                    const n = m + halfLen;
                    
                    const angle = angleStep * j;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    
                    const tReal = real[n] * cos - imag[n] * sin;
                    const tImag = real[n] * sin + imag[n] * cos;
                    
                    real[n] = real[m] - tReal;
                    imag[n] = imag[m] - tImag;
                    real[m] += tReal;
                    imag[m] += tImag;
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

// Create window function for overlap-add synthesis
function createWindow(winSize) {
    const winArray = new Float32Array(winSize);
    let counter = -1;
    const step = 2 / (winSize - 1);
    for (let i = 0; i < winSize; i++) {
        winArray[i] = Math.pow(1 - Math.pow(counter, 2), 1.25);
        counter += step;
    }
    return winArray;
}

// Apply window to multi-channel block
function applyWindow(block, winArray) {
    const frameCount = block[0].length;
    const channelCount = block.length;
    
    for (let i = 0; i < frameCount; i++) {
        for (let ch = 0; ch < channelCount; ch++) {
            block[ch][i] = block[ch][i] * winArray[i];
        }
    }
}

// Phase randomization function for spectral processing
function makeRephaser(winSize) {
    const halfWinSize = winSize / 2;
    const fft = new FFT(winSize);
    
    return function(array, phases) {
        const real = new Float32Array(array);
        const imag = new Float32Array(winSize);
        
        // Forward FFT
        fft.forward(real, imag);
        
        // Get amplitudes and apply new phases
        for (let i = 0; i <= halfWinSize; i++) {
            const amplitude = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
            real[i] = amplitude * Math.cos(phases[i]);
            imag[i] = amplitude * Math.sin(phases[i]);
        }
        
        // Mirror for negative frequencies
        for (let i = 1; i < halfWinSize; i++) {
            real[winSize - i] = real[i];
            imag[winSize - i] = -imag[i];
        }
        
        // Inverse FFT
        fft.inverse(real, imag);
        
        // Copy back
        for (let i = 0; i < winSize; i++) {
            array[i] = real[i];
        }
    };
}

class PaulStretch {
    constructor(options = {}) {
        this.stretchFactor = options.stretchFactor || 8.0;
        this.windowSize = options.windowSize || 0.25; // in seconds
        this.useWorkers = options.useWorkers !== false && typeof Worker !== 'undefined';
        this.numWorkers = options.numWorkers || (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4);
        
        const AudioContextClass = options.audioContext || 
            (typeof window !== 'undefined' ? window.AudioContext : null);
            
        if (!AudioContextClass) {
            throw new PaulStretchError('AudioContext not available');
        }
        
        this.audioContext = new AudioContextClass();
        this.workers = [];
        this.workerTasks = new Map();
        this.taskIdCounter = 0;
        
        if (this.useWorkers) {
            this._initWorkers();
        }
    }

    _initWorkers() {
        try {
            // Get worker code
            const workerCode = this._getWorkerCode();
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            
            // Create worker pool
            for (let i = 0; i < this.numWorkers; i++) {
                const worker = new Worker(workerUrl);
                worker.onmessage = (e) => this._handleWorkerMessage(e);
                worker.onerror = (e) => console.error('Worker error:', e);
                this.workers.push(worker);
            }
            
            // Clean up blob URL
            setTimeout(() => URL.revokeObjectURL(workerUrl), 1000);
        } catch (error) {
            console.warn('Failed to initialize workers:', error);
            this.useWorkers = false;
        }
    }

    _getWorkerCode() {
        // Return the worker code as a string
        return `
// FFT implementation
class FFT {
    constructor(size) {
        this.size = size;
        this.invSize = 1 / size;
    }
    
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
        
        // Cooley-Tukey FFT
        let len = 2;
        while (len <= n) {
            const halfLen = len >> 1;
            const angleStep = -2 * Math.PI / len;
            for (let i = 0; i < n; i += len) {
                for (let j = 0; j < halfLen; j++) {
                    const m = i + j;
                    const n = m + halfLen;
                    
                    const angle = angleStep * j;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    
                    const tReal = real[n] * cos - imag[n] * sin;
                    const tImag = real[n] * sin + imag[n] * cos;
                    
                    real[n] = real[m] - tReal;
                    imag[n] = imag[m] - tImag;
                    real[m] += tReal;
                    imag[m] += tImag;
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

// Process frames using PaulStretch algorithm
function processFrames(params) {
    const {
        inputData,
        startFrame,
        numFrames,
        winSize,
        stretchFactor,
        winArray,
        taskId,
        channelIndex
    } = params;
    
    const halfWinSize = winSize / 2;
    const displacePos = halfWinSize / stretchFactor;
    const fft = new FFT(winSize);
    
    // Calculate output blocks
    const results = [];
    let inputPos = startFrame;
    const phaseArray = new Float32Array(halfWinSize + 1);
    
    for (let i = 0; i < numFrames; i++) {
        if (inputPos + winSize > inputData.length) break;
        
        // Create block for processing
        const blockIn = new Float32Array(winSize);
        
        // Fill input block
        for (let j = 0; j < winSize; j++) {
            blockIn[j] = inputData[Math.floor(inputPos) + j];
        }
        
        // Apply window to input
        for (let j = 0; j < winSize; j++) {
            blockIn[j] *= winArray[j];
        }
        
        // Phase randomization
        const real = new Float32Array(blockIn);
        const imag = new Float32Array(winSize);
        
        // Forward FFT
        fft.forward(real, imag);
        
        // Generate random phases
        for (let j = 0; j <= halfWinSize; j++) {
            phaseArray[j] = Math.random() * 2 * Math.PI;
        }
        
        // Apply new phases
        for (let j = 0; j <= halfWinSize; j++) {
            const amplitude = Math.sqrt(real[j] * real[j] + imag[j] * imag[j]);
            real[j] = amplitude * Math.cos(phaseArray[j]);
            imag[j] = amplitude * Math.sin(phaseArray[j]);
        }
        
        // Mirror for negative frequencies
        for (let j = 1; j < halfWinSize; j++) {
            real[winSize - j] = real[j];
            imag[winSize - j] = -imag[j];
        }
        
        // Inverse FFT
        fft.inverse(real, imag);
        
        // Apply window again and store result
        for (let j = 0; j < winSize; j++) {
            blockIn[j] = real[j] * winArray[j];
        }
        
        results.push({
            block: blockIn,
            inputPos: inputPos
        });
        
        inputPos += displacePos;
    }
    
    return results;
}

// Handle messages from main thread
self.onmessage = function(e) {
    const { action, params } = e.data;
    
    if (action === 'processFrames') {
        try {
            const results = processFrames(params);
            
            // Convert results to transferable format
            const blocks = [];
            const positions = [];
            
            for (const result of results) {
                blocks.push(result.block);
                positions.push(result.inputPos);
            }
            
            self.postMessage({
                taskId: params.taskId,
                channelIndex: params.channelIndex,
                blocks: blocks,
                positions: positions,
                success: true
            });
        } catch (error) {
            self.postMessage({
                taskId: params.taskId,
                error: error.message,
                success: false
            });
        }
    }
};
        `;
    }

    _handleWorkerMessage(e) {
        const { taskId, success, error } = e.data;
        const task = this.workerTasks.get(taskId);
        
        if (task) {
            this.workerTasks.delete(taskId);
            if (success) {
                task.resolve(e.data);
            } else {
                task.reject(new Error(error));
            }
        }
    }

    _sendToWorker(worker, params) {
        return new Promise((resolve, reject) => {
            const taskId = this.taskIdCounter++;
            this.workerTasks.set(taskId, { resolve, reject });
            
            worker.postMessage({
                action: 'processFrames',
                params: { ...params, taskId }
            });
        });
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

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const windowSamples = Math.floor(this.windowSize * sampleRate);
        
        // Make window size power of 2 for FFT
        const winSize = Math.pow(2, Math.ceil(Math.log2(windowSamples)));
        const halfWinSize = winSize / 2;
        
        // Use workers if available
        if (this.useWorkers && this.workers.length > 0) {
            return this._stretchParallel(audioBuffer, progressCallback);
        } else {
            return this._stretchSingleThread(audioBuffer, progressCallback);
        }
    }

    async _stretchParallel(audioBuffer, progressCallback) {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const windowSamples = Math.floor(this.windowSize * sampleRate);
        const winSize = Math.pow(2, Math.ceil(Math.log2(windowSamples)));
        const halfWinSize = winSize / 2;
        const displacePos = halfWinSize / this.stretchFactor;
        
        // Calculate output length
        const outputLength = Math.floor(audioBuffer.length * this.stretchFactor);
        const output = this.audioContext.createBuffer(numChannels, outputLength, sampleRate);
        
        // Create window
        const winArray = createWindow(winSize);
        
        // Calculate total work units (chunks) across all channels
        const totalFrames = Math.floor((audioBuffer.length - winSize) / displacePos);
        
        // Create smaller chunks for better load balancing
        // Aim for at least 2-3 chunks per worker per channel for better distribution
        const targetChunksPerWorker = 3;
        const idealChunkSize = Math.max(1, Math.floor(totalFrames / (this.workers.length * targetChunksPerWorker)));
        
        // Create work queue - each item is a chunk to process
        const workQueue = [];
        for (let ch = 0; ch < numChannels; ch++) {
            const inputData = audioBuffer.getChannelData(ch);
            
            // Split this channel into many small chunks
            let frameIdx = 0;
            while (frameIdx < totalFrames) {
                const numFrames = Math.min(idealChunkSize, totalFrames - frameIdx);
                
                if (numFrames <= 0) break;
                
                workQueue.push({
                    inputData: inputData,
                    startFrame: frameIdx * displacePos,
                    numFrames: numFrames,
                    winSize: winSize,
                    stretchFactor: this.stretchFactor,
                    winArray: winArray,
                    channelIndex: ch
                });
                
                frameIdx += numFrames;
            }
        }
        
        // Distribute work across all workers more evenly
        const workerPromises = [];
        let workerIndex = 0;
        let completedChunks = 0;
        const totalChunks = workQueue.length;
        
        // Create promises with progress tracking
        for (const workUnit of workQueue) {
            // Round-robin distribution across workers
            const promise = this._sendToWorker(this.workers[workerIndex], workUnit)
                .then(result => {
                    completedChunks++;
                    if (progressCallback) {
                        progressCallback(completedChunks / totalChunks, 0, numChannels);
                    }
                    return result;
                });
            
            workerPromises.push(promise);
            workerIndex = (workerIndex + 1) % this.workers.length;
        }
        
        // Wait for all work to complete
        const allResults = await Promise.all(workerPromises);
        
        // Group results by channel
        const resultsByChannel = new Map();
        for (let ch = 0; ch < numChannels; ch++) {
            resultsByChannel.set(ch, []);
        }
        
        for (const result of allResults) {
            resultsByChannel.get(result.channelIndex).push(result);
        }
        
        // Apply results to each channel
        for (let ch = 0; ch < numChannels; ch++) {
            const channelResults = resultsByChannel.get(ch);
            const channelOut = output.getChannelData(ch);
            const blockOut = new Float32Array(winSize);
            
            // Collect all blocks for this channel
            const allBlocks = [];
            for (const workerResult of channelResults) {
                for (let i = 0; i < workerResult.blocks.length; i++) {
                    allBlocks.push({
                        block: workerResult.blocks[i],
                        inputPos: workerResult.positions[i]
                    });
                }
            }
            
            // Sort by position to ensure correct order
            allBlocks.sort((a, b) => a.inputPos - b.inputPos);
            
            // Apply overlap-add
            let outputPos = 0;
            for (const { block } of allBlocks) {
                // Overlap-add: first half of current + second half of previous
                for (let i = 0; i < halfWinSize && outputPos + i < outputLength; i++) {
                    channelOut[outputPos + i] += block[i] + blockOut[halfWinSize + i];
                }
                
                // Store current block for next iteration
                for (let i = 0; i < winSize; i++) {
                    blockOut[i] = block[i];
                }
                
                outputPos += halfWinSize;
            }
            
            // Normalize channel
            let maxVal = 0;
            for (let i = 0; i < channelOut.length; i++) {
                maxVal = Math.max(maxVal, Math.abs(channelOut[i]));
            }
            if (maxVal > 0) {
                const scale = 0.95 / maxVal;
                for (let i = 0; i < channelOut.length; i++) {
                    channelOut[i] *= scale;
                }
            }
        }
        
        return output;
    }

    async _stretchSingleThread(audioBuffer, progressCallback) {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const windowSamples = Math.floor(this.windowSize * sampleRate);
        
        // Make window size power of 2 for FFT
        const winSize = Math.pow(2, Math.ceil(Math.log2(windowSamples)));
        const halfWinSize = winSize / 2;
        
        // Calculate output length
        const outputLength = Math.floor(audioBuffer.length * this.stretchFactor);
        const output = this.audioContext.createBuffer(numChannels, outputLength, sampleRate);
        
        // Create window and rephaser
        const winArray = createWindow(winSize);
        const rephase = makeRephaser(winSize);
        
        // Get input data
        const inputData = [];
        for (let ch = 0; ch < numChannels; ch++) {
            inputData.push(audioBuffer.getChannelData(ch));
        }
        
        // Process using PaulStretch algorithm
        const displacePos = halfWinSize / this.stretchFactor;
        let inputPos = 0;
        let outputPos = 0;
        let frameCount = 0;
        const totalFrames = Math.floor((audioBuffer.length - winSize) / displacePos);
        
        // Create blocks for processing
        const blockIn = [];
        const blockOut = [];
        const phaseArray = new Float32Array(halfWinSize + 1);
        
        for (let ch = 0; ch < numChannels; ch++) {
            blockIn.push(new Float32Array(winSize));
            blockOut.push(new Float32Array(winSize));
        }
        
        while (inputPos + winSize <= audioBuffer.length) {
            // Fill input block
            for (let ch = 0; ch < numChannels; ch++) {
                for (let i = 0; i < winSize; i++) {
                    blockIn[ch][i] = inputData[ch][Math.floor(inputPos) + i];
                }
            }
            
            // Apply window to input
            applyWindow(blockIn, winArray);
            
            // Randomize phases for each channel
            for (let ch = 0; ch < numChannels; ch++) {
                // Generate random phases
                for (let i = 0; i <= halfWinSize; i++) {
                    phaseArray[i] = Math.random() * 2 * Math.PI;
                }
                // Apply phase randomization
                rephase(blockIn[ch], phaseArray);
            }
            
            // Apply window again for double windowing
            applyWindow(blockIn, winArray);
            
            // Overlap-add: first half of current + second half of previous
            for (let ch = 0; ch < numChannels; ch++) {
                const channelOut = output.getChannelData(ch);
                
                // Add first half of current to output
                for (let i = 0; i < halfWinSize && outputPos + i < outputLength; i++) {
                    channelOut[outputPos + i] += blockIn[ch][i] + blockOut[ch][halfWinSize + i];
                }
                
                // Store current block for next iteration
                for (let i = 0; i < winSize; i++) {
                    blockOut[ch][i] = blockIn[ch][i];
                }
            }
            
            inputPos += displacePos;
            outputPos += halfWinSize;
            frameCount++;
            
            if (progressCallback && frameCount % 100 === 0) {
                const progress = frameCount / totalFrames;
                if (isFinite(progress) && progress >= 0 && progress <= 1) {
                    progressCallback(progress, 0, numChannels);
                }
            }
        }
        
        // Normalize output
        for (let ch = 0; ch < numChannels; ch++) {
            const channelData = output.getChannelData(ch);
            let maxVal = 0;
            for (let i = 0; i < channelData.length; i++) {
                maxVal = Math.max(maxVal, Math.abs(channelData[i]));
            }
            if (maxVal > 0) {
                const scale = 0.95 / maxVal;
                for (let i = 0; i < channelData.length; i++) {
                    channelData[i] *= scale;
                }
            }
        }
        
        return output;
    }

    async toBlob(audioBuffer, format = 'audio/wav') {
        if (!audioBuffer || !(audioBuffer instanceof AudioBuffer)) {
            throw new PaulStretchError('Invalid audio buffer');
        }

        try {
            const numberOfSamples = audioBuffer.length;
            const numberOfChannels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            
            const bytesPerSample = 2;
            const blockAlign = numberOfChannels * bytesPerSample;
            const dataSize = numberOfSamples * blockAlign;
            const fileSize = 44 + dataSize;
            
            const buffer = new ArrayBuffer(fileSize);
            const view = new DataView(buffer);
            
            let pos = 0;
            
            const setString = (str) => {
                for (let i = 0; i < str.length; i++) {
                    view.setUint8(pos++, str.charCodeAt(i));
                }
            };
            
            const setUint16 = (data) => {
                view.setUint16(pos, data, true);
                pos += 2;
            };
            
            const setUint32 = (data) => {
                view.setUint32(pos, data, true);
                pos += 4;
            };
            
            // Write RIFF header
            setString('RIFF');
            setUint32(fileSize - 8);
            setString('WAVE');
            
            // Write fmt chunk
            setString('fmt ');
            setUint32(16);
            setUint16(1);
            setUint16(numberOfChannels);
            setUint32(sampleRate);
            setUint32(sampleRate * blockAlign);
            setUint16(blockAlign);
            setUint16(16);
            
            // Write data chunk
            setString('data');
            setUint32(dataSize);
            
            const channels = [];
            for (let channel = 0; channel < numberOfChannels; channel++) {
                channels.push(audioBuffer.getChannelData(channel));
            }
            
            for (let i = 0; i < numberOfSamples; i++) {
                for (let channel = 0; channel < numberOfChannels; channel++) {
                    let sample = channels[channel][i];
                    sample = Math.max(-1, Math.min(1, sample));
                    
                    let intSample;
                    if (sample < 0) {
                        intSample = Math.floor(sample * 32768);
                    } else {
                        intSample = Math.floor(sample * 32767);
                    }
                    
                    view.setInt16(pos, intSample, true);
                    pos += 2;
                }
            }
            
            return new Blob([buffer], { type: format });
        } catch (error) {
            throw new PaulStretchError(`Failed to create blob: ${error.message}`);
        }
    }

    async toUrl(audioBuffer, format = 'audio/wav') {
        const blob = await this.toBlob(audioBuffer, format);
        return URL.createObjectURL(blob);
    }

    async play(audioBuffer) {
        if (!audioBuffer || !(audioBuffer instanceof AudioBuffer)) {
            throw new PaulStretchError('Invalid audio buffer');
        }

        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(0);
            
            return new Promise((resolve) => {
                source.onended = resolve;
            });
        } catch (error) {
            throw new PaulStretchError(`Failed to play audio: ${error.message}`);
        }
    }

    async download(audioBuffer, filename = 'stretched-audio.wav', format = 'audio/wav') {
        const blob = await this.toBlob(audioBuffer, format);
        
        if (typeof window !== 'undefined') {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            throw new PaulStretchError('Download is only available in browser environment');
        }
    }

    async processAndPlay(input) {
        const audioBuffer = await this.loadAudio(input);
        const stretchedBuffer = await this.stretch(audioBuffer);
        await this.play(stretchedBuffer);
        return stretchedBuffer;
    }

    async processAndDownload(input, filename = 'stretched-audio.wav', format = 'audio/wav') {
        const audioBuffer = await this.loadAudio(input);
        const stretchedBuffer = await this.stretch(audioBuffer);
        await this.download(stretchedBuffer, filename, format);
        return stretchedBuffer;
    }

    dispose() {
        // Clean up workers
        for (const worker of this.workers) {
            worker.terminate();
        }
        this.workers = [];
        this.workerTasks.clear();
    }
}

export default PaulStretch;