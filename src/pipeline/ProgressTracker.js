import { sendMessage } from "$lib/messaging";

export class MultiFileProgress {
    constructor() {
        this.files = {}; // { filename: { progress: 0, weight: 1 } }
        this.lastProgress = 0;
    }

    update(data) {
        if (data.status === 'initiate') {
            const isModel = data.file && data.file.endsWith('.onnx');
            const weight = isModel ? 100 : 1;
            this.files[data.file] = {
                progress: 0,
                weight: weight
            };
        } else if (data.status === 'progress') {
            if (!this.files[data.file]) {
                const isModel = data.file && data.file.endsWith('.onnx');
                this.files[data.file] = { progress: 0, weight: isModel ? 100 : 1 };
            }
            this.files[data.file].progress = data.progress || 0;
        } else if (data.status === 'done') {
            if (data.file) {
                if (this.files[data.file]) {
                    this.files[data.file].progress = 100;
                }
            } else {
                this.lastProgress = 100;
                reportProgressRaw({ status: 'done', progress: 100 });
                return;
            }
        }

        const ESTIMATED_TOTAL_WEIGHT = 220;

        let currentWeightedSum = 0;
        for (const f of Object.values(this.files)) {
            currentWeightedSum += f.progress * f.weight;
        }

        let global = currentWeightedSum / ESTIMATED_TOTAL_WEIGHT;

        if (global < this.lastProgress) global = this.lastProgress;
        if (global > 99) global = 99;

        this.lastProgress = global;

        reportProgressRaw({
            status: 'progress',
            progress: global,
            file: data.file,
        });
    }

    reset() {
        this.files = {};
        this.lastProgress = 0;
    }
}

export const progressTracker = new MultiFileProgress();

export function reportProgressRaw(data) {
    sendMessage('DOWNLOAD_PROGRESS', {
        progress: data.progress || 0,
        file: data.file || 'System',
        status: data.status,
        error: data.error
    }).catch(() => { });
}

export function reportProgress(data) {
    if (data.status === 'done' && !data.file) {
        progressTracker.update(data);
        progressTracker.reset();
    } else if (data.status === 'error') {
        reportProgressRaw(data);
    } else {
        progressTracker.update(data);
    }
}
