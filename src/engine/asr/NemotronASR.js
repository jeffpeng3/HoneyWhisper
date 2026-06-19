import { AsrEngine, LANG_TO_ID } from '@jeffpeng3/nemotron-asr-core';
import { BaseASR } from './BaseASR.js';

function fromSharedCode(code) {
  if (code === 'auto') return 101;
  const entry = LANG_TO_ID[code];
  return entry ? entry[0] : 101;
}

export class NemotronASR extends BaseASR {
  static async preload(onProgress) {
    return AsrEngine.preload(onProgress);
  }

  constructor() {
    super();
    this.engine = null;
    this._currentLang = null;
  }

  get detectedLanguage() {
    return this._currentLang ?? 'auto';
  }

  get providesTranslation() {
    return false;
  }

  get ready() {
    return this.engine?.ready ?? false;
  }

  async init({ profile = 'NORMAL', beamWidth = 1, vad = false, callbacks = {} } = {}) {
    const wasmPaths = chrome.runtime.getURL('/');
    this.engine = new AsrEngine(callbacks, { profile, beamWidth, vad, wasmPaths });
    await this.engine.init();
  }

  createSession(lang, vad) {
    if (!this.engine) throw new Error('Engine not initialized');
    const langId = fromSharedCode(lang);
    this._currentLang = lang;
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
