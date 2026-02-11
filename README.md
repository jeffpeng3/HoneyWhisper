# HoneyWhisper 🐝

**HoneyWhisper** 是一款隱私優先、採用 **WebGPU** 技術的即時語音轉字幕 Chrome 擴充功能。
它完全在您的瀏覽器本機執行 OpenAI 的 Whisper 模型——無需 API Key、無需伺服器費用，您的語音資料絕不會離開您的裝置。

![HoneyWhisper Screenshot](./docs/screenshot.png)

## ✨ 特色功能

*   **🔒 隱私優先 (Privacy First)**：所有運算皆透過 WebGPU 在您的本機顯卡上執行。沒有任何資料會上傳到雲端伺服器。
*   **⚡ 極速即時 (Real-Time)**：基於 `transformers.js` 和 ONNX Runtime Web，提供低延遲的字幕生成體驗。
*   **🗣️ 多語言支援**：支援英文、中文、日文等多種語言（並具備自動偵測功能）。
*   **🎙️ 智慧語音偵測 (VAD)**：整合 Voice Activity Detection (`vad-web`)，只在有人說話時才進行運算，大幅節省資源與電力。
*   **🎨 高度客製化 UI**：
    *   可調整字體大小。
    *   可設定歷史字幕行數 (0-5 行)。
    *   可自由拖曳字幕框，並保持中心對齊的舒適體驗。

## 🚀 安裝說明

### 方法 1：載入壓縮檔
1.  前往 [Release 頁面](https://github.com/jeffpeng3/HoneyWhisper/releases/latest) 下載最新的 `.zip` 發布檔。
2.  解壓縮檔案。
3.  在瀏覽器網址列輸入 `chrome://extensions`。
4.  開啟右上角的 **開發者模式 (Developer mode)**。
5.  點擊 **載入未封裝項目 (Load unpacked)** 並選擇解壓縮後的資料夾。

### 方法 2：從原始碼編譯
**需求**：Node.js 20 或更高版本

1.  Clone 專案：
    ```bash
    git clone https://github.com/jeffpeng3/HoneyWhisper.git
    cd honey-whisper
    ```
2.  安裝依賴套件：
    ```bash
    npm install
    ```
3.  編譯擴充功能：
    ```bash
    npm run build
    ```
4.  載入到 Chrome：
    *   前往 `chrome://extensions`。
    *   開啟 **開發者模式**。
    *   點擊 **載入未封裝項目**。
    *   選擇編譯產生的 `dist` 資料夾。

## 📖 使用方法

1.  開啟任何有播放音訊的網頁 (例如 YouTube, Twitch, Google Meet 等)。
2.  點擊瀏覽器右上角的 **HoneyWhisper** 圖示。
3.  (選擇性) 選擇您偏好的 **設定檔 (Profile)**（例如：Fast (Tiny) 或 Balanced (Base)）。
    *   若需更改 **辨識語言 (Language)** 或開啟 **即時翻譯**，請點擊 **Settings** 按鈕進行設定。
4.  點擊 **Start Captioning**。
5.  字幕浮動視窗將會出現在頁面上。您可以隨意拖曳它到喜歡的位置。

## 🧠 多元運算後端 (Flexible Backends)

HoneyWhisper 提供三種運算後端，滿足不同硬體需求：

*   **WebGPU (預設/推薦)**：運用現代瀏覽器的 WebGPU 技術，直接調用顯卡 (GPU) 進行並行運算。速度最快，適合大多數配備獨立顯卡或較新內顯的電腦。
*   **WASM (WebAssembly)**：純 CPU 運算模式。相容性最高，但速度較慢。適合不支援 WebGPU 的舊款設備。
*   **Remote (OpenAI Compatible)**：將語音傳送至相容 OpenAI API 的伺服器進行處理。
    *   這讓您可以使用 **LocalAI**、**LM Studio** 等工具在本地運行更強大的模型 (如 Whisper Large-v3)。
    *   亦可連接至 OpenAI 官方 API (需自行準備 API Key)。

## 🏪 模型中心 (Model Hub)

透過內建的 **Model Hub**，您可以自由下載與管理來自 Hugging Face 的社群模型：

*   **多樣化選擇**：除了預設的 Tiny/Base 模型，您可以下載 Small 或 Distil 等更強大的模型版本。
*   **量化支援 (Quantization)**：
    *   **q4 (4-bit)**：檔案最小、速度最快，適合大多數即時字幕場景。
    *   **int8 (8-bit)**：提供比 q4 更高的準確度，但檔案稍大。
    *   **fp32 (32-bit)**：完整精度模型，適合追求極致準確度的使用者。

## 🌐 即時翻譯 (Real-time Translation)

打破語言隔閡，HoneyWhisper 支援即時語音翻譯功能：

*   **多種翻譯服務**：目前支援 **Google Translate** 與 **DeepL**。
*   **雙語對照 (Bilingual)**：開啟 **Show Original Text**，即可同時顯示原文與譯文。這對於語言學習或確認翻譯準確度非常實用。
*   **自動偵測**：將來源語言設為 `Auto`，系統會自動識別發話者的語言並翻譯成您的目標語言。

## 🛠️ 技術堆疊 (Tech Stack)

*   **[Svelte 5](https://svelte.dev/):** 最新一代的響應式前端框架，提供更流暢的開發體驗與效能。
*   **[Tailwind CSS](https://tailwindcss.com/):** 實用優先 (Utility-first) 的 CSS 框架，打造現代化且響應式的介面。
*   **[Shadcn Svelte](https://www.shadcn-svelte.com/):** 質感精美的 UI 元件庫，提升使用者的互動體驗。
*   **[Transformers.js](https://huggingface.co/docs/transformers.js/index):** 在瀏覽器中執行 Transformer 模型的核心。
*   **[ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript.html):** WebGPU 後端加速引擎。
*   **[VAD-Web](https://github.com/ricky0123/vad):** 瀏覽器端的高效語音活動偵測。
*   **[Vite](https://vitejs.dev/):** 現代前端建置工具。

## ⚠️ 系統需求

*   **瀏覽器**：Chrome 113+ (或 Edge) 並開啟 WebGPU 支援。
*   **硬體**：建議具備獨立顯示卡以獲得最佳體驗 (Tiny 模型可在較強的內顯上運行)。

## 📄 授權條款

MIT
