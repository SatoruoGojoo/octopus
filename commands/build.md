---
description: SDD 後半段（全自主）：驗 Locked → Builder 逐 task 實作（每條 task 隨行回報）→ 審查 → P1 自動退修（≤3 輪）→ 帶驗收報告回來，你只剩 merge 與 archive。中途不停下來等人。
argument-hint: <change 名稱或路徑>
---

這是 Octopus 的 **build 管線**（SDD 後半段）。你（主對話）擔任 Core 編排。

設計原則：**全自主、不中途等人，但看得到進度**。TPM 已在拍板停點放行過，執行中一律「保守預設＋留痕」跑到底；同時 Builder 每完成一條 task 你就即時轉呈一則 task 回報（單向，不等回覆），TPM 隨行看得懂每條 task 對應的 code——這守住「理解 vs 盲簽」邊界，跑完不必回頭補看。

## 步驟

### 0. 入口閘門（確定性檢查，先做）
1. **CLI**：Bash 跑 `openspec --version`。失敗 → 停，請使用者先安裝（指令以官方 README 為準：github.com/Fission-AI/OpenSpec）。
2. **run-marker**：把當下 ISO 時間戳寫進目標 repo 的 `.claude/.octopus-arena/.run`（目錄不存在先建立）——守門 hook 只在 marker 有效期間生效。本管線於步驟 4 呈報告前刪除。

解析 change（給名稱就找 `openspec/changes/<name>/`）：
- 找不到 → 停，Bash 跑 `openspec list --changes`（或 Glob `openspec/changes/*/`）列出現有 change 供確認；位於 `changes/archive/` → **拒絕**（已歸檔結案，要改版請開新 change）
- Read `.openspec.yaml` 的 `octopus.status`：
  - `Locked` → 直接續跑
  - `Draft` → **停下請 TPM 拍板**（不自動鎖定）：依 `${CLAUDE_PLUGIN_ROOT}/commands/spec.md` 步驟 3 的格式呈現完整包（proposal 摘要＋待拍板決策卡＋tasklist），等使用者回 OK；拍板後照 spec.md 步驟 4 用 Edit 標 `Locked` ＋追記 Arena，再續跑。他不拍板就停在這裡，正常結束（記得刪 marker）
  - `Implemented` → **拒絕**：「此 change 已 merge。tasks 未全完成者屬結案追蹤（完成後 archive），要再動 code 請開新 change」
  - 缺 `octopus.status` → 停：「change 缺狀態欄位，請先跑 /octopus:init 補登或親手標註」

### 1. 取得 tasks
Read 同目錄 `tasks.md`（/octopus:spec 已連 change 一起產出）。
若缺檔（手建的 change）→ 啟動 **architect**（情境 B）補產，**不停等確認**，繼續往下。

用主對話的 todo 清單登記全部 tasks——這是 TPM 的進度條，每條回報後勾銷。

### 2. 實作（Builder 逐 task 派工）
這是「**進度可見契約**」的當前實作（設計文件 §5.2）：逐條派工讓每次 agent 返回帶一條回報，Core 才能即時轉呈——因為 Claude Code 的 subagent 輸出在它返回前你看不到。Builder 本身是純執行層（不管派工節奏），逐條是**你（Core）**的編排選擇。

用 Agent 工具啟動 **builder**：給 change 路徑＋完整 tasks＋**指定第一條未完成 task**。它自驗狀態、建 feature branch（`feat/<change-name>`）、只做那一條、勾 tasks.md、返回 task 回報。

每次收到回報後：
1. **即時轉呈使用者**（task 回報原文——做了什麼／code 導讀／自主決定／測試），**單向呈現，不停等回覆**；todo 清單勾銷該條
2. 用 SendMessage 對**同一個** builder 指派下一條 task（不要重開新 agent——context 連貫是逐條派工的前提）
3. 全部做完 → 取得最終變更摘要

