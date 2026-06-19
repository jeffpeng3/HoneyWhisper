import { LANG_TO_ID } from '@jeffpeng3/nemotron-asr-core';
import { LANGUAGE_LABELS } from './shared';

export interface AsrLangOption {
    value: string;
    label: string;
}

export function getAsrLanguages(engine?: string): AsrLangOption[] {
    if (engine === 'gemini') {
        const langs = Object.entries(LANGUAGE_LABELS)
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
        langs.unshift({ value: 'auto', label: 'Auto-detect' });
        return langs;
    }
    const seen = new Map<number, string>();
    for (const [code, [id]] of Object.entries(LANG_TO_ID)) {
        if (id === 101) continue;
        const existing = seen.get(id);
        if (!existing || code.length < existing.code.length) {
            seen.set(id, code);
        }
    }
    const langs = [...seen.values()]
        .map((code) => ({ value: code, label: LANGUAGE_LABELS[code] ?? code }))
        .sort((a, b) => a.label.localeCompare(b.label));
    langs.push({ value: 'auto', label: 'Auto-detect' });
    return langs;
}
