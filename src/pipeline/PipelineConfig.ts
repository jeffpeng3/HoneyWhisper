export interface PipelineConfigType {
    asr: {
        type: 'webgpu' | 'wasm' | 'remote' | 'k2';
        model_id: string;
        quantization: string;
        language: string;
        endpoint?: string;
        key?: string;
    };
    translation: {
        enabled: boolean;
        service: string;
        target: string;
        showOriginal: boolean;
    };
    audioMode: 'vad' | 'sliding_window';
    vad: {
        positiveSpeechThreshold: number;
        negativeSpeechThreshold: number;
        minSpeechMs: number;
        redemptionMs: number;
    };
    slidingWindow: {
        windowSeconds: number;
        stepSeconds: number;
        volumeThreshold: number;
    };
}

export const pipelineConfig: PipelineConfigType = {
    asr: {
        type: 'webgpu',
        model_id: 'onnx-community/whisper-tiny',
        quantization: 'q4',
        language: 'ja',
        endpoint: '',
        key: ''
    },
    translation: {
        enabled: false,
        service: 'google',
        target: 'zh-TW',
        showOriginal: true
    },
    audioMode: 'vad',
    vad: {
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.45,
        minSpeechMs: 100,
        redemptionMs: 50
    },
    slidingWindow: {
        windowSeconds: 10,
        stepSeconds: 2,
        volumeThreshold: 0.01
    }
};

export function updatePipelineConfig(settings: any) {
    if (settings.language) pipelineConfig.asr.language = settings.language;
    if (settings.model_id) pipelineConfig.asr.model_id = settings.model_id;
    if (settings.quantization) pipelineConfig.asr.quantization = settings.quantization;

    if (settings.asrBackend) pipelineConfig.asr.type = settings.asrBackend;
    if (settings.remoteEndpoint) pipelineConfig.asr.endpoint = settings.remoteEndpoint;
    if (settings.remoteKey) pipelineConfig.asr.key = settings.remoteKey;

    if (typeof settings.translationEnabled !== 'undefined') pipelineConfig.translation.enabled = settings.translationEnabled;
    if (settings.translationService) pipelineConfig.translation.service = settings.translationService;
    if (settings.targetLanguage) pipelineConfig.translation.target = settings.targetLanguage;
    if (typeof settings.showOriginal !== 'undefined') pipelineConfig.translation.showOriginal = settings.showOriginal;

    if (settings.audioMode) pipelineConfig.audioMode = settings.audioMode;

    if (settings.vad) {
        pipelineConfig.vad = { ...pipelineConfig.vad, ...settings.vad };
    }

    if (settings.slidingWindow) {
        pipelineConfig.slidingWindow = { ...pipelineConfig.slidingWindow, ...settings.slidingWindow };
    }
}