### 3. 審查與自動修復迴圈（Reviewer ⇄ Builder）
用 Agent 工具啟動 **reviewer**（branch、主幹、change 路徑）取得驗收報告。
- 有 P1 → 把 P1 清單用 SendMessage 轉回同一個 builder 修，修完重審——**自動迴圈，不請示**
- 迴圈上限 **3 輪**：仍有 P1 → **不停下來空等裁決**，帶著「修不掉的 P1 與原因」直接進下一步收尾，報告如實標紅、不建議 merge

### 4.【唯一硬停點：驗收 merge】
先**刪除 `.claude/.octopus-arena/.run`**（確定性動作）——執行段結束，守門隨管線收尾解除，之後 TPM 同意的 merge 不再被 hook 攔。

依序完整呈現：
1. **執行中自動拍板清單**（過程中所有保守預設決策，用決策卡格式；沒有就寫「無」）
2. 最終驗收報告（不刪減「高風險變更點」段落——含 Reviewer 建議親自在頁面確認的項目）

使用者驗收通過 → 他自行 merge，或**經明確同意後代為執行**（marker 已清，直接 merge 即可）。若仍被 branch-guard 攔下（罕見：marker 殘留），加前綴 `OCTOPUS_TPM_OK=1 ` 重跑（例：`OCTOPUS_TPM_OK=1 git merge --no-ff feat/...`）——前綴＝同意留痕，**不要回頭再問一次使用者**；未經明確同意不得使用此前綴。不滿意 → branch 不 merge 即否決，可帶修訂意見重跑。

### 5. 收尾（merge 完成後）
- 用 Edit 把 `.openspec.yaml` 的 `octopus.status` 改為 `Implemented`
- 補 proposal.md 的「相關 API」表：本次實作新增/變更的 endpoint 與一句話說明（change 兼任業務故事——日後查「哪個功能對應哪支 API」的入口）
- **文件影響清單**：掃本次變更是否讓既有文件過時（README、docs/、其他 change 的相依描述），列出建議更新點一併呈現——使用者點頭就順手更新，跳過也行，**不另設停點**
- **archive（merge ≠ 結案）**：
  - tasks.md **全數勾完** → 建議執行 `openspec archive <name> --yes`（delta 合回主 spec＋整夾歸檔），使用者點頭就 Bash 跑（本來就在驗收停點對話裡，不算新停點）
  - **有未完 task**（如舊資料 backfill 待跑）→ **不 archive**，明說：「change 留開＝修復追蹤中（例：code 已修、資料待補）；剩餘 task 完成後再 archive 結案」
- 過程中若有新拍板，追記 `.claude/.octopus-arena/decisions.md`

## 執行中不等人
下列事件**不中途暫停**，一律「保守預設＋留痕＋步驟 4 集中呈報」：
1. **高風險決策**（spec 未涵蓋、且涉及 migration / 權限認證 / 對外契約 / 不可逆的取捨）→ 取保守選項，決策卡格式記錄。紅線不變：效果不得逃出 feature branch（migration 只產檔不執行、不推主幹、不 merge）
2. **P1 三輪修不乾淨** → 收尾出報告，如實標紅
3. **spec/delta 本身有問題**（實作中發現矛盾/缺漏）→ 按最合理解釋標註後繼續，差異寫入報告，不竄改 change 檔案

Task 回報是**單向呈報**，不是停點——使用者中途插話（改方向、喊停）當然要理，但你不主動停下等他。

## 紅線
- 步驟 0 的閘門不可跳過：`Implemented`、已歸檔與缺 status 的拒絕不可被任何理由說服繞過
- **`Draft` 一律停下請拍板，不得自動鎖定**——`Locked` 只有一個意思：TPM 拍板過
- merge 與主幹永遠是使用者的：未經明確同意不執行 merge；archive 未經點頭不執行
- 不碰 `openspec/specs/` 主 spec——delta 合回只透過 `openspec archive`（CLI）

change：$ARGUMENTS
