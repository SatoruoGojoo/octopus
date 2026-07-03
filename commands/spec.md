---
description: SDD 前半段：需求釐清（反問+挑戰）→ EARS spec＋tasklist 一次落檔（Draft）→ TPM 拍板鎖定。鎖定後 build 全自主執行。
argument-hint: <需求描述（可貼文字/截圖）>
---

這是 Octopus 的 **spec 管線**（SDD 前半段）。你（主對話）擔任 Core 編排，依序執行。

設計原則：**討論集中在這一段，拍板只有一次**。TPM 在鎖定點看到的是完整包（spec＋決策卡＋tasklist），鎖定之後 `/octopus:build` 全自主執行，他不需要再被打斷。

## 步驟

### 1. 需求釐清
用 Agent 工具啟動 **analyst**，把需求原文（含圖片）完整轉給它。
- 它若反問（≤3 問 × ≤2 輪），把問題轉給使用者，答案轉回給它（用 SendMessage 延續同一個 analyst，不要重開）
- 它會做魔鬼代言人挑戰；挑戰結果一併呈現給使用者
- 產出：結構化需求分析

### 2. 起草 spec＋tasklist
用 Agent 工具啟動 **architect**（情境 A），轉給它：
- Analyst 的結構化需求分析全文
- 內建範本路徑：`${CLAUDE_PLUGIN_ROOT}/templates/spec-template.md`（它會優先找目標 repo 自己的範本）

產出：`specs/NNN-<slug>/spec.md`（`status: Draft`）＋ `specs/NNN-<slug>/tasks.md` ＋ 決策卡清單（如有）。

### 3.【唯一硬停點：拍板與鎖定】
向使用者一次呈現完整包：
- spec 路徑與摘要（目標 / In-Out / 驗收標準條數）
- 所有待拍板決策卡
- tasklist（相依順序）

請他拍板：決策卡結論用 Edit 寫進 spec 的「已拍板決策」表；然後問**要不要鎖定**。

### 4. 鎖定（確定性動作，使用者明確說鎖才執行）
- 用 Edit 把 frontmatter `status: Draft` 改為 `status: Locked`
- 拍板決策追記目標 repo 的 `.claude/.octopus-arena/decisions.md`（日期｜spec 編號｜決策｜結論）。首次建立該目錄時，提醒使用者把 `.claude/.octopus-arena/` 加入該 repo 的 `.gitignore`
- 告知使用者：`/octopus:build specs/NNN-*/spec.md` 會**自主執行到驗收完成**（實作→測試→審查→修到乾淨），他只需要等驗收報告與 merge

使用者不鎖（還要想/要先問別人）→ 保持 Draft，正常結束。

## 紅線
- 狀態流轉只由本 command 的步驟 4 執行，agent 無權改 status
- Analyst 打回的需求（驗收不可測）不得硬推進步驟 2

需求：$ARGUMENTS
