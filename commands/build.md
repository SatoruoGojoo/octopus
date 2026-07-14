---
description: SDD 後半段（全自主）：入口 Draft 自動鎖定 → 照 tasks 實作＋測試 → 審查 → P1 自動退修（≤3 輪）→ 帶驗收報告回來，你只剩 merge。中途不停下來等人。
argument-hint: <spec 路徑或編號>（加 step 可逐步確認）
---

這是 Octopus 的 **build 管線**（SDD 後半段）。你（主對話）擔任 Core 編排。

設計原則：**全自主、不中途等人**。TPM 的拍板權後置到驗收停點、以否決權形式行使——branch 上一切可逆（不 merge 即否決），所以執行中一律「保守預設＋留痕」跑到底，跑完帶著「成品＋驗收報告＋執行中自動拍板清單」回去，TPM 只剩 merge 一個判斷。

使用者輸入含 `step` 時改為逐步模式：每步驟完成後停下呈現再續，執行中決策也改為當場以決策卡請示。

## 步驟

### 0. 入口閘門（確定性檢查，先做）
Read 指定的 spec 檔（給編號就先 Glob `specs/<編號>-*/spec.md`）：
- 找不到 → 停，列出 specs/ 下現有的 spec 供確認
- `status: Draft` → **自動鎖定，不請示**：spec 內若有未定案的決策卡，取建議選項用 Edit 寫進「已拍板決策」表並標註「auto」；用 Edit 把 `status: Draft` 改為 `status: Locked`；追記 `.claude/.octopus-arena/decisions.md`（日期｜spec 編號｜auto-locked｜取用的建議選項）。step 模式則停下請 TPM 拍板後才鎖
- `status: Locked` → 直接續跑
- `status: Implemented` → **拒絕**：「此 spec 已完工，要改版請開新 spec」
- 缺 `status` 行 → 停：「spec 缺狀態欄位，請先跑 /octopus:init 補登或親手標註」

### 1. 取得 tasks
Read 同目錄 `tasks.md`（/octopus:spec 已連 spec 一起產出）。
若缺檔（舊 spec 或手寫 spec）→ 啟動 **architect**（情境 B）補產，**不停等確認**，繼續往下。

### 2. 實作（Builder）
用 Agent 工具啟動 **builder**：spec 路徑＋tasks。它自驗狀態、建 feature branch（`feat/<編號>-<slug>`）、照 tasks 實作＋測試、branch 上 commit。

### 3. 審查與自動修復迴圈（Reviewer ⇄ Builder）
用 Agent 工具啟動 **reviewer**（branch、主幹、spec 路徑）取得驗收報告。
- 有 P1 → 把 P1 清單轉回同一個 builder 修，修完重審——**自動迴圈，不請示**
- 迴圈上限 **3 輪**：仍有 P1 → **不停下來空等裁決**，帶著「修不掉的 P1 與原因」直接進下一步收尾，報告如實標紅、不建議 merge

### 4. 理解檢核（Examiner，動到程式邏輯才觸發）
變更僅為文案/註解/格式/設定 → 跳過本步。否則用 Agent 工具啟動 **examiner**（branch、主幹、spec 路徑、驗收報告）取得考題：
- 把考題逐題轉問使用者，收到回答後用 SendMessage 轉回**同一個** examiner 判定（不要重開新 agent）
- 答錯採講解，**不擋 merge**——這不是新停點，附著在下一步的硬停點內
- 取得理解檢核摘要，與驗收報告一併呈現

### 5.【唯一硬停點：驗收 merge】
依序完整呈現：
1. **執行中自動拍板清單**（入口 auto-lock＋過程中所有保守預設決策，用決策卡格式；沒有就寫「無」）
2. 最終驗收報告（不刪減「高風險變更點」段落）
3. 理解檢核摘要（如有）

使用者驗收通過 → 他自行 merge，或**經明確同意後代為執行**。代為 merge 時指令一律加前綴 `OCTOPUS_TPM_OK=1 `（例：`OCTOPUS_TPM_OK=1 git merge --no-ff feat/...`）——這是 branch-guard 主幹保護的留痕例外，專為「TPM 已點頭」設計；未經明確同意不得使用。忘了前綴被 hook 擋下時，補上前綴重跑即可，**不要回頭再問一次使用者**。不滿意 → branch 不 merge 即否決，可帶修訂意見重跑。

### 6. 收尾（merge 完成後）
- 用 Edit 把 spec frontmatter 改為 `status: Implemented`
- 補 spec 的「相關 API」表：本次實作新增/變更的 endpoint 與一句話說明（讓 spec 兼任業務故事——日後查「哪個功能對應哪支 API」的入口）
- **文件影響清單**：掃本次變更是否讓既有文件過時（README、docs/ 技術說明、其他 spec 的相依描述），列出建議更新點一併呈現——使用者點頭就順手更新，跳過也行，**不另設停點**
- 過程中若有新拍板，追記 `.claude/.octopus-arena/decisions.md`

## 執行中不等人（自主模式；step 模式才當場請示）
下列事件**不中途暫停**，一律「保守預設＋留痕＋步驟 5 集中呈報」：
1. **高風險決策**（spec 未涵蓋、且涉及 migration / 權限認證 / 對外契約 / 不可逆的取捨）→ 取保守選項，決策卡格式記錄。紅線不變：效果不得逃出 feature branch（migration 只產檔不執行、不推主幹、不 merge）
2. **P1 三輪修不乾淨** → 收尾出報告，如實標紅
3. **spec 本身有問題**（實作中發現矛盾/缺漏）→ 按最合理解釋標註後繼續，差異寫入報告，不竄改 spec

## 紅線
- 步驟 0 的閘門不可跳過：`Implemented` 與缺 status 的拒絕不可被任何理由說服繞過；自動鎖定必留痕（決策表＋Arena），不得無痕改 status
- merge 與主幹永遠是使用者的：未經明確同意不執行 merge

spec：$ARGUMENTS
