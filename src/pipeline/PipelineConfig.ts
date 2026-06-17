export interface PipelineConfigType {
    asr: {
        profile: string;
        beamWidth: number;
        language: string;
    };
    translation: {
        enabled: boolean;
        service: string;
        target: string;
        showOriginal: boolean;
    };
}

export const pipelineConfig: PipelineConfigType = {
    asr: {
        profile: 'NORMAL',
        beamWidth: 1,
        language: 'ja',
    },
    translation: {
        enabled: false,
        service: 'google',
        target: 'zh-TW',
        showOriginal: true,
    },
};

export function updatePipelineConfig(settings: any) {
    if (settings.language) pipelineConfig.asr.language = settings.language;
    if (settings.nemotronProfile) pipelineConfig.asr.profile = settings.nemotronProfile;
    if (settings.beamWidth) pipelineConfig.asr.beamWidth = settings.beamWidth;

    if (typeof settings.translationEnabled !== 'undefined') pipelineConfig.translation.enabled = settings.translationEnabled;
    if (settings.translationService) pipelineConfig.translation.service = settings.translationService;
    if (settings.targetLanguage) pipelineConfig.translation.target = settings.targetLanguage;
    if (typeof settings.showOriginal !== 'undefined') pipelineConfig.translation.showOriginal = settings.showOriginal;
}
