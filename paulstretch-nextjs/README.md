# PaulStretch JS

<div align="center">
  <img src="https://raw.githubusercontent.com/yourusername/paulstretch-js/main/paul-stretch.png" alt="PaulStretch JS Logo" width="200">
  
  A browser-based implementation of Paul's Extreme Sound Stretch algorithm for extreme time-stretching of audio files. This library provides high-quality time-stretching with Web Worker support for performance.
</div>

## Features

- 🎵 Extreme time-stretching (up to 50x or more)
- 🚀 Web Worker support for non-blocking processing
- 📊 FFT-based spectral processing
- 🎛️ Configurable window size and stretch factor
- 📱 Works in all modern browsers
- 🔊 Supports multiple audio formats via Web Audio API

## Installation

```bash
npm install paulstretch-js
```

## Usage

### Basic Usage

```javascript
import PaulStretch from 'paulstretch-js';

// Create an instance
const paulstretch = new PaulStretch();

// Stretch an audio file
async function stretchAudio(file) {
  try {
    // Stretch by 8x with default settings
    const stretchedBlob = await paulstretch.stretch(file, 8);
    
    // Create a URL for playback or download
    const url = URL.createObjectURL(stretchedBlob);
    
    // Use the URL for an audio element or download
    const audio = new Audio(url);
    audio.play();
  } catch (error) {
    console.error('Stretching failed:', error);
  }
}
```

### Advanced Usage

```javascript
import PaulStretch from 'paulstretch-js';

const paulstretch = new PaulStretch({
  useWorkers: true,        // Enable Web Workers (default: true)
  numWorkers: 4           // Number of workers (default: navigator.hardwareConcurrency)
});

// Set progress callback
paulstretch.onProgress = (progress) => {
  console.log(`Processing: ${Math.round(progress * 100)}%`);
};

// Stretch with custom parameters
const stretchedBlob = await paulstretch.stretch(
  audioFile,              // File, Blob, URL, or ArrayBuffer
  10,                     // Stretch factor (10x slower)
  0.05                    // Window size in seconds
);

// Clean up workers when done
paulstretch.destroy();
```

### Input Types

The library accepts various input types:

```javascript
// File input (from file input element)
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const stretched = await paulstretch.stretch(file, 8);

// Blob
const blob = await fetch('audio.mp3').then(r => r.blob());
const stretched = await paulstretch.stretch(blob, 8);

// URL
const stretched = await paulstretch.stretch('https://example.com/audio.mp3', 8);

// ArrayBuffer
const arrayBuffer = await fetch('audio.mp3').then(r => r.arrayBuffer());
const stretched = await paulstretch.stretch(arrayBuffer, 8);
```

## API Reference

### `new PaulStretch(options)`

Creates a new PaulStretch instance.

**Options:**
- `useWorkers` (boolean): Enable Web Workers for processing. Default: `true`
- `numWorkers` (number): Number of workers to use. Default: `navigator.hardwareConcurrency || 4`

### `stretch(input, stretchFactor, windowSizeSeconds)`

Stretches the audio input.

**Parameters:**
- `input` (File|Blob|String|ArrayBuffer): The audio input
- `stretchFactor` (number): How much to stretch (e.g., 8 = 8x slower). Default: `8`
- `windowSizeSeconds` (number): FFT window size in seconds. Default: `0.05`

**Returns:** Promise<Blob> - The stretched audio as a WAV blob

### `destroy()`

Terminates all Web Workers and cleans up resources.

### `onProgress`

Progress callback function. Set this to track processing progress.

```javascript
paulstretch.onProgress = (progress) => {
  // progress is a number between 0 and 1
  console.log(`${Math.round(progress * 100)}% complete`);
};
```

## Worker Setup

For Web Worker support, ensure the `stretch-worker.js` file is accessible at the root of your web server. You can copy it from the npm package:

```bash
cp node_modules/paulstretch-js/public/stretch-worker.js ./public/
```

Or configure your build tool to copy it automatically.

### Webpack Example

```javascript
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: 'node_modules/paulstretch-js/public/stretch-worker.js', 
          to: 'stretch-worker.js' 
        }
      ]
    })
  ]
};
```

### Vite Example

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    {
      name: 'copy-worker',
      buildStart() {
        copyFileSync(
          'node_modules/paulstretch-js/public/stretch-worker.js',
          'public/stretch-worker.js'
        );
      }
    }
  ]
});
```

## How It Works

PaulStretch uses an FFT-based algorithm to stretch audio:

1. The audio is divided into overlapping windows
2. Each window is transformed to the frequency domain using FFT
3. The phase information is randomized while preserving magnitude
4. The modified spectrum is converted back to time domain
5. Windows are overlapped and added to create the stretched output

This process preserves the spectral characteristics while extending the temporal dimension, creating ethereal, ambient textures from any sound source.

## Browser Compatibility

- Chrome 66+
- Firefox 60+
- Safari 14.1+
- Edge 79+

Requires Web Audio API support.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

Based on the PaulStretch algorithm by Paul Nasca. This JavaScript implementation brings the classic extreme time-stretching algorithm to the web platform.