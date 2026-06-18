import { defineExtensionStorage } from '@webext-core/storage';

export interface ExtensionSettings {
    asrBackend: string;
    language: string;
    nemotronProfile: string;
    beamWidth: number;
    vadEnabled: boolean;
    vadThreshold: number;
    vadMinSpeech: number;
    vadMinSilence: number;
    vadHold: number;
    fontSize: string;
    historyLines: number;
    translationService: string;
    targetLanguage: string;
    showOriginal: boolean;
}

export const extensionStorage = defineExtensionStorage<ExtensionSettings>(browser.storage.sync);

export const defaultSettings: ExtensionSettings = {
    asrBackend: "nemotron",
    language: "ja",
    nemotronProfile: "NORMAL",
    beamWidth: 1,
    vadEnabled: false,
    vadThreshold: 0.01,
    vadMinSpeech: 0.25,
    vadMinSilence: 0.4,
    vadHold: 0.15,
    fontSize: "24",
    historyLines: 1,
    translationService: "none",
    targetLanguage: "zh-TW",
    showOriginal: true,
};

export async function getSettings(): Promise<ExtensionSettings> {
    const asrBackend = await extensionStorage.getItem('asrBackend') ?? defaultSettings.asrBackend;
    const language = await extensionStorage.getItem('language') ?? defaultSettings.language;
    const nemotronProfile = await extensionStorage.getItem('nemotronProfile') ?? defaultSettings.nemotronProfile;
    const beamWidth = await extensionStorage.getItem('beamWidth') ?? defaultSettings.beamWidth;
    const vadEnabled = await extensionStorage.getItem('vadEnabled') ?? defaultSettings.vadEnabled;
    const vadThreshold = await extensionStorage.getItem('vadThreshold') ?? defaultSettings.vadThreshold;
    const vadMinSpeech = await extensionStorage.getItem('vadMinSpeech') ?? defaultSettings.vadMinSpeech;
    const vadMinSilence = await extensionStorage.getItem('vadMinSilence') ?? defaultSettings.vadMinSilence;
    const vadHold = await extensionStorage.getItem('vadHold') ?? defaultSettings.vadHold;
    const fontSize = await extensionStorage.getItem('fontSize') ?? defaultSettings.fontSize;
    const historyLines = await extensionStorage.getItem('historyLines') ?? defaultSettings.historyLines;
    const translationService = await extensionStorage.getItem('translationService') ?? defaultSettings.translationService;
    const targetLanguage = await extensionStorage.getItem('targetLanguage') ?? defaultSettings.targetLanguage;
    const showOriginal = await extensionStorage.getItem('showOriginal') ?? defaultSettings.showOriginal;

    return {
        asrBackend,
        language,
        nemotronProfile,
        beamWidth,
        vadEnabled,
        vadThreshold,
        vadMinSpeech,
        vadMinSilence,
        vadHold,
        fontSize,
        historyLines,
        translationService,
        targetLanguage,
        showOriginal
    };
}
