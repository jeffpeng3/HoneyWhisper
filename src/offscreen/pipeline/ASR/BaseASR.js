export class BaseASR {
    /**
     * Load the model with the given configuration
     * @param {object} config 
     */
    async load(config) {
        throw new Error("Not implemented");
    }

    /**
     * Transcribe audio data
     * @param {Float32Array} audioData 
     * @returns {Promise<{text: string}>}
     */
    async transcribe(audioData) {
        throw new Error("Not implemented");
    }

    /**
     * Release resources
     */
    async release() { }
}
