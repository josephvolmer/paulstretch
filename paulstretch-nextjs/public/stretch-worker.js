self.onmessage = function(e) {
    const { taskId, type, inputData, windowSize, stepSize, outputLength, stretchFactor, window, startStep, endStep } = e.data;
    
    try {
        // Convert ArrayBuffer back to Float32Array if needed
        const channelData = inputData instanceof ArrayBuffer ? new Float32Array(inputData) : inputData;
        const windowArray = window instanceof ArrayBuffer ? new Float32Array(window) : window;
        
        const result = processChannel(channelData, windowSize, stepSize, outputLength, stretchFactor, windowArray, startStep, endStep);
        
        // Transfer the result buffer for better performance
        self.postMessage({ taskId, result: result.buffer }, [result.buffer]);
    } catch (error) {
        self.postMessage({ taskId, error: error.message });
    }
};

function processChannel(channelData, windowSize, stepSize, outputLength, stretchFactor, window, startStep, endStep) {
    const outputData = new Float32Array(outputLength);
    const inputLength = channelData.length;
    
    // If no window provided, create one
    if (!window) {
        window = createHanningWindow(windowSize);
    }
    
    // Process only the assigned chunk range
    for (let step = startStep; step < endStep; step++) {
        const inputPosition = step * stepSize;
        
        if (inputPosition + windowSize > inputLength) break;
        
        const chunk = new Float32Array(windowSize);
        
        for (let j = 0; j < windowSize; j++) {
            const inputIndex = inputPosition + j;
            if (inputIndex < inputLength) {
                chunk[j] = channelData[inputIndex] * window[j];
            }
        }
        
        const stretched = stretchChunk(chunk, stretchFactor);
        const outputPosition = Math.floor(step * stepSize * stretchFactor);
        
        for (let j = 0; j < stretched.length && outputPosition + j < outputLength; j++) {
            outputData[outputPosition + j] += stretched[j];
        }
    }
    
    return outputData; // Don't normalize here, will be done in main thread
}

function createHanningWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
    }
    return window;
}

function stretchChunk(chunk, stretchFactor) {
    const outputSize = Math.floor(chunk.length * stretchFactor);
    const output = new Float32Array(outputSize);
    
    for (let i = 0; i < outputSize; i++) {
        const inputIndex = i / stretchFactor;
        const lowerIndex = Math.floor(inputIndex);
        const upperIndex = Math.min(lowerIndex + 1, chunk.length - 1);
        const fraction = inputIndex - lowerIndex;
        
        output[i] = chunk[lowerIndex] * (1 - fraction) + chunk[upperIndex] * fraction;
    }
    
    return output;
}

function normalizeAudio(audioData) {
    let maxValue = 0;
    for (let i = 0; i < audioData.length; i++) {
        maxValue = Math.max(maxValue, Math.abs(audioData[i]));
    }
    
    if (maxValue > 0) {
        const scale = 0.95 / maxValue;
        for (let i = 0; i < audioData.length; i++) {
            audioData[i] *= scale;
        }
    }
    
    return audioData;
}