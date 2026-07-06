# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 這個 repo 是什麼

Octopus 是一個 **Claude Code plugin**（不是應用程式、沒有 build / test / runtime）。它本身就是 prompt 工程的成品：一組 markdown 定義的 agent 與 slash command，安裝後在「別的專案」裡用 `/octopus:<指令>` 驅動一個後端工作流 harness。

世界觀：**一顆頭（使用者＝TPM）＋ 八隻腳（專家 agent）**。TPM 只做三件不可替代的事——定義意圖、拍板取捨、驗收放行；agent 做其餘的實作、審查、考古、除錯。設計公理：harness 品質取決於三個 TPM 介面（需求進口、決策呈現、驗收出口）的品質，不是 agent 數量。

## 權威來源與修改順序

- **`docs/Octopus-功能文件.md` 是唯一權威設計文件。** 所有 agent/command 行為都從它推導。
- 改行為時：**先改設計文件 → 再改 `agents/` 或 `commands/`**。實作與設計文件衝突時，以設計文件為準，回去修訂後再動實作。
- 改完插件檔案後，在使用端的 Claude Code 對話執行 `/reload-plugins` 才會生效。

## 檔案結構與各檔職責

```
.claude-plugin/plugin.json      插件 manifest（name/version/keywords）
.claude-plugin/marketplace.json  marketplace 條目（source: "."）
commands/*.md                    slash command：主對話讀完後依步驟編排 agent
agents/*.md                      sub-agent persona：frontmatter 宣告 name + tools，body 是行為規格
templates/spec-template.md       內建 EARS spec 範本（目標 repo 有自己的就讓位）
docs/Octopus-功能文件.md          權威設計文件
```

**Command vs Agent 的分工是核心架構**：
- **Command** = 編排層（orchestration）。由主對話執行，負責流程閘門、狀態流轉、停點控制、把產物轉述給使用者。command body 多是「用 Agent 工具啟動 X，把 Y 轉給它」這類編排指令。
- **Agent** = 執行層（單一問責邊界）。每個 agent 守一條「失守代價夠大」的邊界，只在自己 `tools:` 宣告的權限內動作。

## 8 隻腳（agents/）各守的邊界

| Agent | 邊界 | tools | 關鍵紅線 |
|---|---|---|---|
| scout | 事實 vs 印象 | Read/Grep/Glob/Bash | 唯讀；每個論斷標來源等級（權威/推導/示意/查無），查無不杜撰 |
| analyst | 需求進口 | Read/Grep/Glob | 唯讀；驗收不可測的需求不得放行進 spec 管線；做魔鬼代言人挑戰 |
| architect | 先想再做 | Read/Grep/Glob/**Write** | 只 Write spec/tasks，不碰實作 code；驗收寫不出可測句式就退回 |
| builder | 實作紀律 | Read/Grep/Glob/Write/Edit/**Bash** | 一律 feature branch；**絕不 merge/推主幹/force push**；migration 只產檔不執行 |
| reviewer | 品質閘門 | Read/Grep/Glob/Bash（唯讀） | 只審不改；7 級嚴重度＋高風險掃描；多步寫入必查交易保護 |
| dba | DB 諮詢 | Read/Grep/Glob | 唯讀、不連實體 DB；SQL Server/SQLite/PostgreSQL 三方言 |
| debugger | 根因 | Read/Grep/Glob/Bash（唯讀） | 不修檔；確認的根因與推測必須分開寫 |
| examiner | 理解 vs 盲簽 | Read/Grep/Glob/Bash（唯讀） | 只讀不改；出功能理解題不考檔名/實作瑣事；教學不擋門——答錯講解、不得建議禁止 merge |

> 「八隻腳」＝上列 8 個 agent persona；**(Core)** 是編排層（commands＋主對話），屬頭不佔腳、**刻意不設 agent 檔**（設計文件 §2.1 / §3.0）。新增 agent 前先回設計文件確認該邊界存在。

## SDD 交付管線（核心流程）

`/octopus:spec` →（拍板鎖定）→ `/octopus:build` →（驗收 merge）。`/octopus:main` 是兩段連跑。

設計原則：**討論集中在前段、拍板只有一次，之後全自主**。整條管線只有兩個硬停點：
1. **拍板鎖定**（spec 段尾）：TPM 一次看到完整包（spec＋決策卡＋tasklist），確認後鎖定。
2. **驗收 merge**（build 段尾）：TPM 看驗收報告後自行 merge。

build 段預設全自主（實作→測試→審查→P1 自動退修，上限 3 輪），**例外才停**：高風險決策（migration/權限/對外契約/不可逆且 spec 未涵蓋）、P1 三輪修不乾淨、實作中發現 spec 矛盾。指令加 `step` 改逐步確認模式。

**理解檢核（examiner）不是新停點**：build 變更動到程式邏輯時，硬停點二之前由 examiner 出 2~4 題功能理解題逐題問答——檢核的是「TPM 認知 ↔ 成品」的差異（spec↔code 對齊歸 reviewer），出題優先取材 spec 未釘死、builder 自主決定的點；純文案/註解/格式/設定跳過；quick 不觸發；答錯採講解＋引 code，不擋 merge。

### spec 狀態機（重要不變量）

spec frontmatter `status: Draft → Locked → Implemented`。

- **狀態只由 command 在使用者明確確認後用 Edit 改寫；agent 一律無權改 status。**
- `/octopus:build` 入口閘門：`status` 非 `Locked` **直接拒絕**，不提供「先做做看」的繞道。這個閘門不可被任何理由說服繞過。

## 跨檔慣例（改動時務必沿用）

- **語言**：所有 agent/command 一律以繁體中文（zh-TW）回覆；agent body 都明寫這條。
- **來源標註是紅線**：scout/dba/analyst/debugger 的每個論斷都要標依據等級，查無明說、不杜撰，引用 code 給 `file:line`。
- **merge 權永遠在使用者手上**：任何 agent/command 不 commit 主幹、不 merge、未經明確同意不代為 merge。
- **Arena 知識庫**：spec/build 在「目標 repo」的 `.claude/.octopus-arena/decisions.md` 追記拍板決策，預設私有——首次建立時要提醒使用者把 `.claude/.octopus-arena/` 加進該 repo 的 `.gitignore`。
- **路徑引用**：command 引用插件內檔案用 `${CLAUDE_PLUGIN_ROOT}/...`（例：`${CLAUDE_PLUGIN_ROOT}/templates/spec-template.md`）。
- **範本讓位**：architect 先找目標 repo 自己的 `specs/_TEMPLATE.md` / 既有 spec 慣例，沒有才用內建範本。
- **EARS 句式**：spec 行為規格用 WHEN/WHILE/IF…THE SYSTEM SHALL…，每條行為對應至少一條可測驗收標準。

## 新增/修改 command 或 agent 的注意點

- command frontmatter 需要 `description` 與 `argument-hint`；使用者輸入透過 `$ARGUMENTS` 取得。
- agent frontmatter 需要 `name`、`description`、`tools`（最小權限原則——唯讀 agent 不要給 Write/Edit/Bash）。
- 啟動 agent 用 Agent 工具；延續同一個 agent 的多輪對話用 SendMessage（不要重開新 agent，例如 analyst/debugger 的反問往返）。
- command body 開頭常要求「先 Read 某些檔再開始」（如 main.md 要求先讀 spec.md 與 build.md）——這是刻意的單一事實來源設計，不要把規則複製進多個 command。
