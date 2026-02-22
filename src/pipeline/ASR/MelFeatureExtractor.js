
import FFT from 'fft.js';

export class MelFeatureExtractor {
    constructor(config = {}) {
        this.sampleRate = config.sampleRate || 16000;
        this.numMelBins = config.numMelBins || 80;
        this.frameLengthMs = config.frameLengthMs || 25;
        this.frameShiftMs = config.frameShiftMs || 10;
        this.preemphasis = config.preemphasis || 0.97;
        this.lowFreq = config.lowFreq || 20;
        this.highFreq = config.highFreq || 8000; // usually Nyquist

        this.frameLen = Math.floor(this.sampleRate * this.frameLengthMs / 1000); // 400
        this.frameShift = Math.floor(this.sampleRate * this.frameShiftMs / 1000); // 160

        // FFT setup
        // Next power of 2
        this.fftSize = 2;
        while (this.fftSize < this.frameLen) this.fftSize *= 2; // usually 512
        this.fft = new FFT(this.fftSize);

        // Window (Povey window is default in Kaldi/Sherpa)
        // Povey: (0.5 - 0.5cos(..))^0.85
        this.window = new Float32Array(this.frameLen);
        for (let i = 0; i < this.frameLen; i++) {
            // Hamming would be: 0.54 - 0.46 * Math.cos(...)
            // Povey:
            const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (this.frameLen - 1));
            this.window[i] = Math.pow(h, 0.85);
        }

        this.melFilters = this._computeMelFilters();
    }

    extract(samples) {
        // samples is Float32Array
        let numFrames = Math.floor((samples.length - this.frameLen) / this.frameShift) + 1;
        if (numFrames <= 0) return new Float32Array(0);

        let features = new Float32Array(numFrames * this.numMelBins);

        const fftBuffer = new Float32Array(this.fftSize * 2); // Real + Imag
        const signalFrame = new Float32Array(this.fftSize);

        for (let i = 0; i < numFrames; i++) {
            let start = i * this.frameShift;

            // 1. Dither (Optional, usually 0.0 for deterministic)
            // 2. Remove DC Offset
            let sum = 0;
            for (let j = 0; j < this.frameLen; j++) {
                sum += samples[start + j] * 32768.0;
            }
            const mean = sum / this.frameLen;

            // 3. Preemphasis + Windowing
            let prev = (start > 0) ? (samples[start - 1] * 32768.0 - mean) : 0;

            for (let j = 0; j < this.frameLen; j++) {
                let curr = samples[start + j] * 32768.0 - mean; // Remove DC
                let val = curr - this.preemphasis * prev;
                prev = curr;
                signalFrame[j] = val * this.window[j];
            }
            // Zero pad rest
            for (let j = this.frameLen; j < this.fftSize; j++) {
                signalFrame[j] = 0;
            }

            // 2. FFT
            this.fft.realTransform(fftBuffer, signalFrame);
            // this.fft.completeSpectrum(fftBuffer); // Not needed if we just want magnitude of first half

            // 3. Power Spectrum
            // We only need first fftSize/2 + 1 bins
            const powerSpec = new Float32Array(this.fftSize / 2 + 1);
            for (let j = 0; j < powerSpec.length; j++) {
                let re = fftBuffer[j * 2];
                let im = fftBuffer[j * 2 + 1];
                powerSpec[j] = re * re + im * im;
            }

            // 4. Mel Filterbank & Log
            for (let m = 0; m < this.numMelBins; m++) {
                let energy = 0;
                let filters = this.melFilters[m];
                // filters is sparse: [{index, weight}, ...]
                for (let f = 0; f < filters.length; f++) {
                    const binIdx = filters[f].index;
                    if (binIdx < powerSpec.length) {
                        energy += filters[f].weight * powerSpec[binIdx];
                    }
                }
                // Log (add epsilon)
                if (energy < 1e-10) energy = 1e-10;
                features[i * this.numMelBins + m] = Math.log(energy);
            }
        }

        return features;
    }

    _computeMelFilters() {
        // Mel formula: 1127 * log(1 + f/700)
        // Inverse: 700 * (exp(m/1127) - 1)
        const melLow = 1127 * Math.log(1 + this.lowFreq / 700);
        const melHigh = 1127 * Math.log(1 + this.highFreq / 700);

        const melPoints = new Float32Array(this.numMelBins + 2);
        for (let i = 0; i < melPoints.length; i++) {
            melPoints[i] = melLow + (i * (melHigh - melLow) / (this.numMelBins + 1));
        }

        const hzPoints = new Float32Array(melPoints.length);
        for (let i = 0; i < hzPoints.length; i++) {
            hzPoints[i] = 700 * (Math.exp(melPoints[i] / 1127) - 1);
        }

        const binPoints = new Int32Array(hzPoints.length);
        for (let i = 0; i < hzPoints.length; i++) {
            binPoints[i] = Math.floor((this.fftSize + 1) * hzPoints[i] / this.sampleRate);
        }

        // Create filters
        let filters = [];
        for (let m = 1; m <= this.numMelBins; m++) {
            let weights = [];
            let start = binPoints[m - 1];
            let center = binPoints[m];
            let end = binPoints[m + 1];

            for (let k = start; k < center; k++) {
                weights.push({ index: k, weight: (k - start) / (center - start) });
            }
            for (let k = center; k < end; k++) {
                weights.push({ index: k, weight: (end - k) / (end - center) });
            }
            filters.push(weights);
        }
        return filters;
    }
}
