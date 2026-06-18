import { LANG_TO_ID } from '@jeffpeng3/nemotron-asr-core';
import { LANGUAGE_LABELS } from './shared';

export interface AsrLangOption {
    value: string;
    label: string;
}

export function getAsrLanguages(): AsrLangOption[] {
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
