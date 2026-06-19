export interface VadConfig {
    enabled: boolean;
    threshold: number;
    minSpeech: number;
    minSilence: number;
    hold: number;
}

export interface PipelineConfigType {
    asr: {
        engine: string;
        profile: string;
        beamWidth: number;
        language: string;
        vad: VadConfig;
    };
    translation: {
        service: string;
        target: string;
        showOriginal: boolean;
    };
}

export const pipelineConfig: PipelineConfigType = {
    asr: {
        engine: 'nemotron',
        profile: 'NORMAL',
        beamWidth: 1,
        language: 'ja',
        vad: { enabled: false, threshold: 0.01, minSpeech: 0.25, minSilence: 0.4, hold: 0.15 },
    },
    translation: {
        service: 'none',
        target: 'zh-TW',
        showOriginal: true,
    },
};

export function updatePipelineConfig(settings: any) {
    if (settings.asrBackend) pipelineConfig.asr.engine = settings.asrBackend;
    const engine = settings.asrBackend || pipelineConfig.asr.engine;

    if (engine === 'nemotron') {
        if (settings.nemotronLanguage) pipelineConfig.asr.language = settings.nemotronLanguage;
        if (settings.nemotronProfile) pipelineConfig.asr.profile = settings.nemotronProfile;
        if (settings.beamWidth) pipelineConfig.asr.beamWidth = settings.beamWidth;
        if (typeof settings.vadEnabled !== 'undefined') pipelineConfig.asr.vad.enabled = settings.vadEnabled;
        if (typeof settings.vadThreshold !== 'undefined') pipelineConfig.asr.vad.threshold = settings.vadThreshold;
        if (typeof settings.vadMinSpeech !== 'undefined') pipelineConfig.asr.vad.minSpeech = settings.vadMinSpeech;
        if (typeof settings.vadMinSilence !== 'undefined') pipelineConfig.asr.vad.minSilence = settings.vadMinSilence;
        if (typeof settings.vadHold !== 'undefined') pipelineConfig.asr.vad.hold = settings.vadHold;
    }
    if (engine === 'gemini') {
        if (settings.geminiLanguage) pipelineConfig.asr.language = settings.geminiLanguage;
        if (settings.geminiApiKey) (pipelineConfig.asr as any).apiKey = settings.geminiApiKey;
    }

    if (settings.translationService) pipelineConfig.translation.service = settings.translationService;
    if (settings.targetLanguage) pipelineConfig.translation.target = settings.targetLanguage;
    if (typeof settings.showOriginal !== 'undefined') pipelineConfig.translation.showOriginal = settings.showOriginal;
}
