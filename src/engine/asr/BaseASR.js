export class BaseASR {
  static async preload(onProgress) {
    // optional; subclasses may override
  }

  async preload(onProgress) {
    return this.constructor.preload(onProgress);
  }

  get detectedLanguage() {
    return 'auto';
  }

  async init(options) {
    throw new Error('Not implemented');
  }
  createSession(langId) {
    throw new Error('Not implemented');
  }
  async release() {
    throw new Error('Not implemented');
  }
  async clearCache() {
    throw new Error('Not implemented');
  }
}



