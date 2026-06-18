import { NemotronASR } from './NemotronASR.js';

export function createASR(type = 'nemotron') {
  switch (type) {
    case 'nemotron':
      return new NemotronASR();
    default:
      throw new Error(`Unknown ASR backend: ${type}`);
  }
}
