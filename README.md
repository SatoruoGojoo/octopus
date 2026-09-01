# Octopus 🐙

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.8.1-green.svg?style=flat-square)](CHANGELOG.md)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-8A2BE2?style=flat-square)](https://code.claude.com/docs/en/plugins)

> **一顆頭（你，TPM）＋ 七隻腳（7 個專家 agent）的後端工作流 harness。**
> 你定義意圖、拍板取捨、驗收放行；七隻腳做實作、審查、考古、除錯。
> **7 個 agent · 9 個指令 · 2 個程式化守門 · 2 個停點。**

> **Note (English)**: Octopus is a **Traditional Chinese (zh-TW)** workflow harness — every agent is specified to respond in zh-TW. It works with any codebase, but the output language is not configurable.

---

## 這是什麼

一個 Claude Code plugin，把「規格驅動開發」變成一條你只需要拍板兩次的管線。

它要解決的問題是：**AI 寫得很快，但你不知道它在寫什麼、也來不及看**。Octopus 的答案不是加更多審查，而是把你的介入點壓到兩個——需求定案時看一次完整包，交付時看一份驗收報告——中間全自主執行，但每完成一條 task 就即時回報，你隨行看得懂每段 code。

spec 格式採用 [OpenSpec](https://github.com/Fission-AI/OpenSpec)：`openspec/specs/` 是系統現況的活文件，每筆工作是 `openspec/changes/` 的一筆 change。

## 快速開始

**前置需求**

| 需要 | 說明 |
|---|---|
| [Claude Code](https://code.claude.com) | CLI、桌面版皆可（桌面版請用 **Code** 分頁，Chat / Cowork 分頁的 sub-agent 是停用的） |
| [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec) | 交付管線的前置依賴（validate / archive）。純諮詢指令不需要 |
| Node.js | 兩支 hook 用純 node 執行，零第三方相依 |

**安裝**

```bash
# 從 GitHub 安裝（在 Claude Code 對話內執行）
/plugin marketplace add SatoruoGojoo/octopus
/plugin install octopus@octopus
```

```bash
# 或：本地開發用（不安裝，僅該次 session 載入）
claude --plugin-dir /path/to/octopus
```

改了插件檔案後，在對話內執行 `/reload-plugins` 重新載入；用 `/hooks` 可確認守門已註冊。

**第一次使用**

1. 在你的專案跑 `/octopus:init`——檢查 OpenSpec 環境、盤點 change 狀態、建 Arena，出一份交接報告
2. 試 `/octopus:ask 這個專案的進入點在哪、分幾層？`
3. 試 `/octopus:overview` 看一次全貌
4. 需求很模糊時，把原始訊息（文字或截圖）貼給 **analyst**，讓它先反問你三個問題

## 實際跑起來長這樣

一個小需求（「註冊時 email 重複要擋下，回友善錯誤而不是 500」）從 `/octopus:spec` 走到驗收 merge 的完整走查——包含 Analyst 會問你哪三題、決策卡長什麼樣、你在哪兩個點被要求做決定——見[使用指南的 worked example](docs/使用指南.md#走一次從需求到驗收worked-example)。

## 七隻腳

每一隻守一條「失守代價夠大」的邊界，只在自己宣告的權限內動作。

| Agent | 守的邊界 | 權限 | 關鍵紅線 |
|---|---|---|---|
| **scout** | 事實 vs 印象 | 唯讀＋Bash | 每個論斷標來源等級，查無不杜撰 |
| **analyst** | 需求進口 | 唯讀 | 驗收不可測的需求不得進管線；做魔鬼代言人 |
| **architect** | 先想再做 | 唯讀＋Write | 只寫 `openspec/changes/`，不碰實作 code 與主 specs |
| **builder** | 實作紀律 | 讀寫＋Bash | 一律 feature branch；**絕不 merge / 推主幹 / force push** |
| **reviewer** | 品質閘門 | 唯讀＋Bash | 只審不改；7 級嚴重度＋高風險掃描 |
| **dba** | DB 諮詢 | 唯讀 | 不連實體 DB；SQL Server / SQLite / PostgreSQL 三方言 |
| **debugger** | 根因 | 唯讀＋Bash | 不修檔；確認的根因與推測分開寫 |

編排層（commands ＋ 主對話）屬頭不佔腳，刻意不設 agent 檔。

## 指令

**接機**（每個專案跑一次）

| 指令 | 用途 |
|---|---|
| `/octopus:init` | 檢查 OpenSpec CLI 與結構、摸專案概況、盤點 change 狀態、建 Arena＋gitignore、出交接報告 |

**諮詢通道**（唯讀，不需要 OpenSpec CLI）

| 指令 | 用途 |
|---|---|
| `/octopus:ask <問題>` | 問 codebase / git 歷史 / 進度，答案附 `file:line` 與 commit hash |
| `/octopus:overview [範圍]` | 專案鳥瞰：分層架構＋模組職責＋依賴方向＋關鍵流程走讀 |
| `/octopus:db <問題>` | schema 設計、三方言差異、migration 影響、索引與效能 |
| `/octopus:debug <錯誤>` | 症狀 → 定位 → 根因 → 為什麼以前沒炸 → 修法選項 → 回歸防護 |
| `/octopus:review [branch]` | 四段式驗收報告，可直接當 PR description |

**SDD 交付管線**

| 指令 | 用途 |
|---|---|
| `/octopus:spec <需求>` | 討論段：釐清＋挑戰 → change 一次落檔（proposal＋delta＋tasks，`Draft`）→ 你回一個 **OK** →【拍板停點】鎖定。可以停在這，改天再 build |
| `/octopus:build <change>` | 執行段（**全自主**）：驗 `Locked` → Builder 逐 task 實作＋隨行回報 → 審查 → P1 自動退修（≤3 輪）→ 驗收報告 →【驗收停點】你 merge |
| `/octopus:main <需求>` | 兩段連跑：一個 OK 之後直達驗收報告 |

## 設計原理

**兩個停點，沒有第三個。**

| 停點 | 何時 | 你做什麼 |
|---|---|---|
| 拍板 OK | change 落檔後 | 回一個 `OK`（＝決策卡全採建議＋鎖定），或逐項提意見 |
| 驗收 merge | build 段尾 | 看驗收報告後自行 merge，或明確同意代跑 |

沒有跳過任一個的模式。`Locked` 只有一個意思：**你拍板過了**，沒有自動鎖定的旁路。

**執行中不等人，但看得到進度。** Builder 每完成一條 task 就即時回報（做了什麼／code 導讀／自主決定／測試），單向呈現、不等你回覆——這是你隨行理解每段 code 的機制，跑完不必回頭補看。高風險決策取保守預設並留痕、P1 三輪修不乾淨直接收尾標紅、spec 矛盾按最合理解釋標註後繼續，全部集中呈報在驗收報告開頭。看到方向不對隨時可以插話打斷。

**什麼進管線，判準是「spec 要不要變」，不是改動大小。** 純缺陷修正（code 沒做到 spec 本來就寫的事）修完 spec 一個字不用改、沒有 delta 可寫 → 不進 Octopus，直接在對話處理。預期行為要變、或發現該行為從未被寫進主 spec → 開 change。代價是管線外沒有 run-marker，兩支 hook 不生效。

**merge ≠ 結案。** merge 決定 code 進主幹；`openspec archive`（經你點頭才跑）把 delta 合回主 spec、change 歸檔才是結案。tasks 沒做完（如舊資料待 backfill）可以先 merge、change 留開——這就是「code 已修、資料待補」的修復狀態追蹤。

## 跟其他工具的關係

**vs OpenSpec 原生的 `/opsx:*`** — 互補，不是替代。OpenSpec 提供 spec 格式、CLI 與 change 生命週期；Octopus 是**架在它上面的 TPM 編排層**——加上專家分工、兩個停點的決策紀律、程式化守門與驗收報告。你可以只用 OpenSpec，Octopus 假設你已經在用它。

**vs subagent 集合**（如 awesome-claude-code-subagents 這類）— 那些提供「更多角色」，Octopus 刻意只有 7 個。設計公理是：harness 品質取決於三個 TPM 介面（需求進口、決策呈現、驗收出口）的品質，不是 agent 數量。加 agent 之前要先答「刪掉它會壞什麼」。

**vs 通用工作流 plugin** — 多數是 prompt 紀律。Octopus 的兩條最貴紅線（主幹保護、change 狀態機）是**程式化 hook**，不靠 agent 自覺。

**輸出語言是 zh-TW**，這是刻意的定位，不是尚未國際化。

## 使用須知

- **merge 權永遠在你手上**：所有實作都在 feature branch，Octopus 不 commit 主幹、不 merge、未經明確同意不代跑 `archive`。
- **程式化守門**：內建兩個 PreToolUse hook——`branch-guard`（擋主幹 commit/push、`git merge`、force push）與 `spec-status-guard`（`octopus.status` 只准單步順向 `Draft → Locked → Implemented`）。**守門跟著管線走**：只在管線執行中（`.claude/.octopus-arena/.run` marker 有效，TTL 4 小時）攔截，日常 git 操作零干預。執行中的例外同意＝在指令**最前面**加 `OCTOPUS_TPM_OK=1 `（寫在指令裡＝留痕可稽核）。
- **誠實原則**：所有回答標註來源等級（權威檔案／code 推導／文件示意／查無），查無不杜撰。
- **Arena 知識庫**：管線會在目標 repo 的 `.claude/.octopus-arena/` 追記拍板決策與用量，**預設請加進該 repo 的 `.gitignore`**（每人私有）；想升級成團隊共享再移除該行。
- 本插件不連線任何資料庫、不需要任何憑證。

## 已知限制

- **hooks 會在你的機器上執行 node**：`hooks/hooks.json` 註冊兩個 PreToolUse hook，以你的權限執行 `hooks/*.mjs`。兩支都是純 node、零相依、fail-open，程式碼在 repo 內可自行檢視。回歸測試目前只涵蓋 `branch-guard`（專案根 `node --test`）；`spec-status-guard` 的判斷邏輯同樣以 `evaluate()` export，但測試尚未補上。
- **builder agent 有 Bash 權限**：交付管線執行中，builder 會在你的專案裡執行指令（跑測試、git 操作）。`branch-guard` 只守 git 相關紅線，**不是通用沙箱**。
- **prompt injection 未設防**：scout / reviewer / debugger 會讀取目標 repo 的內容，若其中含惡意指示，agent 可能被影響。這是所有 AI coding agent 的共同弱點，Octopus 沒有針對它的緩解措施。
- **管線外沒有守門**：hooks 只在管線執行中生效；日常對話中的 git 操作零干預。

## 授權

MIT（全文見 [`LICENSE`](LICENSE)）。可自由使用、修改、散布，含商業用途與閉源修改，唯一條件是保留著作權聲明與授權條文。軟體按現狀提供，不附任何形式的擔保。

## 文件

| 文件 | 內容 |
|---|---|
| [使用指南](docs/使用指南.md) | 情境 → 指令決策地圖＋術語對照表。不知道該用哪個指令時看這份 |
| [Octopus 功能文件](docs/Octopus-功能文件.md) | 權威設計文件。所有 agent / command 行為都從它推導 |
| [退場紀錄](docs/退場紀錄.md) | 被砍掉的方案與理由。想加回某個功能前先讀 |
| [CHANGELOG](CHANGELOG.md) | 各版本的行為變更 |
