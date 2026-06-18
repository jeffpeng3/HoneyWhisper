import { LANGUAGE_LABELS } from './shared';

export interface TranslationLangOption {
    value: string;
    label: string;
}

const TARGET_CODES: (keyof typeof LANGUAGE_LABELS)[] = [
    'zh-TW',
    'zh-CN',
    'en',
    'ja',
    'ko',
    'es',
    'fr',
    'de',
];

export const TRANSLATION_LANGUAGES: TranslationLangOption[] = TARGET_CODES.map((code) => ({
    value: code,
    label: LANGUAGE_LABELS[code],
}));
