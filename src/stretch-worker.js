// Worker for parallel PaulStretch processing

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

// Process frames using sebpiq's exact algorithm
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