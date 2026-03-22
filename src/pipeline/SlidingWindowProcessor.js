/**
 * SlidingWindowProcessor
 *
 * Manages a fixed-size overlapping sliding window over a continuous PCM audio stream.
 * When enough new audio has accumulated (stepSize), it emits the latest windowSize
 * samples for inference. Includes a volume gate to skip silent segments.
 */
export class SlidingWindowProcessor {
    /**
     * @param {object} opts
     * @param {number} opts.windowSeconds  - Window length in seconds (default 10)
     * @param {number} opts.stepSeconds    - Step / stride in seconds (default 2)
     * @param {number} opts.volumeThreshold - RMS threshold below which inference is skipped (default 0.01)
     * @param {number} opts.sampleRate     - Expected sample rate (default 16000)
     * @param {(chunk: Float32Array) => void} opts.onWindowReady - Callback with audio chunk
     */
    constructor(opts = {}) {
        this.sampleRate = opts.sampleRate ?? 16000;
        this.windowSize = (opts.windowSeconds ?? 10) * this.sampleRate;
        this.stepSize = (opts.stepSeconds ?? 2) * this.sampleRate;
        this.volumeThreshold = opts.volumeThreshold ?? 0.01;
        this.onWindowReady = opts.onWindowReady ?? null;

        /** @type {Float32Array[]} */
        this._chunks = [];
        this._totalSamples = 0;
        this._samplesConsumed = 0; // samples already stepped over
    }

    /**
     * Feed new PCM samples into the buffer.
     * Automatically triggers onWindowReady when enough new audio is available.
     * @param {Float32Array} samples - 16 kHz mono PCM
     */
    feed(samples) {
        if (!samples || samples.length === 0) return;

        this._chunks.push(samples);
        this._totalSamples += samples.length;

        // Check if we have accumulated enough NEW samples since last emission
        const newSamples = this._totalSamples - this._samplesConsumed;
        if (newSamples >= this.stepSize) {
            this._emit();
        }
    }

    /**
     * Extract the current window and invoke the callback.
     * @private
     */
    _emit() {
        // Merge all chunks into a single buffer
        const merged = this._merge();

        // Determine the window: take the last windowSize samples (or all if shorter)
        const windowStart = Math.max(0, merged.length - this.windowSize);
        const window = merged.subarray(windowStart);

        // Volume gate: compute RMS and skip if below threshold
        const rms = this._rms(window);
        if (rms < this.volumeThreshold) {
            console.log(`[SlidingWindow] Volume gate: RMS=${rms.toFixed(4)} < ${this.volumeThreshold}, skipped`);
            // Still advance the consumed pointer so we don't keep re-checking
            this._advanceBuffer(merged);
            return;
        }

        console.log(`[SlidingWindow] Emitting window: ${(window.length / this.sampleRate).toFixed(1)}s, RMS=${rms.toFixed(4)}`);

        if (this.onWindowReady) {
            // Pass a copy so downstream can hold onto it
            this.onWindowReady(new Float32Array(window));
        }

        this._advanceBuffer(merged);
    }

    /**
     * Advance the internal buffer: keep only the overlap portion.
     * @param {Float32Array} merged
     * @private
     */
    _advanceBuffer(merged) {
        // We want to keep (windowSize - stepSize) = overlap samples for next window
        const keepFrom = Math.max(0, merged.length - (this.windowSize - this.stepSize));
        const kept = merged.subarray(keepFrom);

        this._chunks = [new Float32Array(kept)];
        this._totalSamples = kept.length;
        // Mark overlap samples as already consumed — only truly NEW samples should count
        this._samplesConsumed = kept.length;
    }

    /**
     * Merge all chunks into a single Float32Array.
     * @returns {Float32Array}
     * @private
     */
    _merge() {
        if (this._chunks.length === 1) return this._chunks[0];

        const result = new Float32Array(this._totalSamples);
        let offset = 0;
        for (const chunk of this._chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }

    /**
     * Compute the RMS (root mean square) of an audio buffer.
     * @param {Float32Array} buf
     * @returns {number}
     * @private
     */
    _rms(buf) {
        if (buf.length === 0) return 0;
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
            sum += buf[i] * buf[i];
        }
        return Math.sqrt(sum / buf.length);
    }

    /**
     * Reset all internal state.
     */
    reset() {
        this._chunks = [];
        this._totalSamples = 0;
        this._samplesConsumed = 0;
    }
}
