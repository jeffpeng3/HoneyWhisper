import { defineExtensionMessaging } from '@webext-core/messaging';

export interface ProtocolMap {
    // --- Popup to Background ---
    REQUEST_START: (data: { profileIndex: number }) => void;
    REQUEST_STOP: () => void;
    REQUEST_DOWNLOAD: (data: { profileIndex: number }) => void;
    GET_STATE: () => {
        isRecording: boolean;
        currentProfileIndex: number;
        vadStatus: 'idle' | 'speech' | 'quiet' | 'loading';
    };
    CHECK_MODEL_CACHED: (data: { model_id: string, device: string, quantization: string }) => boolean;

    // --- Background to Offscreen ---
    START_RECORDING: (data: {
        streamId: string;
        profileIndex: number;
        pipelineConfig: any;
    }) => void;
    STOP_RECORDING: () => void;
    DOWNLOAD_MODEL: (data: {
        profileIndex: number;
        pipelineConfig: any;
    }) => void;

    // --- Offscreen to Background ---
    RECORDING_STARTED: () => void;
    DOWNLOAD_COMPLETE: () => void;
    VAD_STATUS: (data: { status: 'speech' | 'quiet' | 'idle' }) => void;
    ASR_ERROR: (data: { error: string }) => void;

    // --- Offscreen to Popup ---
    DOWNLOAD_PROGRESS: (data: { progress: number, file: string, status?: string, error?: string }) => void;

    // --- Popup to Offscreen ---
    UPDATE_SETTINGS: (data: { settings: any }) => void;

    // --- Offscreen to Content Script ---
    RESULT: (data: { text: string; isFinal: boolean }) => void;
    CLEAR: () => void;
    PERFORMANCE_WARNING: (data: { message: string }) => void;

    // --- Background to Content Script ---
    REMOVE_OVERLAY: () => void;

    // --- Misc ---
    CLEAR_CACHE: () => void;
    GET_CACHED_MODELS: () => string[];
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
