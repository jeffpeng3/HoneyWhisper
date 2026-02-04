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
3.  (選擇性) 設定您偏好的 **模型 (Model)** 和 **語言 (Language)**。
    *   *Tiny/Base* 模型速度較快。
    *   *Small/Distil* 模型準確度較高。
4.  點擊 **Start Captioning**。
5.  字幕浮動視窗將會出現在頁面上。您可以隨意拖曳它到喜歡的位置。

## 🛠️ 技術堆疊

*   [Transformers.js](https://huggingface.co/docs/transformers.js/index): 在瀏覽器中執行 Transformer 模型的核心。
*   [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript.html): WebGPU 後端加速引擎。
*   [VAD-Web](https://github.com/ricky0123/vad): 瀏覽器端的高效語音活動偵測。
*   [Vite](https://vitejs.dev/): 現代前端建置工具。

## ⚠️ 系統需求

*   **瀏覽器**：Chrome 113+ (或 Edge) 並開啟 WebGPU 支援。
*   **硬體**：建議具備獨立顯示卡以獲得最佳體驗 (Tiny 模型可在較強的內顯上運行)。

## 📄 授權條款

MIT
