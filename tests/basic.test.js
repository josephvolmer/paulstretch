import PaulStretch from '../src/index.js';

// Mock AudioContext
global.AudioContext = class AudioContext {
  constructor() {
    this.sampleRate = 44100;
  }
  createBuffer(channels, length, sampleRate) {
    return {
      numberOfChannels: channels,
      length: length,
      sampleRate: sampleRate
    };
  }
};

describe('PaulStretch', () => {
    let ps;

    beforeEach(() => {
        ps = new PaulStretch();
    });

    test('creates instance with default options', () => {
        expect(ps.stretchFactor).toBe(8.0);
        expect(ps.windowSize).toBe(0.25);
    });

    test('creates instance with custom options', () => {
        ps = new PaulStretch({ stretchFactor: 4.0, windowSize: 0.5 });
        expect(ps.stretchFactor).toBe(4.0);
        expect(ps.windowSize).toBe(0.5);
    });
});
