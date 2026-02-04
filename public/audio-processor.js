class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        // inputs[0] is the first input, inputs[0][0] is the first channel
        const input = inputs[0];
        if (!input || !input.length) return true;

        const inputChannel = input[0];

        // Append to buffer
        if (this.bufferIndex + inputChannel.length <= this.bufferSize) {
            this.buffer.set(inputChannel, this.bufferIndex);
            this.bufferIndex += inputChannel.length;
        } else {
            // Buffer overflow handling (simple: copy what fits, flush, copy rest)
            // But AudioWorklet chunks are usually 128.
            // bufferSize 4096 is multiple of 128 (32 * 128).
            // So we should just fill up exactly.

            const spaceRemaining = this.bufferSize - this.bufferIndex;
            this.buffer.set(inputChannel.subarray(0, spaceRemaining), this.bufferIndex);

            // Flush
            this.port.postMessage(this.buffer.slice());

            // Reset and copy remaining
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;

            if (spaceRemaining < inputChannel.length) {
                const remaining = inputChannel.subarray(spaceRemaining);
                this.buffer.set(remaining, 0);
                this.bufferIndex = remaining.length;
            }
        }

        if (this.bufferIndex >= this.bufferSize) {
            this.port.postMessage(this.buffer.slice());
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
        }

        return true; // Keep processor alive
    }
}

registerProcessor('audio-processor', AudioProcessor);
