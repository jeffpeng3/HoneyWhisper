export interface VadSettings {
    positiveSpeechThreshold: number;
    negativeSpeechThreshold: number;
    minSpeechMs: number;
    redemptionMs: number;
}

export interface WhisperProfile {
    id: string;
    name: string;
    prompt: string;
    language: string;
}
