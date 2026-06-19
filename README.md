# HoneyWhisper 🐝

**HoneyWhisper** 是一款隱私優先的即時語音轉字幕 Chrome 擴充功能，支援多種 ASR 後端與即時翻譯。

![HoneyWhisper Screenshot](./docs/screenshot.png)

## ✨ 特色功能

- **🔒 隱私優先**：Nemotron ASR 引擎完全在本機瀏覽器執行，語音資料絕不會離開您的裝置。
- **⚡ 即時字幕**：基於 WebGPU 的低延遲語音辨識，支援多種延遲設定檔（TURBO～HIGH）。
- **🗣️ 雙 ASR 引擎**：
  - **Nemotron 3.5**：本機引擎，支援 WebGPU 與 WASM 後端，無需 API Key。
  - **Gemini 3.5 Live Translate**：雲端引擎，透過 WebSocket 即時串流，內建翻譯功能。
- **🌐 即時翻譯**：支援 Google Translate、DeepL，以及 Gemini 內建翻譯。可顯示雙語字幕。
- **🎙️ 語音活動偵測 (VAD)**：只在有人說話時進行辨識，節省資源。
- **🎨 高度客製化**：可調整字體大小、歷史字幕行數、字幕框拖曳。
- **📦 支援多語言 UI**：繁體中文、英文、日文。

## 🚀 安裝說明

### 方法 1：從 Release 安裝
1. 前往 [Release 頁面](https://github.com/jeffpeng3/HoneyWhisper/releases/latest) 下載 `.zip` 檔案。
2. 解壓縮後，在 Chrome 開啟 `chrome://extensions`。
3. 開啟右上角的**開發者模式**。
4. 點擊**載入未封裝項目**並選擇解壓縮後的資料夾。

### 方法 2：從原始碼編譯
**需求**：Node.js 20+

```bash
git clone https://github.com/jeffpeng3/HoneyWhisper.git
cd honey-whisper
npm install
npm run build
```

編譯完成後，選擇 `.output/chrome-mv3` 資料夾載入到 Chrome。

## 📖 使用方法

1. **開啟網頁**：前往任何有音訊的標籤頁（YouTube、Twitch、Meet 等）。
2. **啟動擴充功能**：點擊工具列的 HoneyWhisper 圖示。
3. **選擇 ASR 引擎**：在設定頁面的 ASR 分頁選擇 Nemotron（本機）或 Gemini（雲端）。
4. **開始辨識**：點擊 **Start** 按鈕，浮層字幕將出現在畫面上。

## 🧠 ASR 引擎

### Nemotron（本機，預設）

使用 `@jeffpeng3/nemotron-asr-core`，基於 WebGPU 加速，需要支援 WebGPU 的瀏覽器與 GPU。

- 無需 API Key，完全離線運作（需 WebGPU 支援，CPU 無法運行）
- 可調整延遲設定檔（TURBO / FAST / BALANCED / QUALITY / HIGH）
- 可調整波束寬度（1-3）
- 內建效能基準測試（Benchmark）
- 支援 VAD 參數調整

### Gemini 3.5 Live Translate（雲端）

透過 WebSocket 連接 Google Gemini 3.5 Live Translate API。

- 需自行準備 Gemini API Key
- 支援多種來源語言
- 內建翻譯功能（`providesTranslation = true`），辨識同時直接回傳翻譯結果

## 🌐 翻譯服務

| 服務 | 類型 | 說明 |
|---|---|---|
| Google Translate | 免費（逆向 API） | 來源語言 → 目標語言 |
| DeepL | 免費（逆向 API） | 來源語言 → 目標語言 |
| 內建（Built-in） | Gemini 原生 | 僅在 Gemini ASR 引擎下可用，無需額外 API |

## ⚙️ 設定選項

### 一般設定
- **字體大小**：調整字幕字體
- **歷史行數**：設定保留的歷史字幕行數（0-5）

### ASR 設定
- **引擎選擇**：Nemotron / Gemini
- **Nemotron 進階**：延遲設定檔、波束寬度、VAD 門檻、Benchmark
- **Gemini 設定**：API 金鑰、來源語言

### 翻譯設定
- **服務選擇**：無 / Google / DeepL / 內建
- **顯示原文**：雙語對照模式
- **目標語言**：支援 8 種目標語言

## 🛠️ 技術堆疊

### 前端
- **[Svelte 5](https://svelte.dev/)**（Runes）
- **[shadcn-svelte](https://www.shadcn-svelte.com/)** + **[Tailwind CSS](https://tailwindcss.com/)**
- **[WXT](https://wxt.dev/)** 擴充功能框架
- **[Vite](https://vitejs.dev/)** 建置工具

### ASR 與翻譯
- **[Nemotron ASR Core](https://github.com/jeffpeng3/nemotron-asr-core)** — WebGPU / WASM 本機引擎
- **[Gemini Live Translate](https://ai.google.dev/)** — WebSocket 雲端引擎
- **[VAD-Web](https://github.com/ricky0123/vad)** — Silero VAD 語音活動偵測
- **[BudouX](https://github.com/google/budoux)** — 中日文斷詞

### 開發工具
- **TypeScript** 型別安全
- **i18n**（WXT i18n 模組）
- **shadcn-svelte** UI 元件庫

## 📁 專案結構

```
src/
├── engine/
│   ├── asr/                   # ASR 引擎（Nemotron / Gemini）
│   └── translation/           # 翻譯服務（Google / DeepL / Built-in）
├── entrypoints/
│   ├── background.js          # Service Worker
│   ├── content.js             # Content Script（浮層字幕）
│   ├── offscreen/             # Offscreen 文件（音訊 + 管線）
│   ├── options/               # 設定頁面
│   └── popup/                 # 彈出視窗
├── lib/
│   ├── components/            # Svelte 元件
│   │   ├── settings/          # ASR / 翻譯設定分頁
│   │   └── ui/                # shadcn-svelte 元件
│   ├── languages/             # 語言對照表
│   └── settings/              # 設定儲存層（Proxy-based SettingsStore）
├── locales/                   # i18n 翻譯檔（en / ja / zh_TW）
└── pipeline/                  # 音訊錄製 / 管線控制 / 分段器
```

## ⚠️ 系統需求

- **瀏覽器**：Chrome 113+（支援 WebGPU / Offscreen）
- **硬體**：需支援 WebGPU 的 GPU（獨立顯卡為佳，TURBO 設定檔可在較強內顯運作）
- **Gemini 引擎**：需穩定的網路連線與 Gemini API Key

## 📄 授權條款

MIT
