import PaulStretch from './index.js';
import PaulStretchOptimized from './paulstretch-optimized.js';
import PaulStretchFFT from './paulstretch-fft.js';
import PaulStretchParallel from './paulstretch-parallel.js';

class Benchmark {
    constructor() {
        this.results = [];
    }

    async createTestAudio(duration = 1, sampleRate = 44100) {
        // Create a test audio buffer with sine wave
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const length = duration * sampleRate;
        const buffer = audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = buffer.getChannelData(channel);
            const frequency = 440 * (channel + 1); // Different frequency for each channel
            
            for (let i = 0; i < length; i++) {
                channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
            }
        }
        
        return buffer;
    }

    async measurePerformance(implementation, audioBuffer, options = {}) {
        const startTime = performance.now();
        let progressUpdates = 0;
        
        const progressCallback = (progress) => {
            progressUpdates++;
        };
        
        try {
            const result = await implementation.stretch(audioBuffer, progressCallback);
            const endTime = performance.now();
            
            return {
                duration: endTime - startTime,
                outputLength: result.length,
                progressUpdates,
                success: true
            };
        } catch (error) {
            const endTime = performance.now();
            return {
                duration: endTime - startTime,
                error: error.message,
                success: false
            };
        }
    }

    async runBenchmark(audioDuration = 1, stretchFactor = 8) {
        console.log(`Running benchmark with ${audioDuration}s audio, stretch factor ${stretchFactor}x`);
        
        const audioBuffer = await this.createTestAudio(audioDuration);
        const options = { stretchFactor, windowSize: 0.25 };
        
        const implementations = [
            { name: 'Original', class: PaulStretch },
            { name: 'Optimized', class: PaulStretchOptimized },
            { name: 'FFT', class: PaulStretchFFT },
            { name: 'Parallel', class: PaulStretchParallel }
        ];
        
        const results = {};
        
        for (const impl of implementations) {
            console.log(`Testing ${impl.name}...`);
            
            try {
                const instance = new impl.class(options);
                const result = await this.measurePerformance(instance, audioBuffer, options);
                
                results[impl.name] = {
                    duration: result.duration,
                    durationFormatted: `${result.duration.toFixed(2)}ms`,
                    samplesPerSecond: audioBuffer.length / (result.duration / 1000),
                    success: result.success,
                    error: result.error
                };
                
                if (instance.dispose) {
                    instance.dispose();
                }
            } catch (error) {
                results[impl.name] = {
                    error: error.message,
                    success: false
                };
            }
        }
        
        // Calculate speedup relative to original
        if (results.Original && results.Original.success) {
            const baselineDuration = results.Original.duration;
            
            for (const name in results) {
                if (results[name].success) {
                    results[name].speedup = (baselineDuration / results[name].duration).toFixed(2) + 'x';
                }
            }
        }
        
        this.results.push({
            audioDuration,
            stretchFactor,
            timestamp: new Date().toISOString(),
            results
        });
        
        return results;
    }

    async runFullBenchmarkSuite() {
        const testCases = [
            { duration: 0.5, stretchFactor: 4 },
            { duration: 1, stretchFactor: 8 },
            { duration: 2, stretchFactor: 8 },
            { duration: 1, stretchFactor: 16 }
        ];
        
        const allResults = [];
        
        for (const testCase of testCases) {
            console.log(`\n--- Test Case: ${testCase.duration}s audio, ${testCase.stretchFactor}x stretch ---`);
            const results = await this.runBenchmark(testCase.duration, testCase.stretchFactor);
            allResults.push({ ...testCase, results });
            
            // Print results
            this.printResults(results);
        }
        
        return allResults;
    }

    printResults(results) {
        console.log('\nBenchmark Results:');
        console.log('-'.repeat(60));
        
        const sortedResults = Object.entries(results)
            .filter(([_, r]) => r.success)
            .sort((a, b) => a[1].duration - b[1].duration);
        
        for (const [name, result] of sortedResults) {
            console.log(`${name.padEnd(15)} | ${result.durationFormatted.padEnd(12)} | Speedup: ${(result.speedup || '1.00x').padEnd(8)} | ${Math.floor(result.samplesPerSecond).toLocaleString()} samples/sec`);
        }
        
        // Show errors if any
        const errors = Object.entries(results).filter(([_, r]) => !r.success);
        if (errors.length > 0) {
            console.log('\nErrors:');
            for (const [name, result] of errors) {
                console.log(`${name}: ${result.error}`);
            }
        }
    }

    compareQuality(original, optimized) {
        // Simple quality comparison - calculate RMS difference
        if (original.length !== optimized.length) {
            return { error: 'Different output lengths' };
        }
        
        let sumSquaredDiff = 0;
        let maxDiff = 0;
        
        for (let i = 0; i < original.length; i++) {
            const diff = Math.abs(original[i] - optimized[i]);
            sumSquaredDiff += diff * diff;
            maxDiff = Math.max(maxDiff, diff);
        }
        
        const rmsDiff = Math.sqrt(sumSquaredDiff / original.length);
        
        return {
            rmsDifference: rmsDiff,
            maxDifference: maxDiff,
            similar: rmsDiff < 0.01 // Threshold for similarity
        };
    }
}

// Export for use in browser or Node.js
if (typeof window !== 'undefined') {
    window.Benchmark = Benchmark;
}

export default Benchmark;