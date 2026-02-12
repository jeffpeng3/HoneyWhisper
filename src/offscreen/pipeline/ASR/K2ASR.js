import { BaseASR } from "./BaseASR.js";
import { MelFeatureExtractor } from "./MelFeatureExtractor.js";
import * as ort from 'onnxruntime-web';

// Constants for ReazonSpeech v2
const HF_REPO = "reazon-research/reazonspeech-k2-v2";
const HF_BRANCH = "main";
const FILES = {
    encoder: "encoder-epoch-99-avg-1.int8.onnx",
    decoder: "decoder-epoch-99-avg-1.int8.onnx",
    joiner: "joiner-epoch-99-avg-1.int8.onnx",
    tokens: "tokens.txt"
};

export class K2ASR extends BaseASR {
    constructor() {
        super();
        this.sessions = {};
        this.tokens = []; // Array of strings. Index = ID.
        this.cacheName = 'k2-models-v1';
        this.extractor = new MelFeatureExtractor({ numMelBins: 80 });
    }

    async load(config) {
        // config.model_id should be 'reazonspeech-k2-v2' (or similar)
        // config.progress_callback
        const { progress_callback } = config;

        const report = (text, pct) => {
            if (progress_callback) progress_callback({ status: 'progress', file: text, progress: pct });
        };

        // 1. Load Tokens
        const tokenText = await this._fetchAndCache(FILES.tokens, 'text', report);
        this.tokens = this._parseTokens(tokenText);
        console.log(`Loaded ${this.tokens.length} tokens.`);

        // 2. Load ONNX Sessions
        // Determine device for encoder
        const device = config.device || 'wasm';
        console.log(`[K2ASR] Loading encoder on ${device}...`);

        const encoderProviders = device === 'wasm' ? ['wasm'] : ['webgpu'];

        // Encoder
        const encoderOpts = {
            executionProviders: encoderProviders,
            graphOptimizationLevel: 'all'
        };
        // Decoder/Joiner on WASM (Small, frequent I/O)
        const decoderJoinerOpts = {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
        };

        // Helper to load session
        const loadSession = async (name, filename, opts) => {
            report(`Loading ${name}...`, 0);
            const buffer = await this._fetchAndCache(filename, 'arraybuffer', report);
            report(`Compiling ${name}...`, 50);
            try {
                this.sessions[name] = await ort.InferenceSession.create(buffer, opts);
            } catch (e) {
                console.warn(`Primary provider failed for ${name}, falling back to wasm`, e);
                this.sessions[name] = await ort.InferenceSession.create(buffer, { executionProviders: ['wasm'] });
            }
            report(`${name} Ready`, 100);
        };

        await loadSession('encoder', FILES.encoder, encoderOpts);
        // Note: Decoder and Joiner are much faster on CPU/WASM due to small batch/overhead constrains of WebGPU
        await loadSession('decoder', FILES.decoder, decoderJoinerOpts);
        await loadSession('joiner', FILES.joiner, decoderJoinerOpts);

        console.log("K2ASR Loaded");
    }

    async _fetchAndCache(filename, type, reportCallback) {
        const cache = await caches.open(this.cacheName);
        const url = `https://huggingface.co/${HF_REPO}/resolve/${HF_BRANCH}/${filename}`;

        // Check cache
        let response = await cache.match(url);

        if (!response) {
            console.log(`Downloading ${filename} from HF...`);
            reportCallback(`Downloading ${filename}`, 10);

            // Fetch from network
            const fetchResponse = await fetch(url);
            if (!fetchResponse.ok) throw new Error(`Failed to fetch ${url}`);

            // Clone to store in cache
            cache.put(url, fetchResponse.clone());
            response = fetchResponse;
        }

        if (type === 'text') return await response.text();
        if (type === 'arraybuffer') return await response.arrayBuffer();
        return response;
    }

