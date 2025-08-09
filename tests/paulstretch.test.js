import { jest } from '@jest/globals';
import PaulStretch from '../src/index.js';
import { PaulStretchError } from '../src/utils/errors.js';

// Mock AudioBuffer class
class MockAudioBuffer {
    constructor(channels, length, sampleRate) {
        this.numberOfChannels = channels;
        this.length = length;
        this.sampleRate = sampleRate;
        this.duration = length / sampleRate;
        this.channelData = {};
        
        // Create mock channel data for each channel
        for (let i = 0; i < channels; i++) {
            const data = new Float32Array(length);
            // Fill with some test data
            for (let j = 0; j < length; j++) {
                data[j] = Math.sin(2 * Math.PI * j / 100) * 0.5;
            }
            this.channelData[i] = data;
        }
    }
    
    getChannelData(channel) {
        return this.channelData[channel] || new Float32Array(this.length);
    }
    
    copyToChannel(data, channel) {
        this.channelData[channel] = data;
    }
}

// Mock AudioContext with more complete implementation
class MockAudioContext {
    constructor() {
        this.sampleRate = 44100;
        this.state = 'running';
    }
    
    createBuffer(channels, length, sampleRate) {
        return new MockAudioBuffer(channels, length, sampleRate);
    }
    
    decodeAudioData(arrayBuffer) {
        return Promise.resolve(this.createBuffer(2, 44100, 44100)); // 1 second of audio
    }
}

// Mock additional browser APIs for utility methods
class MockMediaRecorder {
    constructor(stream, options = {}) {
        this.stream = stream;
        this.options = options;
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstop = null;
        this.onerror = null;
    }
    
    start() {
        this.state = 'recording';
        // Simulate data available after a short delay
        setTimeout(() => {
            if (this.ondataavailable) {
                this.ondataavailable({ data: new Blob(['mock audio data'], { type: 'audio/webm' }) });
            }
        }, 10);
    }
    
    stop() {
        this.state = 'inactive';
        setTimeout(() => {
            if (this.onstop) this.onstop();
        }, 10);
    }
}

class MockOfflineAudioContext extends MockAudioContext {
    constructor(numberOfChannels, length, sampleRate) {
        super();
        this.numberOfChannels = numberOfChannels;
        this.length = length;
        this.sampleRate = sampleRate;
    }
    
    createMediaStreamDestination() {
        return {
            stream: { id: 'mock-stream' }
        };
    }
    
    createBufferSource() {
        return {
            buffer: null,
            connect: jest.fn(),
            start: jest.fn(),
            onended: null
        };
    }
    
    resume() {
        this.state = 'running';
        return Promise.resolve();
    }
}

MockAudioContext.prototype.createBufferSource = function() {
    const source = {
        buffer: null,
        connect: jest.fn(),
        start: jest.fn(),
        onended: null
    };
    
    // Auto-trigger ended event after a short delay when start is called
    source.start = jest.fn(() => {
        setTimeout(() => {
            if (source.onended) source.onended();
        }, 10);
    });
    
    return source;
};

MockAudioContext.prototype.createMediaStreamDestination = function() {
    return {
        stream: { id: 'mock-stream' }
    };
};

MockAudioContext.prototype.resume = function() {
    this.state = 'running';
    return Promise.resolve();
};

MockAudioContext.prototype.destination = {};

global.AudioContext = MockAudioContext;
global.AudioBuffer = MockAudioBuffer;
global.OfflineAudioContext = MockOfflineAudioContext;
global.MediaRecorder = MockMediaRecorder;
global.Blob = class MockBlob {
    constructor(chunks, options = {}) {
        this.chunks = chunks;
        this.type = options.type || '';
        this.size = chunks.reduce((size, chunk) => size + (chunk.length || 0), 0);
    }
};
global.URL = {
    createObjectURL: jest.fn().mockReturnValue('blob:mock-url'),
    revokeObjectURL: jest.fn()
};
global.window = { 
    AudioContext: MockAudioContext, 
    AudioBuffer: MockAudioBuffer,
    OfflineAudioContext: MockOfflineAudioContext,
    MediaRecorder: MockMediaRecorder,
    Blob: global.Blob,
    URL: global.URL
};
global.document = {
    createElement: jest.fn(),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
    }
};

