---
description: SDD 前半段：需求釐清（反問+挑戰）→ OpenSpec change 一次落檔（proposal＋delta＋tasks，Draft）→ TPM 拍板鎖定（回一個 OK 即可）。鎖定後 build 全自主執行。
argument-hint: <需求描述（可貼文字/截圖）>
---

這是 Octopus 的 **spec 管線**（SDD 前半段）。你（主對話）擔任 Core 編排，依序執行。

設計原則：**討論集中在這一段，拍板只有一次**。TPM 在鎖定點看到的是完整包（proposal＋決策卡＋tasklist＋browser 驗證勾選），鎖定之後 `/octopus:build` 全自主執行，他不需要再被打斷。

> 拍板停點很輕：呈現完整包後，使用者回「**OK**」＝所有決策卡採建議選項＋接受 tasks 的 browser 驗證建議＋同意鎖定，一個字放行；有意見才回話逐項處理。只有 `/octopus:main auto` 會跳過本停點（鎖定改由 build 入口自動完成＋留痕）。

## 步驟

### 0. 前置檢查＋起跑 run-marker（確定性動作）
1. **`openspec` CLI**：Bash 跑 `openspec --version`。失敗 → **停**，請使用者先安裝（npm 全域安裝 OpenSpec CLI，指令以官方 README 為準：github.com/Fission-AI/OpenSpec），裝好回覆再續。
2. **`openspec/` 結構**：目標 repo 沒有 `openspec/` → **停**，請使用者自行在終端跑 `openspec init`（互動式，會問要配置哪些 AI 工具，不代跑），跑完回覆再續。
3. 把當下 ISO 時間戳寫進 `.claude/.octopus-arena/.run`（目錄不存在先建立）——守門 hook 只在 marker 有效期間生效（守門跟著管線走，設計文件 §6.2）。本管線**收尾時必刪 marker**（步驟 4 之後，或使用者保持 Draft 結束時）。

### 1. 需求釐清
用 Agent 工具啟動 **analyst**，把需求原文（含圖片）完整轉給它。
- 它若反問（≤3 問 × ≤2 輪），把問題轉給使用者，答案轉回給它（用 SendMessage 延續同一個 analyst，不要重開）
- 它會做魔鬼代言人挑戰；挑戰結果一併呈現給使用者
- 產出：結構化需求分析

釐清完成後補一句**規劃輕問**（非停點，`/octopus:main auto` 不問、逕交 Architect）：「規劃方式交給 Architect 判斷（預設），還是你要指定？（單 change＝平鋪 tasks 一次交付／epic＝拆多筆 change 逐一交付）」。不答或答「交給你」即走預設；拍板停點仍可改。

### 2. 起草 change
用 Agent 工具啟動 **architect**（情境 A），轉給它：
- Analyst 的結構化需求分析全文
- 規劃輕問的結果（TPM 指定或「交 Architect 判斷」）

產出（單 change 模式）：`openspec/changes/<name>/`——proposal.md ＋ specs delta ＋ tasks.md（逐條標驗證方式）＋ `.openspec.yaml`（`octopus.status: Draft`）＋ 決策卡清單（如有）。
產出（epic 模式）：多筆 change 資料夾（各 Draft）＋ roadmap（`openspec/roadmaps/<需求名>.md`，記各 change 名稱/順序/相依，**不帶 octopus.status**）＋ 拆分判斷理由。

落檔後 Bash 跑 **`openspec validate <change-name>`**：沒過就把錯誤轉回同一個 architect 修（SendMessage，上限 2 輪）；仍沒過 → 如實呈報錯誤，不硬鎖。

### 3.【拍板 OK 停點】（`/octopus:main auto` 才跳過本步與步驟 4）
向使用者一次呈現完整包：
- change 路徑與 proposal 摘要（目標 / In-Out / delta Requirement 條數）；epic 模式加 roadmap 摘要與拆分判斷理由
- 所有待拍板決策卡
- tasklist（相依順序）＋ **browser 驗證勾選**：列出 architect 標了 `browser` 的 task（沒有就明說「無」），回 OK＝照建議執行；使用者可增刪勾選或全關

請他拍板：回「**OK**」＝所有決策卡採建議選項＋接受 browser 建議＋同意鎖定（含組織方式），一次完成；有個別意見（含改組織方式）就逐項處理。結論（含 OK 時採用的建議選項）用 Edit 寫進 proposal.md 的「已拍板決策」表。

### 4. 鎖定（確定性動作，使用者明確說鎖才執行）
- 用 Edit 把 `changes/<name>/.openspec.yaml` 的 `octopus.status: Draft` 改為 `octopus.status: Locked`（epic 模式：所有 change 一併鎖定；roadmap 無狀態可改）
- 拍板決策追記目標 repo 的 `.claude/.octopus-arena/decisions.md`（日期｜change 名｜決策｜結論）。首次建立該目錄時，提醒使用者把 `.claude/.octopus-arena/` 加入該 repo 的 `.gitignore`
- 告知使用者：`/octopus:build <change-name>`（epic 模式給 roadmap 路徑）會**自主執行到驗收完成**（實作→測試→審查→修到乾淨），他只需要等驗收報告與 merge

使用者不鎖（還要想/要先問別人）→ 保持 Draft，正常結束。

無論鎖定或保持 Draft，結束前**刪除 `.claude/.octopus-arena/.run`**（確定性動作）。

## 紅線
- 狀態流轉只由 command 的確定性步驟執行（本管線的步驟 4，或 build 入口的自動鎖定），agent 無權改 `octopus.status`
- 不碰 `openspec/specs/` 主 spec——delta 合回主 spec 是 build 收尾 archive 的事
- Analyst 打回的需求（驗收不可測）不得硬推進步驟 2

需求：$ARGUMENTS
