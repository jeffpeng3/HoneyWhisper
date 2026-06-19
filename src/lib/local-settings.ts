import { defineExtensionStorage } from '@webext-core/storage';

export interface LocalSettings {
    geminiApiKey: string;
}

export const localStorage = defineExtensionStorage<LocalSettings>(browser.storage.local);

export const defaultLocalSettings: LocalSettings = {
    geminiApiKey: '',
};

export async function getLocalSettings(): Promise<LocalSettings> {
    const geminiApiKey = await localStorage.getItem('geminiApiKey') ?? defaultLocalSettings.geminiApiKey;
    return { geminiApiKey };
}
