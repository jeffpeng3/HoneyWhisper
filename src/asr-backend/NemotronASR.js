import { AsrEngine } from '@jeffpeng3/nemotron-asr-core';
import { BaseASR } from './BaseASR.js';

export class NemotronASR extends BaseASR {
  static async preload(onProgress) {
    return AsrEngine.preload(onProgress);
  }

  constructor() {
    super();
    this.engine = null;
  }

  get ready() {
    return this.engine?.ready ?? false;
  }

  async init({ profile = 'NORMAL', beamWidth = 1, callbacks = {} } = {}) {
    const wasmPaths = chrome.runtime.getURL('/');
    this.engine = new AsrEngine(callbacks, { profile, beamWidth, wasmPaths });
    await this.engine.init();
  }

  createSession(langId) {
    if (!this.engine) throw new Error('Engine not initialized');
    return this.engine.session(langId);
  }

  async release() {
    this.engine = null;
  }

  async clearCache() {
    if (this.engine) {
      await this.engine.clearCache();
    }
  }
}
