# paulstretch

<div align="center">
  <img src="paul-stretch.png" alt="PaulStretch Logo" width="400"/>
  
  ### 🎮 [Live Demo](https://josephvolmer.github.io/paulstretch/) | 📦 [NPM Package](https://www.npmjs.com/package/paulstretch) | 📖 [Documentation](#api-reference)
</div>

Extreme time-stretching for audio files in the browser using Web Audio API. This library implements Paul's Extreme Sound Stretch algorithm (PaulStretch) to create dramatic time stretching effects while maintaining sound quality.

## 🚀 Try It Now!

**→ [Launch the Interactive Demo](https://josephvolmer.github.io/paulstretch/)**

Experience the power of extreme audio stretching directly in your browser. Upload any audio file and stretch it up to 50x its original length!

## Features

- 🎵 Browser-based audio processing
- ⚡ Asynchronous processing
- 🎚️ Adjustable stretch factor and window size
- 📱 Works with Files, Blobs, and URL strings
- 🌐 UMD module support
- 🔧 Customizable AudioContext

## Installation

```bash
npm install paulstretch
```

## Usage

### Basic Example

```javascript
import PaulStretch from 'paulstretch';
async function stretchAudio() {
    // Initialize with default settings (8x stretch, 0.25s window)
    const ps = new PaulStretch();
    try {
        // Load audio file
        const audioBuffer = await ps.loadAudio('path/to/audio.mp3');
        // Process the audio
        const stretchedBuffer = await ps.stretch(audioBuffer);
    // Use the stretched audio buffer...
    } catch (error) {
        console.error('Error processing audio:', error);
    }
}
```

### Custom Configuration

```javascript
const options = {
    stretchFactor: 10.0, // Stretch audio to 10x original length
    windowSize: 0.5, // Window size in seconds
    audioContext: CustomAudioContext // Optional custom AudioContext
};
const ps = new PaulStretch(options);
```

### Simple File Processing

```html
<input type="file" id="audioInput" accept="audio/*">
<button id="playButton">Stretch & Play</button>
<button id="downloadButton">Stretch & Download</button>
<audio id="player" controls></audio>
```

```javascript
const fileInput = document.getElementById('audioInput');
const playButton = document.getElementById('playButton');
const downloadButton = document.getElementById('downloadButton');
const player = document.getElementById('player');

const ps = new PaulStretch({ stretchFactor: 8.0 });

// One-line stretch and play
playButton.addEventListener('click', async () => {
    if (fileInput.files[0]) {
        await ps.processAndPlay(fileInput.files[0]);
    }
});

// One-line stretch and download
downloadButton.addEventListener('click', async () => {
    if (fileInput.files[0]) {
        await ps.processAndDownload(fileInput.files[0], 'my-stretched-audio.wav');
    }
});

// For audio player
document.getElementById('playerButton').addEventListener('click', async () => {
    if (fileInput.files[0]) {
        const audioBuffer = await ps.loadAudio(fileInput.files[0]);
        const stretched = await ps.stretch(audioBuffer);
        player.src = await ps.toUrl(stretched);
    }
});
```

### Even Simpler Examples

```javascript
// Just stretch and play - that's it!
await ps.processAndPlay('audio.mp3');

// Just stretch and download - that's it!
await ps.processAndDownload('audio.mp3', 'stretched.wav');

// Get a URL for embedding in audio elements
const audioBuffer = await ps.loadAudio('audio.mp3');
const stretched = await ps.stretch(audioBuffer);
const audioUrl = await ps.toUrl(stretched);
document.querySelector('#player').src = audioUrl;
```

## API Reference

### `PaulStretch` Class

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stretchFactor` | number | 8.0 | The amount to stretch the audio (e.g., 8.0 = 8x longer) |
| `windowSize` | number | 0.25 | Size of the processing window in seconds |
| `audioContext` | AudioContext | window.AudioContext | Custom AudioContext instance |

#### Methods

##### Core Methods

##### `loadAudio(input)`

- **Parameters:**
  - `input`: File | Blob | string (URL)
- **Returns:** Promise<AudioBuffer>
- **Description:** Loads and decodes audio from various input sources

##### `stretch(audioBuffer)`

- **Parameters:**
  - `audioBuffer`: AudioBuffer
- **Returns:** Promise<AudioBuffer>
- **Description:** Performs the time-stretching operation on the provided audio buffer

##### Utility Methods

##### `toBlob(audioBuffer, format = 'audio/wav')`

- **Parameters:**
  - `audioBuffer`: AudioBuffer - The stretched audio buffer
  - `format`: string - Audio format (default: 'audio/wav')
- **Returns:** Promise<Blob>
- **Description:** Converts AudioBuffer to a downloadable audio blob

##### `toUrl(audioBuffer, format = 'audio/wav')`

- **Parameters:**
  - `audioBuffer`: AudioBuffer - The stretched audio buffer
  - `format`: string - Audio format (default: 'audio/wav')
- **Returns:** Promise<string>
- **Description:** Creates an object URL from the AudioBuffer for use in audio elements

##### `play(audioBuffer)`

- **Parameters:**
  - `audioBuffer`: AudioBuffer - The stretched audio buffer
- **Returns:** Promise<void>
- **Description:** Plays the stretched audio directly through the browser's audio output

##### `download(audioBuffer, filename = 'stretched-audio.wav', format = 'audio/wav')`

- **Parameters:**
  - `audioBuffer`: AudioBuffer - The stretched audio buffer
  - `filename`: string - Name of the downloaded file
  - `format`: string - Audio format
- **Returns:** Promise<void>
- **Description:** Triggers download of the stretched audio as a file

##### Convenience Methods

##### `processAndPlay(input)`

- **Parameters:**
  - `input`: File | Blob | string (URL)
- **Returns:** Promise<AudioBuffer>
- **Description:** One-step method to load, stretch, and play audio

##### `processAndDownload(input, filename = 'stretched-audio.wav', format = 'audio/wav')`

- **Parameters:**
  - `input`: File | Blob | string (URL)
  - `filename`: string - Name of the downloaded file
  - `format`: string - Audio format
- **Returns:** Promise<AudioBuffer>
- **Description:** One-step method to load, stretch, and download audio

## Technical Details

The extreme stretching algorithm (based on PaulStretch) works by:

1. Breaking the audio into overlapping windows
2. Applying spectral processing to each window
3. Reconstructing the stretched audio using overlap-add synthesis

This implementation uses Web Audio API for processing and is optimized for browser environments, delivering extreme time-stretching capabilities directly in your web applications.

## Browser Compatibility

- Chrome 66+
- Firefox 75+
- Safari 14.1+
- Edge 79+

## Development

### Building from Source

```bash
# Install dependencies
npm install
# Run tests
npm test
# Build distribution files
npm run build
# Running Tests
npm test
```
