# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

PaulStretch is a browser-based implementation of Paul's Extreme Sound Stretch algorithm for extreme time-stretching of audio files. The library processes audio using Web Audio API and can handle File, Blob, and URL inputs.

## Architecture

The codebase follows a simple modular structure:

- **Main Class (`src/index.js`)**: The `PaulStretch` class handles audio loading, stretching, and processing using Web Audio API
- **Error Handling (`src/utils/errors.js`)**: Custom `PaulStretchError` class for proper error management
- **Audio Processing**: Uses overlap-add synthesis with windowing for time-stretching
- **UMD Build**: Webpack configuration builds to `dist/paulstretch.js` with UMD module format for browser compatibility

## Development Commands

```bash
# Install dependencies
npm install

# Build the distribution file
npm run build

# Run tests
npm test

# Serve test project (for manual testing)
npm run serve-test
```

## Testing

The project uses Jest with jsdom environment for testing. Tests are located in `tests/` directory and mock the AudioContext API for testing browser-based functionality.

## Key Implementation Details

- **AudioContext Requirement**: The library requires Web Audio API's AudioContext (checks for both standard and webkit-prefixed versions)
- **Stretch Algorithm**: Implements time-stretching through windowed chunks with overlap-add synthesis
- **Normalization**: Audio output is normalized to prevent clipping
- **Window Function**: Uses Hanning window for smooth overlapping
- **Step Size**: Uses 1/4 of window size for overlap processing