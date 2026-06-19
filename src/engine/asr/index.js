import { NemotronASR } from './NemotronASR.js';
import { GeminiASR } from './GeminiASR.js';

export function createASR(type = 'nemotron') {
  switch (type) {
    case 'nemotron':
      return new NemotronASR();
    case 'gemini':
      return new GeminiASR();
    default:
      throw new Error(`Unknown ASR backend: ${type}`);
  }
}