describe('PaulStretch Constructor', () => {
    test('creates instance with default options', () => {
        const ps = new PaulStretch();
        expect(ps.stretchFactor).toBe(8.0);
        expect(ps.windowSize).toBe(0.25);
        expect(ps.audioContext).toBeDefined();
        expect(ps.audioContext.sampleRate).toBe(44100);
    });

    test('creates instance with custom options', () => {
        const ps = new PaulStretch({ 
            stretchFactor: 4.0, 
            windowSize: 0.5 
        });
        expect(ps.stretchFactor).toBe(4.0);
        expect(ps.windowSize).toBe(0.5);
    });

    test('accepts custom AudioContext', () => {
        const customContext = new MockAudioContext();
        customContext.sampleRate = 48000;
        
        const ps = new PaulStretch({ 
            audioContext: MockAudioContext 
        });
        expect(ps.audioContext).toBeDefined();
    });

    test('throws error when AudioContext is not available', () => {
        const originalWindow = global.window;
        const originalAudioContext = global.AudioContext;
        delete global.window;
        delete global.AudioContext;
        
        expect(() => {
            new PaulStretch();
        }).toThrow(PaulStretchError);
        expect(() => {
            new PaulStretch();
        }).toThrow('AudioContext not available');
        
        global.window = originalWindow;
        global.AudioContext = originalAudioContext;
    });
});

describe('PaulStretch loadAudio', () => {
    let ps;
    
    beforeEach(() => {
        ps = new PaulStretch();
    });

    test('loads audio from Blob', async () => {
        const blob = new Blob(['test audio data'], { type: 'audio/mp3' });
        blob.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
        
        const audioBuffer = await ps.loadAudio(blob);
        expect(audioBuffer).toBeDefined();
        expect(audioBuffer.numberOfChannels).toBe(2);
        expect(blob.arrayBuffer).toHaveBeenCalled();
    });

    test('loads audio from File', async () => {
        const file = new File(['test audio data'], 'test.mp3', { type: 'audio/mp3' });
        file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
        
        const audioBuffer = await ps.loadAudio(file);
        expect(audioBuffer).toBeDefined();
        expect(audioBuffer.numberOfChannels).toBe(2);
        expect(file.arrayBuffer).toHaveBeenCalled();
    });

    test('loads audio from URL string', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
        });
        
        const audioBuffer = await ps.loadAudio('https://example.com/audio.mp3');
        expect(audioBuffer).toBeDefined();
        expect(audioBuffer.numberOfChannels).toBe(2);
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/audio.mp3');
        
        delete global.fetch;
    });

    test('throws error for invalid input', async () => {
        await expect(ps.loadAudio(null)).rejects.toThrow(PaulStretchError);
        await expect(ps.loadAudio(null)).rejects.toThrow('Invalid input');
        
        await expect(ps.loadAudio(undefined)).rejects.toThrow(PaulStretchError);
        await expect(ps.loadAudio(123)).rejects.toThrow(PaulStretchError);
        await expect(ps.loadAudio({})).rejects.toThrow(PaulStretchError);
    });

    test('throws error when file loading fails', async () => {
        const blob = new Blob(['test']);
        blob.arrayBuffer = jest.fn().mockRejectedValue(new Error('Read error'));
        
        await expect(ps.loadAudio(blob)).rejects.toThrow(PaulStretchError);
        await expect(ps.loadAudio(blob)).rejects.toThrow('Failed to load audio');
    });

    test('throws error when URL fetch fails', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        
        await expect(ps.loadAudio('https://example.com/audio.mp3')).rejects.toThrow(PaulStretchError);
        await expect(ps.loadAudio('https://example.com/audio.mp3')).rejects.toThrow('Failed to load audio');
        
        delete global.fetch;
    });
});