    _parseTokens(text) {
        // Standard token format: "symbol id"
        // e.g. "<blk> 0", "a 1"
        const lines = text.split('\n');
        const map = []; // id -> symbol
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const symbol = parts.slice(0, parts.length - 1).join(' ');
                const id = parseInt(parts[parts.length - 1]);
                if (!isNaN(id)) {
                    map[id] = symbol;
                }
            }
        }
        return map;
    }

    async transcribe(audioData) {
        if (!this.sessions.encoder) throw new Error("K2ASR not initialized");

        // 1. Feature Extraction (Spectrogram)
        // Input: Float32Array 16kHz mono
        // Output: Float32Array [T, 80] (flattened)
        const features = this.extractor.extract(audioData);
        const numFrames = features.length / 80;

        if (numFrames === 0) return { text: "" };



        // Apply Utterance CMVN (Mean Subtraction)
        // 1. Compute Mean per channel
        const meanVec = new Float32Array(80).fill(0);
        for (let t = 0; t < numFrames; t++) {
            for (let c = 0; c < 80; c++) {
                meanVec[c] += features[t * 80 + c];
            }
        }
        for (let c = 0; c < 80; c++) meanVec[c] /= numFrames;

        // 2. Subtract Mean
        for (let t = 0; t < numFrames; t++) {
            for (let c = 0; c < 80; c++) {
                features[t * 80 + c] -= meanVec[c];
            }
        }



        // 2. Prepare Encoder Inputs (WebGPU)
        // x: [1, T, 80]
        // x_lens: [1] (value = T)
        const xTensor = new ort.Tensor('float32', features, [1, numFrames, 80]);
        // Note: x_lens must be int64. onnxruntime-web might expect BigInt64Array or just number array if compatible.
        // Usually BigInt64Array is safest for int64.
        const xLensTensor = new ort.Tensor('int64', new BigInt64Array([BigInt(numFrames)]), [1]);

        // Run Encoder
        const encoderResults = await this.sessions.encoder.run({ x: xTensor, x_lens: xLensTensor });
        // Output name might be 'encoder_out', 'src_mask' etc.
        // ReazonSpeech export usually has 'encoder_out' and 'encoder_out_lens'.
        // Let's assume 'encoder_out' matches specs roughly.
        // We get [1, T_subsampled, C_enc]

        // Find the output tensor. It is likely the first output or named 'encoder_out'.
        // We can inspect outputNames from session, but let's assume standard 'encoder_out'.
        // Or check dynamic names. 
        const encoderOutName = this.sessions.encoder.outputNames[0];
        const encoderOut = encoderResults[encoderOutName]; // [1, T, 512]

        const T = encoderOut.dims[1];
        const C_enc = encoderOut.dims[2];



        // 3. Greedy Search Decoding (WASM)
        // Default context: [0, 0]
        let hyp = [0n, 0n];
        let results = [];

        // Cache encoder data view to avoid overhead
        const encoderData = encoderOut.data;

        // Initial decoder run
        let decoderInput = new ort.Tensor('int64', new BigInt64Array(hyp), [1, 2]);
        let decoderFeeds = { y: decoderInput };
        if (this.sessions.decoder.inputNames.includes('need_pad')) {
            decoderFeeds.need_pad = new ort.Tensor('int64', new BigInt64Array([0n]), [1]);
        }
        let decoderOutResult = await this.sessions.decoder.run(decoderFeeds);
        let decoderOut = decoderOutResult[this.sessions.decoder.outputNames[0]];

        for (let t = 0; t < T; t++) {
            // Loop for standard Transducer greedy search
            let symPerFrame = 0;
            while (symPerFrame < 5) {
                // Joiner Input
                // Use subarray for zero-copy view if possible (depends on typed array type)
                // encoderData is likely Float32Array
                const encOffset = t * C_enc;
                const encFrameData = encoderData.subarray(encOffset, encOffset + C_enc);
                const encFrameTensor = new ort.Tensor('float32', encFrameData, [1, C_enc]);

                // decoderOut is already [1, C_dec] or [1, 1, C_dec]. 
                // We need to make sure shape matches.
                // If decoderOut from previous step is a Tensor, we reuse its data? 
                // Or we just used the output tensor directly.
                // We need to ensure it's wrapped correctly. 
                // The output of .run is a Tensor.

                const joinerResults = await this.sessions.joiner.run({
                    encoder_out: encFrameTensor,
                    decoder_out: decoderOut
                });

                const logits = joinerResults[this.sessions.joiner.outputNames[0]]; // [1, VocabSize]

                // Argmax
                const vocabSize = logits.dims[1];
                let maxVal = -Infinity;
                let maxId = 0;

                // Simple argmax loop
                for (let i = 0; i < vocabSize; i++) {
                    const val = logits.data[i];
                    if (val > maxVal) {
                        maxVal = val;
                        maxId = i;
                    }
                }



                if (maxId !== 0) { // 0 is Blank
                    results.push(maxId);

                    // Update context: shift left and append new id
                    // hyp = [hyp[1], newId]
                    hyp = [hyp[1], BigInt(maxId)];

                    // Run Decoder again
                    const nextDecoderInput = new ort.Tensor('int64', new BigInt64Array(hyp), [1, 2]);
                    const nextDecoderFeeds = { y: nextDecoderInput };
                    if (this.sessions.decoder.inputNames.includes('need_pad')) {
                        nextDecoderFeeds.need_pad = new ort.Tensor('int64', new BigInt64Array([0n]), [1]);
                    }
                    const nextDecoderResults = await this.sessions.decoder.run(nextDecoderFeeds);
                    decoderOut = nextDecoderResults[this.sessions.decoder.outputNames[0]];

                    symPerFrame++;
                } else {
                    break; // Emit blank, move to next frame (t++)
                }
            }
        }


        // Decode results to string
        const text = results.map(id => this.tokens[id]).join('').replace(/<blk>/g, '').replace(/_/g, ' '); // _ is often space substitute
        if (text) {
            console.log(text);
        }

        return { text: text };
    }

    async release() {
        // Release sessions
        for (const s of Object.values(this.sessions)) {
            try { await s.release(); } catch (e) { }
        }
        this.sessions = {};
    }
}

BaseASR.register('k2', K2ASR);
