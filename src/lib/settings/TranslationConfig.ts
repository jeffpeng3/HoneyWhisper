import { SettingsStore } from "./SettingsStore";

export interface TranslationShape {
  service: string;
  target: string;
  showOriginal: boolean;
}

const DEFAULTS: TranslationShape = {
  service: "none",
  target: "zh-TW",
  showOriginal: true,
};

class TranslationConfig extends SettingsStore<TranslationShape> {
  constructor() {
    super("translation", 'sync', DEFAULTS);
  }
}

export const translationConfig = new TranslationConfig();
