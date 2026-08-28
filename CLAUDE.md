# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 這個 repo 是什麼

Octopus 是一個 **Claude Code plugin**（不是應用程式、沒有 build / runtime）。它本身就是 prompt 工程的成品：一組 markdown 定義的 agent 與 slash command，安裝後在「別的專案」裡用 `/octopus:<指令>` 驅動一個後端工作流 harness。唯一的可執行程式碼是兩支 hook，附回歸測試——專案根執行 `node --test`。

世界觀：**一顆頭（使用者＝TPM）＋ 七隻腳（專家 agent）**。TPM 只做三件不可替代的事——定義意圖、拍板取捨、驗收放行；agent 做其餘的實作、審查、考古、除錯。設計公理：harness 品質取決於三個 TPM 介面（需求進口、決策呈現、驗收出口）的品質，不是 agent 數量。

**v0.5 起 spec 格式全面採用 OpenSpec**（Fission-AI/OpenSpec）：目標 repo 的 `openspec/specs/<domain>/` 是「系統現況」活文件，每筆工作是 `openspec/changes/<name>/` 一筆 change；`openspec` CLI 是管線前置依賴（validate/archive）。

## 權威來源與修改順序

- **`docs/Octopus-功能文件.md` 是唯一權威設計文件。** 所有 agent/command 行為都從它推導。
- 改行為時：**先改設計文件 → 再改 `agents/` 或 `commands/`**。實作與設計文件衝突時，以設計文件為準，回去修訂後再動實作。
- 改完插件檔案後，在使用端的 Claude Code 對話執行 `/reload-plugins` 才會生效。

## 版更收尾紀律（版號提升前必跑）

1. 本輪對話的設計決定**全部落檔**（設計文件→實作），不留在對話裡
2. **反向對帳**：本次動過的章節，設計文件宣稱的產物/行為 grep 驗證實作有對應
3. 砍掉的東西補進 `docs/退場紀錄.md`（含理由）
4. **三處同步**：`plugin.json` 版號、設計文件版本標頭、本檔相關摘要

## 檔案結構與各檔職責

```
.claude-plugin/plugin.json      插件 manifest（name/version/keywords）
.claude-plugin/marketplace.json  marketplace 條目（source: "."）
commands/*.md                    slash command：主對話讀完後依步驟編排 agent
agents/*.md                      sub-agent persona：frontmatter 宣告 name + tools，body 是行為規格
hooks/hooks.json                 程式化守門註冊（PreToolUse；守門跟著管線走——只在 .octopus-arena/.run marker 有效（TTL 4h）時生效，subagent 也攔）
hooks/*.mjs                      hook 實作——慣例：純 node 零相依、fail-open、判斷邏輯 export evaluate() 可獨立驗證、訊息 zh-TW 附解法（見設計文件 §6.2）
hooks/*.test.mjs                 hook 判斷邏輯的回歸測試（node:test，零相依）——兌現「evaluate() 可獨立驗證」
docs/Octopus-功能文件.md          權威設計文件——只寫「現在的行為是什麼」
docs/退場紀錄.md                 被砍掉的方案與理由（非行為規格；加回任何一項前先讀）
docs/使用指南.md                 給使用者的操作手冊（情境→指令決策地圖＋術語表）
docs/實測指標.md                 跨專案指標彙整與讀數判準（數據源：各目標 repo Arena 的 metrics.md）
CHANGELOG.md                     各版本行為變更（版號提升時追加，README 只留 badge 連結）
LICENSE                          MIT 授權全文
```

**Command vs Agent 的分工是核心架構**：
- **Command** = 編排層（orchestration）。由主對話執行，負責流程閘門、狀態流轉、停點控制、把產物轉述給使用者。command body 多是「用 Agent 工具啟動 X，把 Y 轉給它」這類編排指令。
- **Agent** = 執行層（單一問責邊界）。每個 agent 守一條「失守代價夠大」的邊界，只在自己 `tools:` 宣告的權限內動作。

## 7 隻腳（agents/）各守的邊界