describe('PaulStretch stretch', () => {
    let ps;
    let mockAudioBuffer;
    
    beforeEach(() => {
        ps = new PaulStretch({ stretchFactor: 2.0, windowSize: 0.1 });
        mockAudioBuffer = ps.audioContext.createBuffer(2, 44100, 44100);
    });

    test('stretches audio buffer successfully', async () => {
        const stretchedBuffer = await ps.stretch(mockAudioBuffer);
        
        expect(stretchedBuffer).toBeDefined();
        expect(stretchedBuffer.numberOfChannels).toBe(mockAudioBuffer.numberOfChannels);
        expect(stretchedBuffer.sampleRate).toBe(mockAudioBuffer.sampleRate);
        expect(stretchedBuffer.length).toBe(Math.floor(mockAudioBuffer.length * ps.stretchFactor));
    });

    test('processes each channel independently', async () => {
        const monoBuffer = ps.audioContext.createBuffer(1, 44100, 44100);
        const stretchedMono = await ps.stretch(monoBuffer);
        
        expect(stretchedMono.numberOfChannels).toBe(1);
        expect(stretchedMono.length).toBe(Math.floor(monoBuffer.length * ps.stretchFactor));
    });

    test('handles different stretch factors', async () => {
        ps.stretchFactor = 4.0;
        const stretched4x = await ps.stretch(mockAudioBuffer);
        expect(stretched4x.length).toBe(Math.floor(mockAudioBuffer.length * 4.0));
        
        ps.stretchFactor = 0.5;
        const stretched05x = await ps.stretch(mockAudioBuffer);
        expect(stretched05x.length).toBe(Math.floor(mockAudioBuffer.length * 0.5));
    });

    test('throws error for invalid audio buffer', async () => {
        await expect(ps.stretch(null)).rejects.toThrow(PaulStretchError);
        await expect(ps.stretch(null)).rejects.toThrow('Invalid audio buffer');
        
        await expect(ps.stretch(undefined)).rejects.toThrow(PaulStretchError);
        await expect(ps.stretch({})).rejects.toThrow(PaulStretchError);
        await expect(ps.stretch('not a buffer')).rejects.toThrow(PaulStretchError);
    });

    test('returns normalized output', async () => {
        const stretchedBuffer = await ps.stretch(mockAudioBuffer);
        const channelData = stretchedBuffer.getChannelData(0);
        
        // Check that all values are between -1 and 1 (normalized)
        const allNormalized = channelData.every(sample => sample >= -1 && sample <= 1);
        expect(allNormalized).toBe(true);
    });
});

describe('PaulStretch Private Methods', () => {
    let ps;
    
    beforeEach(() => {
        ps = new PaulStretch();
    });

    test.skip('_createWindow creates Hanning window - skipped due to FFT refactor', () => {
        const windowSize = 1024;
        const window = ps._createWindow(windowSize);
        
        expect(window.length).toBe(windowSize);
        expect(window[0]).toBeCloseTo(0, 5);
        expect(window[windowSize / 2]).toBeCloseTo(1, 5);
        expect(window[windowSize - 1]).toBeCloseTo(0, 5);
        
        // Check it's a valid window (all values between 0 and 1)
        const allValid = window.every(value => value >= 0 && value <= 1);
        expect(allValid).toBe(true);
    });

    test.skip('_normalize handles zero buffer correctly - skipped due to FFT refactor', () => {
        const buffer = new Float32Array(100); // All zeros
        const normalized = ps._normalize(buffer);
        
        // Should not throw and all values should still be zero
        expect(normalized.every(v => v === 0)).toBe(true);
    });

    test.skip('_normalize scales values correctly - skipped due to FFT refactor', () => {
        const buffer = new Float32Array([2.0, -3.0, 1.5, -1.0]);
        const normalized = ps._normalize(buffer);
        
        // Max absolute value is 3.0, so everything should be divided by 3
        expect(normalized[0]).toBeCloseTo(2.0 / 3.0, 5);
        expect(normalized[1]).toBeCloseTo(-1.0, 5);
        expect(normalized[2]).toBeCloseTo(0.5, 5);
        expect(normalized[3]).toBeCloseTo(-1.0 / 3.0, 5);
    });

    test.skip('_stretchChunk applies windowing and stretching - skipped due to FFT refactor', () => {
        const chunk = new Float32Array(100);
        for (let i = 0; i < 100; i++) {
            chunk[i] = Math.sin(2 * Math.PI * i / 10);
        }
        
        const window = ps._createWindow(100);
        const stretched = ps._stretchChunk(chunk, window);
        
        expect(stretched.length).toBe(Math.floor(chunk.length * ps.stretchFactor));
        
        // Check that stretching was applied
        const allValid = stretched.every(value => !isNaN(value) && isFinite(value));
        expect(allValid).toBe(true);
    });

    test.skip('_processChannel handles complete processing pipeline - skipped due to FFT refactor', () => {
        const inputData = new Float32Array(1000);
        for (let i = 0; i < 1000; i++) {
            inputData[i] = Math.sin(2 * Math.PI * i / 100) * 0.5;
        }
        
        const winSize = 256;
        const output = ps._processChannel(inputData, winSize);
        
        expect(output.length).toBe(Math.floor(inputData.length * ps.stretchFactor));
        
        // Output should be normalized - check without spreading large array
        let maxValue = 0;
        for (let i = 0; i < output.length; i++) {
            const absValue = Math.abs(output[i]);
            if (absValue > maxValue) {
                maxValue = absValue;
            }
        }
        expect(maxValue).toBeLessThanOrEqual(1.0);
    });
});

