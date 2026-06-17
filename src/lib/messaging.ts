import { defineExtensionMessaging } from '@webext-core/messaging';

export interface ProtocolMap {
    REQUEST_START: () => void;
    REQUEST_STOP: () => void;
    GET_STATE: () => {
        isRecording: boolean;
        currentTabId: number | null;
        modelReady: boolean;
    };

    START_RECORDING: (data: {
        streamId: string;
        pipelineConfig: any;
    }) => void;
    STOP_RECORDING: () => void;

    INIT_MODEL: () => void;
    MODEL_READY: () => void;

    RECORDING_STARTED: () => void;
    ASR_ERROR: (data: { error: string }) => void;

    UPDATE_SETTINGS: (data: { settings: any }) => void;

    RESULT: (data: { text: string; isFinal: boolean; translatedText?: string | null }) => void;
    REMOVE_OVERLAY: () => void;
    DOWNLOAD_PROGRESS: (data: { progress: number; file: string; status?: string; cached?: boolean }) => void;
    BENCHMARK_ASR: (data: { beamWidths: number[] }) => Array<{
        profile: string;
        beamWidth: number;
        rtf: number;
        latencyLabel: string;
    }>;
    BENCHMARK_RESULT: (data: Array<{
        profile: string;
        beamWidth: number;
        rtf: number;
        latencyLabel: string;
    }>) => void;
    CLOSE_OFFSCREEN: () => void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
