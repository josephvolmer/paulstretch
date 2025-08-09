export class PaulStretchError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PaulStretchError';
    }
}