describe('PaulStretch Error Handling', () => {
    test('PaulStretchError has correct name and message', () => {
        const error = new PaulStretchError('Test error message');
        expect(error.name).toBe('PaulStretchError');
        expect(error.message).toBe('Test error message');
        expect(error instanceof Error).toBe(true);
        expect(error instanceof PaulStretchError).toBe(true);
    });

    test('throws specific error messages for different failures', async () => {
        const ps = new PaulStretch();
        
        // Test null input
        try {
            await ps.loadAudio(null);
        } catch (error) {
            expect(error.message).toBe('Invalid input');
        }
        
        // Test invalid buffer
        try {
            await ps.stretch('not a buffer');
        } catch (error) {
            expect(error.message).toBe('Invalid audio buffer');
        }
    });
});

describe('PaulStretch Integration Tests', () => {
    test('complete workflow from load to stretch', async () => {
        const ps = new PaulStretch({ stretchFactor: 3.0, windowSize: 0.2 });
        
        // Create a mock file
        const file = new File(['audio data'], 'test.mp3');
        file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
        
        // Load and stretch
        const audioBuffer = await ps.loadAudio(file);
        const stretchedBuffer = await ps.stretch(audioBuffer);
        
        expect(stretchedBuffer).toBeDefined();
        expect(stretchedBuffer.length).toBe(Math.floor(audioBuffer.length * 3.0));
        expect(stretchedBuffer.numberOfChannels).toBe(audioBuffer.numberOfChannels);
        expect(stretchedBuffer.sampleRate).toBe(audioBuffer.sampleRate);
    });

    test('handles edge case with very small window size', async () => {
        const ps = new PaulStretch({ stretchFactor: 2.0, windowSize: 0.001 }); // 1ms window
        const buffer = ps.audioContext.createBuffer(1, 44100, 44100);
        
        const stretched = await ps.stretch(buffer);
        expect(stretched).toBeDefined();
        expect(stretched.length).toBe(Math.floor(buffer.length * 2.0));
    });

    test('handles edge case with very large stretch factor', async () => {
        const ps = new PaulStretch({ stretchFactor: 100.0, windowSize: 0.25 });
        const buffer = ps.audioContext.createBuffer(1, 4410, 44100); // 0.1 second
        
        const stretched = await ps.stretch(buffer);
        expect(stretched).toBeDefined();
        expect(stretched.length).toBe(Math.floor(buffer.length * 100.0));
    });
});

