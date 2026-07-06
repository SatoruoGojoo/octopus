---
description: SDD 後半段（全自主）：入口驗 Locked → 照 tasks 實作＋測試 → 審查 → P1 自動退修到乾淨 → 帶驗收報告回來，你只剩 merge。
argument-hint: <spec 路徑或編號>（加 step 可逐步確認）
---

這是 Octopus 的 **build 管線**（SDD 後半段）。你（主對話）擔任 Core 編排。

設計原則：**spec 鎖定＝TPM 的決策工作已經結束**。本管線預設**全自主執行**——中途不停下來要確認，跑完帶著「驗證過的成品＋驗收報告」回去，TPM 只剩 merge 一個動作。例外才停（見下方「何時停」）。

使用者輸入含 `step` 時改為逐步模式：每步驟完成後停下呈現再續。

## 步驟

### 0. 入口閘門（確定性檢查，先做）
Read 指定的 spec 檔（給編號就先 Glob `specs/<編號>-*/spec.md`）：
- 找不到 → 停，列出 specs/ 下現有的 spec 供確認
- frontmatter `status` 非 `Locked` → **直接拒絕**：「spec 狀態為 <X>，需先跑 /octopus:spec 完成鎖定」。不提供「先做做看」的選項

### 1. 取得 tasks
Read 同目錄 `tasks.md`（/octopus:spec 已連 spec 一起產出、隨鎖定點被 TPM 看過）。
若缺檔（舊 spec 或手寫 spec）→ 啟動 **architect**（情境 B）補產，**不停等確認**，繼續往下。

### 2. 實作（Builder）
用 Agent 工具啟動 **builder**：spec 路徑＋tasks。它自驗狀態、建 feature branch（`feat/<編號>-<slug>`）、照 tasks 實作＋測試、branch 上 commit。

### 3. 審查與自動修復迴圈（Reviewer ⇄ Builder）
用 Agent 工具啟動 **reviewer**（branch、主幹、spec 路徑）取得驗收報告。
- 有 P1 → 把 P1 清單轉回同一個 builder 修，修完重審——**自動迴圈，不請示**
- 迴圈上限 **3 輪**：仍有 P1 才停下來，附上「修不掉的 P1 與原因」請 TPM 裁決

### 4. 理解檢核（Examiner，動到程式邏輯才觸發）
變更僅為文案/註解/格式/設定 → 跳過本步。否則用 Agent 工具啟動 **examiner**（branch、主幹、spec 路徑、驗收報告）取得考題：
- 把考題逐題轉問使用者，收到回答後用 SendMessage 轉回**同一個** examiner 判定（不要重開新 agent）
- 答錯採講解，**不擋 merge**——這不是新停點，附著在下一步的硬停點內
- 取得理解檢核摘要，與驗收報告一併呈現

### 5.【唯一硬停點：驗收 merge】
把最終驗收報告（含理解檢核摘要）完整呈現（不刪減「高風險變更點」段落）。使用者驗收通過 → 他自行 merge（或經明確同意後代為執行）。

### 6. 收尾（merge 完成後）
- 用 Edit 把 spec frontmatter 改為 `status: Implemented`
- 補 spec 的「相關 API」表：本次實作新增/變更的 endpoint 與一句話說明（讓 spec 兼任業務故事——日後查「哪個功能對應哪支 API」的入口）
- **文件影響清單**：掃本次變更是否讓既有文件過時（README、docs/ 技術說明、其他 spec 的相依描述），列出建議更新點一併呈現——使用者點頭就順手更新，跳過也行，**不另設停點**
- 過程中若有新拍板，追記 `.claude/.octopus-arena/decisions.md`

## 何時停（自主模式的例外，由具體事件觸發，不是排程確認）
1. **高風險決策**：spec 未涵蓋、且涉及 migration / 權限認證 / 對外契約 / 不可逆的取捨 → 決策卡停下請示
2. **P1 三輪修不乾淨** → 停下裁決
3. **spec 本身有問題**（實作中發現矛盾/缺漏）→ 停下回報，不自行偏離 spec

## 紅線
- 步驟 0 的閘門不可跳過、不可被任何理由說服繞過
- merge 與主幹永遠是使用者的：未經明確同意不執行 merge

spec：$ARGUMENTS
