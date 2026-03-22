/**
 * AudioWorklet Processor for capturing and resampling audio to 16kHz.
 *
 * Receives audio at the AudioContext's native sample rate, resamples to 16kHz,
 * and posts the resampled PCM data back to the main thread.
 */
class ResamplerWorkletProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.targetSampleRate = 16000;
        this.inputSampleRate = options.processorOptions?.sampleRate || sampleRate;
        this.ratio = this.inputSampleRate / this.targetSampleRate;

        // Accumulation buffer for small 128-sample frames
        this._inputBuffer = [];
        this._inputBufferLength = 0;

        // Flush roughly every 0.1s of audio for efficient transfer
        this.flushThreshold = Math.ceil(this.inputSampleRate * 0.1);
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0] || input[0].length === 0) return true;

        const channelData = input[0]; // mono
        this._inputBuffer.push(new Float32Array(channelData));
        this._inputBufferLength += channelData.length;

        if (this._inputBufferLength >= this.flushThreshold) {
            this._flushAndResample();
        }

        return true;
    }

    _flushAndResample() {
        // Merge accumulated buffers
        const merged = new Float32Array(this._inputBufferLength);
        let offset = 0;
        for (const buf of this._inputBuffer) {
            merged.set(buf, offset);
            offset += buf.length;
        }
        this._inputBuffer = [];
        this._inputBufferLength = 0;

        // Resample via linear interpolation
        const outputLength = Math.round(merged.length / this.ratio);
        const output = new Float32Array(outputLength);

        for (let i = 0; i < outputLength; i++) {
            const srcIndex = i * this.ratio;
            const srcFloor = Math.floor(srcIndex);
            const srcCeil = Math.min(srcFloor + 1, merged.length - 1);
            const frac = srcIndex - srcFloor;
            output[i] = merged[srcFloor] * (1 - frac) + merged[srcCeil] * frac;
        }

        // Transfer to main thread
        this.port.postMessage({ type: 'audio', samples: output }, [output.buffer]);
    }
}

registerProcessor('resampler-worklet-processor', ResamplerWorkletProcessor);
