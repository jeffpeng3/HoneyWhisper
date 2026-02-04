import { BaseTranslator } from "./BaseTranslator.js";

// Constants ported from un-ts/deeplx
const DEEPL_BASE_URL = 'https://www2.deepl.com/jsonrpc';
const COMMON_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'x-app-os-name': 'iOS',
    'x-app-os-version': '16.3.0',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'x-app-device': 'iPhone13,2',
    'User-Agent': 'DeepL-iOS/2.9.1 iOS 16.3.0 (iPhone13,2)',
    'x-app-build': '510265',
    'x-app-version': '2.9.1',
    'Connection': 'keep-alive',
};

// Utils ported from un-ts/deeplx
function getICount(text) {
    return (text.match(/i/g) || []).length;
}

function getRandomNumber() {
    const base = Math.floor(Math.random() * 99999) + 8300000;
    return base * 1000;
}

function getTimeStamp(iCount) {
    const ts = Date.now();
    if (iCount !== 0) {
        const adjustedCount = iCount + 1;
        return ts - (ts % adjustedCount) + adjustedCount;
    }
    return ts;
}

function formatPostString(postData) {
    const postStr = JSON.stringify(postData);
    // Logic to add space to "method": "..." based on ID
    const shouldAddSpace = (postData.id + 5) % 29 === 0 || (postData.id + 3) % 13 === 0;
    return postStr.replace('"method":"', shouldAddSpace ? '"method" : "' : '"method": "');
}

export class DeepLTranslator extends BaseTranslator {
    async translate(text, sourceLang, targetLang) {
        if (!text) return "";

        try {
            // Whisper gives us sourceLang, but DeepL expects uppercase codes usually
            // DeepL handles "auto" as source well, but we have it from Whisper
            const sl = sourceLang === 'auto' ? 'auto' : sourceLang.toUpperCase().split('-')[0];
            const tl = targetLang ? targetLang.toUpperCase().split('-')[0] : 'ZH'; // Default to Chinese if missing

            // Mimic logic for splitting text if needed (keeping it simple for now, per sentence usually)
            // But if text contains newlines, we should handle it or just send it.
            // un-ts/deeplx splits by newline.

            const id = getRandomNumber();
            const jobs = [{
                kind: 'default',
                preferred_num_beams: 4,
                raw_en_context_before: [],
                raw_en_context_after: [],
                sentences: [{
                    prefix: '',
                    text: text,
                    id: 0 // un-ts/deeplx uses 0 for single sentence or handled loop
                }]
            }];

            const hasRegionalVariant = false; // logic for PT-PT etc can be added if needed
            // targetLangCode logic simpler here

            const postData = {
                jsonrpc: '2.0',
                method: 'LMT_handle_jobs',
                id: id,
                params: {
                    commonJobParams: {
                        mode: 'translate',
                        formality: 'undefined',
                        transcribe_as: 'romanize',
                        advancedMode: false,
                        textType: 'plaintext',
                        wasSpoken: false,
                    },
                    lang: {
                        source_lang_user_selected: 'auto', // Mimic user auto selection
                        target_lang: tl,
                        source_lang_computed: sl === 'auto' ? null : sl,
                    },
                    jobs: jobs,
                    timestamp: getTimeStamp(getICount(text)),
                }
            };

            // Fix source_lang_computed if it shouldn't be null/auto in specific way? 
            // Actually DeepL free client behavior usually sends computed if known.
            // If sl is 'auto', source_lang_computed should be stripped or null.
            if (sl === 'auto') {
                delete postData.params.lang.source_lang_computed;
            }

            const response = await fetch(DEEPL_BASE_URL, {
                method: 'POST',
                headers: COMMON_HEADERS,
                body: formatPostString(postData)
            });

            if (!response.ok) {
                // Try to read error
                const errText = await response.text();
                throw new Error(`DeepL API Error ${response.status}: ${errText}`);
            }

            const data = await response.json();

            // Parse result
            // Structure: result.translations[0].beams[0].sentences[0].text
            if (data.result && data.result.translations && data.result.translations.length > 0) {
                const translation = data.result.translations[0].beams[0].sentences[0].text;
                return translation;
            } else {
                return text + " [Translation Empty]";
            }

        } catch (e) {
            console.error("DeepL Translation failed:", e);
            // Fallback
            return text + " [DeepL Error]";
        }
    }
}


// Register
BaseTranslator.register('deepl', DeepLTranslator);
