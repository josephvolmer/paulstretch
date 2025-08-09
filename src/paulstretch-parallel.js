import { PaulStretchError } from './utils/errors.js';
import PaulStretchFFT from './paulstretch-fft.js';

class PaulStretchParallel extends PaulStretchFFT {
    constructor(options = {}) {
        super(options);
        
        this.useWorkers = options.useWorkers !== false && typeof Worker !== 'undefined';
        this.numWorkers = options.numWorkers || (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4);
        this.workers = [];
        this.workerTasks = new Map();
        this.taskIdCounter = 0;
        
        if (this.useWorkers) {
            this._initWorkers();
        }
    }

    _initWorkers() {
        try {
            // Create worker pool
            const workerCode = this._getWorkerCode();
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            
            for (let i = 0; i < this.numWorkers; i++) {
                const worker = new Worker(workerUrl);
                worker.onmessage = (e) => this._handleWorkerMessage(e);
                worker.onerror = (e) => this._handleWorkerError(e);
                this.workers.push(worker);
            }
            
            // Clean up blob URL after workers are created
            setTimeout(() => URL.revokeObjectURL(workerUrl), 1000);
        } catch (error) {
            console.warn('Failed to initialize workers, falling back to single-threaded mode:', error);
            this.useWorkers = false;
            this.workers = [];
        }
    }

    _getWorkerCode() {
        // Return the worker code as a string
        // In production, this would be loaded from stretch-worker.js
        return `
// FFT implementation
class FFT {
    constructor(size) {
        this.size = size;
        this.invSize = 1 / size;
        this.halfSize = Math.floor(size / 2);
        
        this.cosTable = new Float32Array(this.halfSize);
        this.sinTable = new Float32Array(this.halfSize);
        
        for (let i = 0; i < this.halfSize; i++) {
            const angle = -2 * Math.PI * i / size;
            this.cosTable[i] = Math.cos(angle);
            this.sinTable[i] = Math.sin(angle);
        }
    }
    
    forward(real, imag) {
        const n = this.size;
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
        for (let i = 0; i < this.size; i++) {
            imag[i] = -imag[i];
        }
        this.forward(real, imag);
        for (let i = 0; i < this.size; i++) {
            real[i] *= this.invSize;
            imag[i] *= -this.invSize;
        }
    }
}

function processSegment(inputData, startPos, endPos, winSize, fftSize, stretchFactor, window) {
    const fft = new FFT(fftSize);
    const hopSize = Math.floor(winSize / 8);
    const outputLength = Math.floor((endPos - startPos) * stretchFactor);
    const output = new Float32Array(outputLength);
    
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    const magnitude = new Float32Array(fftSize / 2);
    const randomPhase = new Float32Array(fftSize / 2);
    
    let inputPos = startPos;
    let outputPos = 0;
    
    while (inputPos + winSize <= endPos && inputPos + winSize <= inputData.length) {
        real.fill(0);
        imag.fill(0);
        
        for (let i = 0; i < winSize; i++) {
            if (inputPos + i < inputData.length) {
                real[i] = inputData[inputPos + i] * window[i];
            }
        }
        
        fft.forward(real, imag);
        
        for (let i = 0; i < fftSize / 2; i++) {
            magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
            randomPhase[i] = Math.random() * 2 * Math.PI - Math.PI;
            real[i] = magnitude[i] * Math.cos(randomPhase[i]);
            imag[i] = magnitude[i] * Math.sin(randomPhase[i]);
        }
        
        for (let i = 1; i < fftSize / 2; i++) {
            real[fftSize - i] = real[i];
            imag[fftSize - i] = -imag[i];
        }
        
        fft.inverse(real, imag);
        
        const stretchedHopSize = Math.floor(hopSize * stretchFactor);
        for (let i = 0; i < winSize && outputPos + i < outputLength; i++) {
            output[outputPos + i] += real[i] * window[i];
        }
        
        inputPos += hopSize;
        outputPos += stretchedHopSize;
    }
    
    return output;
}

self.onmessage = function(e) {
    const { inputData, startPos, endPos, winSize, fftSize, stretchFactor, window, taskId } = e.data;
    
    try {
        const output = processSegment(inputData, startPos, endPos, winSize, fftSize, stretchFactor, window);
        self.postMessage({ taskId, output, success: true }, [output.buffer]);
    } catch (error) {
        self.postMessage({ taskId, error: error.message, success: false });
    }
};
        `;
    }