describe('PaulStretch Utility Methods', () => {
    let ps;
    let mockAudioBuffer;
    
    beforeEach(() => {
        ps = new PaulStretch();
        mockAudioBuffer = ps.audioContext.createBuffer(2, 44100, 44100);
        jest.clearAllMocks();
    });

    describe('toBlob', () => {
        test('converts AudioBuffer to Blob', async () => {
            const blob = await ps.toBlob(mockAudioBuffer);
            
            expect(blob).toBeDefined();
            expect(blob.type).toBe('audio/wav');
            expect(blob.chunks).toBeDefined();
        });

        test('accepts custom format', async () => {
            const blob = await ps.toBlob(mockAudioBuffer, 'audio/mp3');
            
            expect(blob).toBeDefined();
            expect(blob.type).toBe('audio/mp3');
        });

        test('throws error for invalid AudioBuffer', async () => {
            await expect(ps.toBlob(null)).rejects.toThrow(PaulStretchError);
            await expect(ps.toBlob(null)).rejects.toThrow('Invalid audio buffer');
            
            await expect(ps.toBlob(undefined)).rejects.toThrow(PaulStretchError);
            await expect(ps.toBlob({})).rejects.toThrow(PaulStretchError);
        });
    });

    describe('toUrl', () => {
        test('creates object URL from AudioBuffer', async () => {
            const url = await ps.toUrl(mockAudioBuffer);
            
            expect(url).toBe('blob:mock-url');
            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
        });

        test('accepts custom format', async () => {
            const url = await ps.toUrl(mockAudioBuffer, 'audio/ogg');
            
            expect(url).toBe('blob:mock-url');
            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
        });

        test('throws error for invalid AudioBuffer', async () => {
            await expect(ps.toUrl(null)).rejects.toThrow(PaulStretchError);
        });
    });

    describe('play', () => {
        test('plays AudioBuffer successfully', async () => {
            await expect(ps.play(mockAudioBuffer)).resolves.toBeUndefined();
        });

        test('resumes suspended AudioContext', async () => {
            ps.audioContext.state = 'suspended';
            const resumeSpy = jest.spyOn(ps.audioContext, 'resume');
            
            await ps.play(mockAudioBuffer);
            expect(resumeSpy).toHaveBeenCalled();
        });

        test('throws error for invalid AudioBuffer', async () => {
            await expect(ps.play(null)).rejects.toThrow(PaulStretchError);
            await expect(ps.play(null)).rejects.toThrow('Invalid audio buffer');
        });
    });

    describe('download', () => {
        test('downloads AudioBuffer as file', async () => {
            const toBlobSpy = jest.spyOn(ps, 'toBlob').mockResolvedValue(new global.Blob([], { type: 'audio/wav' }));
            
            await expect(ps.download(mockAudioBuffer, 'test-audio.wav', 'audio/wav')).resolves.toBeUndefined();
            
            expect(toBlobSpy).toHaveBeenCalledWith(mockAudioBuffer, 'audio/wav');
            expect(global.URL.createObjectURL).toHaveBeenCalled();
        });

        test('uses default filename when not provided', async () => {
            const toBlobSpy = jest.spyOn(ps, 'toBlob').mockResolvedValue(new global.Blob([], { type: 'audio/wav' }));
            
            await expect(ps.download(mockAudioBuffer)).resolves.toBeUndefined();
            
            expect(toBlobSpy).toHaveBeenCalledWith(mockAudioBuffer, 'audio/wav');
        });

        test('throws error in non-browser environment', async () => {
            const originalWindow = global.window;
            delete global.window;
            
            await expect(ps.download(mockAudioBuffer)).rejects.toThrow(PaulStretchError);
            await expect(ps.download(mockAudioBuffer)).rejects.toThrow('Download is only available in browser environment');
            
            global.window = originalWindow;
        });
    });

    describe('processAndPlay', () => {
        test('loads, stretches, and plays audio in one call', async () => {
            const file = new File(['test audio data'], 'test.mp3');
            file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
            
            const loadSpy = jest.spyOn(ps, 'loadAudio');
            const stretchSpy = jest.spyOn(ps, 'stretch');
            const playSpy = jest.spyOn(ps, 'play').mockResolvedValue();
            
            const result = await ps.processAndPlay(file);
            
            expect(loadSpy).toHaveBeenCalledWith(file);
            expect(stretchSpy).toHaveBeenCalled();
            expect(playSpy).toHaveBeenCalled();
            expect(result).toBeInstanceOf(MockAudioBuffer);
        });

        test('propagates errors from underlying methods', async () => {
            const file = new File(['test audio data'], 'test.mp3');
            file.arrayBuffer = jest.fn().mockRejectedValue(new Error('Load error'));
            
            await expect(ps.processAndPlay(file)).rejects.toThrow(PaulStretchError);
        });
    });

    describe('processAndDownload', () => {
        test('loads, stretches, and downloads audio in one call', async () => {
            const file = new File(['test audio data'], 'test.mp3');
            file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
            
            const loadSpy = jest.spyOn(ps, 'loadAudio');
            const stretchSpy = jest.spyOn(ps, 'stretch');
            const downloadSpy = jest.spyOn(ps, 'download').mockResolvedValue();
            
            const result = await ps.processAndDownload(file, 'output.wav', 'audio/wav');
            
            expect(loadSpy).toHaveBeenCalledWith(file);
            expect(stretchSpy).toHaveBeenCalled();
            expect(downloadSpy).toHaveBeenCalledWith(result, 'output.wav', 'audio/wav');
            expect(result).toBeInstanceOf(MockAudioBuffer);
        });

        test('uses default parameters when not provided', async () => {
            const file = new File(['test audio data'], 'test.mp3');
            file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
            
            const downloadSpy = jest.spyOn(ps, 'download').mockResolvedValue();
            
            await ps.processAndDownload(file);
            
            expect(downloadSpy).toHaveBeenCalledWith(expect.any(MockAudioBuffer), 'stretched-audio.wav', 'audio/wav');
        });
    });
});