| Agent | 邊界 | tools | 關鍵紅線 |
|---|---|---|---|
| scout | 事實 vs 印象 | Read/Grep/Glob/Bash | 唯讀；每個論斷標來源等級（權威/推導/示意/查無），查無不杜撰；兼 `/octopus:overview` 鳥瞰（敘事型、不落檔） |
| analyst | 需求進口 | Read/Grep/Glob | 唯讀；驗收不可測的需求不得放行進管線；做魔鬼代言人挑戰 |
| architect | 先想再做 | Read/Grep/Glob/**Write** | 只 Write `openspec/changes/`，不碰實作 code、不碰主 specs/；Scenario 寫不出可測句式就退回；一個需求一筆 change、不自動拆分 |
| builder | 實作紀律 | Read/Grep/Glob/Write/Edit/**Bash** | 純執行層：做被指派的 task、每條出回報（派工節奏歸 Core）；一律 feature branch；**絕不 merge/推主幹/force push**；migration 只產檔不執行 |
| reviewer | 品質閘門 | Read/Grep/Glob/Bash（唯讀） | 只審不改；7 級嚴重度＋高風險掃描；多步寫入必查交易保護 |
| dba | DB 諮詢 | Read/Grep/Glob | 唯讀、不連實體 DB；SQL Server/SQLite/PostgreSQL 三方言 |
| debugger | 根因 | Read/Grep/Glob/Bash（唯讀） | 不修檔；確認的根因與推測必須分開寫 |

> 「七隻腳」＝上列 7 個 agent persona；**(Core)** 是編排層（commands＋主對話），屬頭不佔腳、**刻意不設 agent 檔**（設計文件 §2.1 / §3.0）。「理解 vs 盲簽」邊界由 build 的**隨行回報**承接（每 task 附 code 導讀），不另設 agent。新增 agent 前先回設計文件確認該邊界存在。

## SDD 交付管線（核心流程）

`/octopus:spec` →（拍板 OK 停點）→ `/octopus:build` →（驗收 merge）→（archive 結案）。`/octopus:main` 是兩段連跑。

**什麼進管線，判準是「spec 要不要變」，不是改動大小**（v0.7）：純缺陷修正（code 沒做到 spec 本來就寫的事）修完 spec 一個字不用改、沒有 delta 可寫 → 不進 Octopus，直接在對話處理；預期行為要變、或發現該行為從未被寫進主 spec → 開 change。**沒有中間輕通道**——`/octopus:quick` 已於 v0.7 退場（實測從未使用，理由見 `docs/退場紀錄.md` §5.1）。已知代價：管線外無 run-marker，兩支 hook 不生效。

設計原則：**拍板一個 OK，之後全自主、不中途等人，但看得到進度**。進度可見契約：Core 逐條派 task 給**同一個** builder（SendMessage 續派，不重開），每條收到 task 回報（做了什麼／code 導讀／自主決定／測試）即時轉呈使用者——**單向呈報不是停點**（逐條派工是該契約在當前工具限制下的實作，builder 本身純執行層、不管派工節奏，見設計文件 §5.2）。

**停點只有兩個，沒有第三個、也沒有跳過任一個的模式**（v0.6 減法，理由見 `docs/退場紀錄.md`）：

| 停點 | 何時 | TPM 做什麼 |
|---|---|---|
| 拍板 OK | change 落檔後（spec 步驟 3；build 遇 Draft 也停在這） | 回一個 `OK`（＝決策卡全採建議＋鎖定），或逐項提意見 |
| 驗收 merge | build 段尾 | 看驗收報告（開頭附「執行中自動拍板清單」）後自行 merge，或明確同意代跑 |

代為 merge：marker 已清可直接跑；罕見被攔時以 `OCTOPUS_TPM_OK=1 ` 前綴留痕，同意後直接重跑、不重複請示。不 merge 即否決（builder 紅線保證 branch 上一切可逆）。

**merge ≠ archive**：merge 決定 code 進主幹；`openspec archive`（CLI，經 TPM 點頭才跑）把 delta 合回主 spec、change 歸檔＝結案。tasks 未全完成（如舊資料 backfill 待跑）→ 不 archive、change 留開——這就是「code 已修、資料待補」的修復狀態追蹤。

build 段執行中不等人（逐 task 實作→測試→審查→P1 自動退修上限 3 輪）：高風險決策取保守預設＋決策卡留痕、P1 三輪不乾淨直接收尾標紅、spec 矛盾按最合理解釋標註後繼續——全部集中呈報在驗收報告，不中途暫停。

**頁面實測不進管線**：需要人眼在頁面上確認的項目，由 Reviewer 寫進驗收報告的「高風險變更點」（「建議親自在 X 確認 Y」）。管線不代跑瀏覽器——要跑就是使用者當次明講的一次性請求，不是流程步驟。

**不要再加模式**：新增執行模式／旁路／組織形態之前，先答「刪掉它會壞什麼」。答不出具體損失就不要加（設計文件 §1.4 第二公理）。

### change 狀態機（重要不變量）

change 的 `.openspec.yaml` 記 `octopus.status: Draft → Locked → Implemented`。

- **狀態只由 command 用 Edit 確定性改寫，且 `Locked` 只在 TPM 明確拍板後寫入（沒有自動鎖定路徑）；agent 一律無權改 status。** `Locked` 只有一個意思：TPM 拍板過。
- `/octopus:build` 入口閘門：CLI 缺 → 停請安裝；`Draft` → **停下請拍板**（拍完才鎖定續跑）；`Implemented`、已 archive 或缺 `octopus.status` 直接拒絕/停下，這個拒絕不可被任何理由說服繞過。
- `Implemented`＝已 merge；archive 後整夾移入 `changes/archive/`＝終態。

## 跨檔慣例（改動時務必沿用）

- **語言**：所有 agent/command 一律以繁體中文（zh-TW）回覆；agent body 都明寫這條。
- **來源標註是紅線**：scout/dba/analyst/debugger 的每個論斷都要標依據等級，查無明說、不杜撰，引用 code 給 `file:line`。
- **merge 權永遠在使用者手上**：任何 agent/command 不 commit 主幹、不 merge、未經明確同意不代為 merge；`openspec archive` 也要點頭才跑。
- **OpenSpec 格式紅線**：spec delta 嚴格照官方結構（`## ADDED/MODIFIED/REMOVED Requirements`、`### Requirement:` 含至少一個 `#### Scenario:` GIVEN/WHEN/THEN），要能過 `openspec validate`；MODIFIED 給完整新版全文。確定性動作（validate/archive）交 CLI，不自行模擬。
- **不碰主 spec**：任何 agent/command 不直接改 `openspec/specs/`——delta 合回只透過 `openspec archive`。
- **Arena 知識庫**：spec/build 在「目標 repo」的 `.claude/.octopus-arena/decisions.md` 追記拍板決策；init/spec/build 收尾另追記 `metrics.md` 用量（append-only、fail-open、agent 無權寫）。預設私有——首次建立時要提醒使用者把 `.claude/.octopus-arena/` 加進該 repo 的 `.gitignore`。
- **路徑引用**：command 引用插件內檔案用 `${CLAUDE_PLUGIN_ROOT}/...`。

## 新增/修改 command 或 agent 的注意點

- command frontmatter 需要 `description` 與 `argument-hint`；使用者輸入透過 `$ARGUMENTS` 取得。
- agent frontmatter 需要 `name`、`description`、`tools`（最小權限原則——唯讀 agent 不要給 Write/Edit/Bash）。
- 啟動 agent 用 Agent 工具；延續同一個 agent 的多輪對話用 SendMessage（不要重開新 agent——builder 的逐 task 續派、analyst/debugger 的反問往返、reviewer⇄builder 退修迴圈都靠這個）。
- command body 開頭常要求「先 Read 某些檔再開始」（如 main.md 要求先讀 spec.md 與 build.md）——這是刻意的單一事實來源設計，不要把規則複製進多個 command。
