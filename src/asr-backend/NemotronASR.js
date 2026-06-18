import { AsrEngine, LANG_TO_ID } from '@jeffpeng3/nemotron-asr-core';
import { BaseASR } from './BaseASR.js';

export class NemotronASR extends BaseASR {
  static fromSharedCode(code) {
    if (code === 'auto') return 101;
    const entry = LANG_TO_ID[code];
    return entry ? entry[0] : 101;
  }

  static toSharedCode(langId) {
    for (const [code, [id]] of Object.entries(LANG_TO_ID)) {
      if (id === langId) return code;
    }
    return null;
  }

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

  async init({ profile = 'NORMAL', beamWidth = 1, vad = false, callbacks = {} } = {}) {
    const wasmPaths = chrome.runtime.getURL('/');
    this.engine = new AsrEngine(callbacks, { profile, beamWidth, vad, wasmPaths });
    await this.engine.init();
  }

  createSession(langId, vad) {
    if (!this.engine) throw new Error('Engine not initialized');
    return this.engine.session(langId, vad);
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
