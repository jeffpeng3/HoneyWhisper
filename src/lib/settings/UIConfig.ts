import { SettingsStore } from "./SettingsStore";

export interface UIShape {
  fontSize: string;
  historyLines: number;
}

const DEFAULTS: UIShape = {
  fontSize: "24",
  historyLines: 1,
};

class UIConfig extends SettingsStore<UIShape> {
  constructor() {
    super("ui", 'sync', DEFAULTS);
  }
}

export const uiConfig = new UIConfig();
