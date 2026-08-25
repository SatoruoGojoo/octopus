---
description: SDD 前半段：需求釐清（反問+挑戰）→ OpenSpec change 一次落檔（proposal＋delta＋tasks，Draft）→ TPM 拍板鎖定（回一個 OK 即可）。鎖定後 build 全自主執行。
argument-hint: <需求描述（可貼文字/截圖）>
---

這是 Octopus 的 **spec 管線**（SDD 前半段）。你（主對話）擔任 Core 編排，依序執行。

設計原則：**討論集中在這一段，拍板只有一次**。TPM 在鎖定點看到的是完整包（proposal＋決策卡＋tasklist），鎖定之後 `/octopus:build` 全自主執行，他不需要再被打斷。

> 拍板停點很輕：呈現完整包後，使用者回「**OK**」＝所有決策卡採建議選項＋同意鎖定，一個字放行；有意見才回話逐項處理。**沒有跳過此停點的模式**——`Locked` 只有一個意思：TPM 拍板過。

## 步驟

### 0. 前置檢查＋起跑 run-marker（確定性動作）
1. **`openspec` CLI**：Bash 跑 `openspec --version`。失敗 → **停**，請使用者先安裝（npm 全域安裝 OpenSpec CLI，指令以官方 README 為準：github.com/Fission-AI/OpenSpec），裝好回覆再續。
2. **`openspec/` 結構**：目標 repo 沒有 `openspec/` → **停**，請使用者跑 `openspec init`；CLI 1.7.0+ 支援非互動參數，經使用者明確點頭後可代跑 `openspec init --tools claude --no-animation`（互動式版本仍不代跑）。
3. 把當下 ISO 時間戳寫進 `.claude/.octopus-arena/.run`（目錄不存在先建立）——守門 hook 只在 marker 有效期間生效（守門跟著管線走，設計文件 §6.2）。本管線**收尾時必刪 marker**（步驟 4 之後，或使用者保持 Draft 結束時）。

### 1. 需求釐清
先 Read `.claude/.octopus-arena/decisions.md`（如存在），挑出與本需求相關的舊拍板決策——之後連同需求原文一併轉給 analyst 與 architect（防止與舊決策靜默矛盾；方案確實要翻舊案時，明標「翻 <日期> 決策」並開決策卡）。

用 Agent 工具啟動 **analyst**，把需求原文（含圖片）完整轉給它。
- 它若反問（≤3 問 × ≤2 輪），把問題轉給使用者，答案轉回給它（用 SendMessage 延續同一個 analyst，不要重開）
- 它會做魔鬼代言人挑戰；挑戰結果一併呈現給使用者
- 產出：結構化需求分析

### 2. 起草 change
用 Agent 工具啟動 **architect**（主線：起草 change），把 Analyst 的結構化需求分析全文轉給它。

產出：`openspec/changes/<name>/`——proposal.md ＋ specs delta ＋ tasks.md ＋ `.openspec.yaml`（`octopus.status: Draft`）＋ 決策卡清單（如有）。**一個需求一筆 change**——需求大到裝不進一筆時，如實說明並建議使用者拆成兩次 spec，不要自行拆分。

落檔後 Bash 跑 **`openspec validate <change-name>`**：沒過就把錯誤轉回同一個 architect 修（SendMessage，上限 2 輪）；仍沒過 → 如實呈報錯誤，不硬鎖。

### 3.【拍板 OK 停點】
向使用者一次呈現完整包：
- change 路徑與 proposal 摘要（目標 / In-Out / delta Requirement 條數）
- 所有待拍板決策卡
- tasklist（相依順序）

請他拍板：回「**OK**」＝所有決策卡採建議選項＋同意鎖定，一次完成；有個別意見就逐項處理。結論（含 OK 時採用的建議選項）用 Edit 寫進 proposal.md 的「已拍板決策」表。

### 4. 鎖定（確定性動作，使用者明確說鎖才執行）
- 用 Edit 把 `changes/<name>/.openspec.yaml` 的 `octopus.status: Draft` 改為 `octopus.status: Locked`
- 拍板決策追記目標 repo 的 `.claude/.octopus-arena/decisions.md`（日期｜change 名｜決策｜結論）。首次建立該目錄時，提醒使用者把 `.claude/.octopus-arena/` 加入該 repo 的 `.gitignore`
- 告知使用者：`/octopus:build <change-name>` 會**自主執行到驗收完成**（實作→測試→審查→修到乾淨），他只需要等驗收報告與 merge

使用者不鎖（還要想/要先問別人）→ 保持 Draft，正常結束。

無論鎖定或保持 Draft，結束前**刪除 `.claude/.octopus-arena/.run`**（確定性動作），並追記用量到 `.claude/.octopus-arena/metrics.md`（append-only；無檔就自建，表頭 `| 日期 | 管線 | change | agent | 輪次 | tokens | 備註 |`）：
- analyst、architect 各一列——輪次＝含 SendMessage 續派的總次數；tokens 取 harness 回報的 subagent 用量，拿不到記「查無」
- 加一列 `spec 小計`——備註記拍板往返次數（TPM 回答了幾次才鎖定；保持 Draft 記「未鎖定」）
- 追記失敗不阻塞收尾（fail-open）

## 紅線
- 狀態流轉只由 command 的確定性步驟執行（本管線的步驟 4），agent 無權改 `octopus.status`
- **`Locked` 只在使用者明確拍板後才寫入**——沒有自動鎖定路徑，不得以任何理由代替他拍板
- 不碰 `openspec/specs/` 主 spec——delta 合回主 spec 是 build 收尾 archive 的事
- Analyst 打回的需求（驗收不可測）不得硬推進步驟 2

需求：$ARGUMENTS
