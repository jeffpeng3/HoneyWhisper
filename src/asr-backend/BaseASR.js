export class BaseASR {
  static fromSharedCode(code) {
    return code;
  }

  static toSharedCode(internal) {
    return internal;
  }

  static async preload(onProgress) {
    // optional; subclasses may override
  }

  async preload(onProgress) {
    return this.constructor.preload(onProgress);
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



