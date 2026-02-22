import { BaseASR } from "./BaseASR.js";
import { encodeWAV } from "../utils/wavUtils.js";

export class RemoteASR extends BaseASR {
    constructor() {
        super();
        this.endpoint = "http://localhost:9000/v1/audio/transcriptions"; // Default
        this.apiKey = "";
        this.language = "en";
    }

    async load(config) {
        // config can override the endpoint and key
        if (config.endpoint) this.endpoint = config.endpoint;
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.language) this.language = config.language;
    }

    async transcribe(audioData) {
        try {
            const wavBlob = encodeWAV(audioData, 16000); // Assume 16kHz
            const formData = new FormData();
            formData.append("file", wavBlob, "audio.wav");
            formData.append("model", "whisper-1"); // Standard for OpenAI API compatibility
            formData.append("language", this.language);

            const headers = {};
            if (this.apiKey) {
                headers["Authorization"] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: headers,
                body: formData
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errText}`);
            }

            const data = await response.json();
            return { text: data.text || "" };
        } catch (error) {
            console.error("RemoteASR Transcribe Error:", error);
            throw error;
        }
    }
}

// Register implementations
BaseASR.register('remote', RemoteASR);
