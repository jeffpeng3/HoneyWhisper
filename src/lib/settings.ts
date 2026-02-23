import { defineExtensionStorage } from '@webext-core/storage';
import { DEFAULT_PROFILES } from './ModelRegistry';

export interface ExtensionSettings {
    profiles: any[];
    activeProfileId: string;
    language: string;
    fontSize: string;
    historyLines: number;
    translationEnabled: boolean;
    translationService: string;
    targetLanguage: string;
    showOriginal: boolean;
    vad: {
        positiveSpeechThreshold: number;
        negativeSpeechThreshold: number;
        minSpeechMs: number;
        redemptionMs: number;
    };
}

export const extensionStorage = defineExtensionStorage<ExtensionSettings>(browser.storage.sync);

export const defaultSettings: ExtensionSettings = {
    profiles: DEFAULT_PROFILES,
    activeProfileId: DEFAULT_PROFILES[0].id,
    language: "ja",
    fontSize: "24",
    historyLines: 1,
    translationEnabled: false,
    translationService: "google",
    targetLanguage: "zh-TW",
    showOriginal: true,
    vad: {
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.45,
        minSpeechMs: 100,
        redemptionMs: 50,
    }
};

export async function getSettings(): Promise<ExtensionSettings> {
    const activeProfileId = await extensionStorage.getItem('activeProfileId') ?? defaultSettings.activeProfileId;
    const profiles = await extensionStorage.getItem('profiles') ?? defaultSettings.profiles;
    const language = await extensionStorage.getItem('language') ?? defaultSettings.language;
    const fontSize = await extensionStorage.getItem('fontSize') ?? defaultSettings.fontSize;
    const historyLines = await extensionStorage.getItem('historyLines') ?? defaultSettings.historyLines;
    const translationEnabled = await extensionStorage.getItem('translationEnabled') ?? defaultSettings.translationEnabled;
    const translationService = await extensionStorage.getItem('translationService') ?? defaultSettings.translationService;
    const targetLanguage = await extensionStorage.getItem('targetLanguage') ?? defaultSettings.targetLanguage;
    const showOriginal = await extensionStorage.getItem('showOriginal') ?? defaultSettings.showOriginal;
    const vad = await extensionStorage.getItem('vad') ?? defaultSettings.vad;

    return {
        activeProfileId,
        profiles,
        language,
        fontSize,
        historyLines,
        translationEnabled,
        translationService,
        targetLanguage,
        showOriginal,
        vad
    };
}