    async stretch(audioBuffer, progressCallback = null) {
        if (!audioBuffer || !(audioBuffer instanceof AudioBuffer)) {
            throw new PaulStretchError('Invalid audio buffer');
        }

        // Use parallel processing if we have multiple channels and workers
        if (this.useWorkers && this.workers.length > 0 && audioBuffer.numberOfChannels > 1) {
            return this._stretchParallel(audioBuffer, progressCallback);
        } else {
            // Fall back to single-threaded FFT implementation
            return super.stretch(audioBuffer, progressCallback);
        }
    }

    async _stretchParallel(audioBuffer, progressCallback) {
        const winSize = Math.floor(this.windowSize * audioBuffer.sampleRate);
        const fftSize = this._nextPowerOf2(winSize * 2);
        const outputLength = Math.floor(audioBuffer.length * this.stretchFactor);
        
        const output = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            outputLength,
            audioBuffer.sampleRate
        );

        const window = this._getWindow(winSize);
        
        // Process channels in parallel using workers
        const channelPromises = [];
        
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            channelPromises.push(
                this._processChannelWithWorkers(
                    inputData, 
                    winSize, 
                    fftSize, 
                    window,
                    progressCallback ? (p) => progressCallback(p, channel, audioBuffer.numberOfChannels) : null
                )
            );
        }
        
        const results = await Promise.all(channelPromises);
        
        // Copy results to output buffer
        for (let channel = 0; channel < results.length; channel++) {
            output.copyToChannel(results[channel], channel);
        }
        
        return output;
    }

    async _processChannelWithWorkers(inputData, winSize, fftSize, window, progressCallback) {
        const outputLength = Math.floor(inputData.length * this.stretchFactor);
        const segmentSize = Math.ceil(inputData.length / this.workers.length);
        const hopSize = Math.floor(winSize / 8);
        
        // Create tasks for each worker
        const tasks = [];
        const outputs = [];
        
        for (let i = 0; i < this.workers.length; i++) {
            const startPos = i * segmentSize;
            const endPos = Math.min((i + 1) * segmentSize + winSize, inputData.length);
            
            if (startPos < inputData.length) {
                const taskId = this.taskIdCounter++;
                const task = this._sendToWorker(
                    this.workers[i],
                    {
                        inputData,
                        startPos,
                        endPos,
                        winSize,
                        fftSize,
                        stretchFactor: this.stretchFactor,
                        window,
                        taskId
                    }
                );
                tasks.push(task);
                outputs.push({ startPos, endPos });
            }
        }
        
        // Wait for all workers to complete
        const segmentResults = await Promise.all(tasks);
        
        // Combine results with overlap handling
        const output = new Float32Array(outputLength);
        
        for (let i = 0; i < segmentResults.length; i++) {
            const segment = segmentResults[i];
            const { startPos } = outputs[i];
            const outputStartPos = Math.floor(startPos * this.stretchFactor);
            
            // Add segment to output with overlap
            for (let j = 0; j < segment.length && outputStartPos + j < outputLength; j++) {
                output[outputStartPos + j] += segment[j];
            }
        }
        
        // Normalize
        this._normalizeInPlace(output);
        
        if (progressCallback) {
            progressCallback(1.0);
        }
        
        return output;
    }

    _sendToWorker(worker, data) {
        return new Promise((resolve, reject) => {
            const { taskId } = data;
            
            this.workerTasks.set(taskId, { resolve, reject });
            
            // Clone the data to avoid transferring the original buffer
            const inputDataCopy = new Float32Array(data.inputData);
            const windowCopy = new Float32Array(data.window);
            
            worker.postMessage({
                ...data,
                inputData: inputDataCopy,
                window: windowCopy
            }, [inputDataCopy.buffer, windowCopy.buffer]);
        });
    }

    _handleWorkerMessage(e) {
        const { taskId, output, success, error } = e.data;
        const task = this.workerTasks.get(taskId);
        
        if (task) {
            this.workerTasks.delete(taskId);
            if (success) {
                task.resolve(output);
            } else {
                task.reject(new Error(error));
            }
        }
    }

    _handleWorkerError(e) {
        console.error('Worker error:', e);
    }

    dispose() {
        super.dispose();
        
        // Terminate workers
        for (const worker of this.workers) {
            worker.terminate();
        }
        this.workers = [];
        this.workerTasks.clear();
    }
}

export default PaulStretchParallel;