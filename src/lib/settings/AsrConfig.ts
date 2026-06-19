import { SettingsStore } from "./SettingsStore";

export interface VadConfig {
  enabled: boolean;
  threshold: number;
  minSpeech: number;
  minSilence: number;
  hold: number;
}

export interface NemotronConfig {
  language: string;
  profile: string;
  beamWidth: number;
  vad: VadConfig;
}

export interface GeminiConfig {
  language: string;
}

export interface AsrShape {
  engine: string;
  nemotron: NemotronConfig;
  gemini: GeminiConfig;
}

const DEFAULTS: AsrShape = {
  engine: "nemotron",
  nemotron: {
    language: "ja",
    profile: "NORMAL",
    beamWidth: 1,
    vad: { enabled: false, threshold: 0.01, minSpeech: 0.25, minSilence: 0.4, hold: 0.15 },
  },
  gemini: {
    language: "auto",
  },
};

class AsrConfig extends SettingsStore<AsrShape> {
  constructor() {
    super("asr", 'sync', DEFAULTS);
  }
}

export const asrConfig = new AsrConfig();
