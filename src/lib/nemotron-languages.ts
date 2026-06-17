import { LANG_TO_ID } from '@jeffpeng3/nemotron-asr-core';

export interface LangOption {
    value: string;
    label: string;
}

export function getNemotronLanguages(): LangOption[] {
    const seen = new Map<number, { code: string; name: string }>();

    for (const [code, [id, name]] of Object.entries(LANG_TO_ID)) {
        if (id === 101) continue;
        const existing = seen.get(id);
        if (!existing || code.length < existing.code.length) {
            seen.set(id, { code, name });
        }
    }

    const langs = [...seen.values()]
        .map((l) => ({ value: l.code, label: l.name }))
        .sort((a, b) => a.label.localeCompare(b.label));

    langs.push({ value: 'auto', label: 'Auto-detect' });
    return langs;
}
