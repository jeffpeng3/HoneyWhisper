const SENTENCE_BOUNDARY = /[。！？.!?\n]+/;

export class Segmenter {
  constructor({ timeoutMs = 500 } = {}) {
    this.buffer = '';
    this.timeoutMs = timeoutMs;
    this.timer = null;
    this.onTimeout = null;
  }

  
  feed(text) {
    this.buffer += text;
    const sentences = [];
    let match;
    while ((match = SENTENCE_BOUNDARY.exec(this.buffer)) !== null) {
      const endIdx = match.index + match[0].length;
      sentences.push(this.buffer.slice(0, endIdx));
      this.buffer = this.buffer.slice(endIdx);
    }
    this._resetTimer();
    return sentences;
  }

  get partial() {
    return this.buffer || null;
  }

  flush() {
    this._clearTimer();
    const remaining = this.buffer;
    this.buffer = '';
    return remaining || null;
  }

  _resetTimer() {
    this._clearTimer();
    if (this.onTimeout && this.buffer) {
      this.timer = setTimeout(() => {
        const text = this.flush();
        if (text && this.onTimeout) {
          this.onTimeout(text);
        }
      }, this.timeoutMs);
    }
  }

  _clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  reset() {
    this._clearTimer();
    this.buffer = '';
  }

  destroy() {
    this._clearTimer();
    this.buffer = '';
    this.onTimeout = null;
  }
}
