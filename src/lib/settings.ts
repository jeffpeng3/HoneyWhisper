import { defineExtensionStorage } from '@webext-core/storage';

export interface ExtensionSettings {
    language: string;
    nemotronProfile: string;
    beamWidth: number;
    fontSize: string;
    historyLines: number;
    translationEnabled: boolean;
    translationService: string;
    targetLanguage: string;
    showOriginal: boolean;
}

export const extensionStorage = defineExtensionStorage<ExtensionSettings>(browser.storage.sync);

export const defaultSettings: ExtensionSettings = {
    language: "ja",
    nemotronProfile: "NORMAL",
    beamWidth: 1,
    fontSize: "24",
    historyLines: 1,
    translationEnabled: false,
    translationService: "google",
    targetLanguage: "zh-TW",
    showOriginal: true,
};

export async function getSettings(): Promise<ExtensionSettings> {
    const language = await extensionStorage.getItem('language') ?? defaultSettings.language;
    const nemotronProfile = await extensionStorage.getItem('nemotronProfile') ?? defaultSettings.nemotronProfile;
    const beamWidth = await extensionStorage.getItem('beamWidth') ?? defaultSettings.beamWidth;
    const fontSize = await extensionStorage.getItem('fontSize') ?? defaultSettings.fontSize;
    const historyLines = await extensionStorage.getItem('historyLines') ?? defaultSettings.historyLines;
    const translationEnabled = await extensionStorage.getItem('translationEnabled') ?? defaultSettings.translationEnabled;
    const translationService = await extensionStorage.getItem('translationService') ?? defaultSettings.translationService;
    const targetLanguage = await extensionStorage.getItem('targetLanguage') ?? defaultSettings.targetLanguage;
    const showOriginal = await extensionStorage.getItem('showOriginal') ?? defaultSettings.showOriginal;

    return {
        language,
        nemotronProfile,
        beamWidth,
        fontSize,
        historyLines,
        translationEnabled,
        translationService,
        targetLanguage,
        showOriginal
    };
}
