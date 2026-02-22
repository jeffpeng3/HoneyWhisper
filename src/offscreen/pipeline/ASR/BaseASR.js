export class BaseASR {
    static registry = new Map();

    static register(name, cls) {
        BaseASR.registry.set(name, cls);
    }

    static get(name) {
        return BaseASR.registry.get(name);
    }

    static create(name, ...args) {
        const cls = BaseASR.get(name);
        if (!cls) {
            throw new Error(`ASR Service '${name}' not found`);
        }
        return new cls(...args);
    }

    /**
     * Download model files to cache without loading into memory.
     * Subclasses should override for efficient cache-only download.
     * @param {object} config 
     */
    async download(config) {
        // Default: load then release (subclasses should override for efficiency)
        await this.load(config);
        await this.release();
    }

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
