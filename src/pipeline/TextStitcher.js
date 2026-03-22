/**
 * TextStitcher
 *
 * Stitches overlapping transcription segments using Longest Common Subsequence (LCS)
 * alignment. Manages finalized (stable) and intermediate (still-changing) text.
 */
export class TextStitcher {
    constructor() {
        /** Accumulated text that has been confirmed across multiple windows */
        this.finalizedText = '';

        /** The raw text from the most recent inference, used for overlap matching */
        this._lastFullText = '';

        /** How many characters from the tail of previous text to use for matching */
        this.overlapChars = 20;

        // (Removed maxFinalizedLength since PipelineController now needs the full text for sentence splitting)
    }

    /**
     * Get the complete stitched text so far.
     * @returns {string}
     */
    getFullText() {
        return this.finalizedText + this._lastFullText;
    }

    /**
     * Stitch new transcription text with the existing accumulated text.
     *
     * @param {string} newText - Full text output from the latest inference window
     * @returns {{ finalized: string, intermediate: string }}
     */
    stitch(newText) {
        if (!newText || newText.trim().length === 0) {
            return {
                finalized: this.finalizedText,
                intermediate: ''
            };
        }

        if (this._lastFullText.length === 0) {
            // First segment — everything is intermediate
            this._lastFullText = newText;
            return {
                finalized: '',
                intermediate: newText
            };
        }

        // Find the overlap between the tail of previous text and head of new text
        const prevTail = this._lastFullText.slice(-this.overlapChars);
        const newHead = newText.slice(0, this.overlapChars);

        const matchPoint = this._findBestOverlap(prevTail, newHead);

        if (matchPoint > 0) {
            // We found an overlap of `matchPoint` characters.
            // The portion of _lastFullText that is NOT in the new window is now finalized.
            const newlyFinalized = this._lastFullText.slice(0, this._lastFullText.length - matchPoint);
            this.finalizedText += newlyFinalized;
            this._lastFullText = newText;

            // The intermediate text is the non-overlapping new part
            const intermediate = newText.slice(matchPoint);
            return {
                finalized: this.finalizedText,
                intermediate: intermediate || newText
            };
        }

        // No overlap found — finalize ALL previous text, start fresh
        this.finalizedText += this._lastFullText;
        this._lastFullText = newText;

        return {
            finalized: this.finalizedText,
            intermediate: newText
        };
    }



    /**
     * Find the longest suffix of `a` that matches a prefix of `b`.
     * Returns the length of the overlap (0 if none found).
     *
     * @param {string} a - Tail of previous text
     * @param {string} b - Head of new text
     * @returns {number} Length of matching overlap
     * @private
     */
    _findBestOverlap(a, b) {
        const maxLen = Math.min(a.length, b.length);
        let bestLen = 0;

        for (let len = 1; len <= maxLen; len++) {
            const suffixA = a.slice(a.length - len);
            const prefixB = b.slice(0, len);
            if (suffixA === prefixB) {
                bestLen = len;
            }
        }

        // If exact suffix-prefix match is too short, try LCS-based fuzzy match
        if (bestLen < 3 && a.length >= 3 && b.length >= 3) {
            const lcsLen = this._lcsLength(a, b);
            // If LCS covers > 50% of the shorter string, consider it a match
            if (lcsLen >= Math.min(a.length, b.length) * 0.5) {
                // Use LCS alignment to find approximate overlap
                return this._findLCSOverlap(a, b);
            }
        }

        return bestLen;
    }

    /**
     * Compute the length of the Longest Common Subsequence of two strings.
     * @param {string} a
     * @param {string} b
     * @returns {number}
     * @private
     */
    _lcsLength(a, b) {
        const m = a.length;
        const n = b.length;
        // Use two rows to save memory
        let prev = new Uint16Array(n + 1);
        let curr = new Uint16Array(n + 1);

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (a[i - 1] === b[j - 1]) {
                    curr[j] = prev[j - 1] + 1;
                } else {
                    curr[j] = Math.max(prev[j], curr[j - 1]);
                }
            }
            [prev, curr] = [curr, prev];
            curr.fill(0);
        }
        return prev[n];
    }

    /**
     * Find the best overlap point using LCS alignment.
     * Returns the number of characters from the start of `b` that overlap with `a`.
     *
     * @param {string} a - Tail of previous text
     * @param {string} b - Head of new text
     * @returns {number}
     * @private
     */
    _findLCSOverlap(a, b) {
        // Try progressively longer prefixes of `b` against `a`
        // and find where the LCS ratio drops, indicating the overlap boundary
        const maxTest = Math.min(a.length, b.length);
        let bestOverlap = 0;
        let bestScore = 0;

        for (let len = 1; len <= maxTest; len++) {
            const prefix = b.slice(0, len);
            const lcs = this._lcsLength(a, prefix);
            const score = lcs / len;

            if (score > bestScore && score >= 0.5) {
                bestScore = score;
                bestOverlap = len;
            }
        }

        return bestOverlap;
    }

    /**
     * Force-finalize all current text (e.g. when stopping recording).
     * @returns {string} The complete finalized text
     */
    flush() {
        this.finalizedText += this._lastFullText;
        this._lastFullText = '';
        return this.finalizedText;
    }

    /**
     * Reset all state.
     */
    reset() {
        this.finalizedText = '';
        this._lastFullText = '';
    }
}
