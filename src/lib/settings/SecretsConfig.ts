import { SettingsStore } from "./SettingsStore";

export interface SecretsShape {
  geminiApiKey: string;
}

const DEFAULTS: SecretsShape = {
  geminiApiKey: "",
};

class SecretsConfig extends SettingsStore<SecretsShape> {
  constructor() {
    super("secrets", 'local', DEFAULTS);
  }
}

export const secretsConfig = new SecretsConfig();
