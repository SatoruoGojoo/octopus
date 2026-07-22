---
description: 在既有專案初始化 Octopus——摸專案、檢查 OpenSpec CLI 與結構（缺則引導安裝）、盤點 change 狀態、建 Arena、出交接報告。每個專案跑一次。
argument-hint: （無參數）
---

這是 Octopus 的 **init**：把一個既有專案接上 Octopus。你（主對話）依序執行。

## 步驟

### 1. OpenSpec 前置檢查（確定性檢查，自己做不用 agent）
- **CLI**：Bash 跑 `openspec --version`。失敗 → **停**，請使用者先安裝（npm 全域安裝 OpenSpec CLI，指令以官方 README 為準：github.com/Fission-AI/OpenSpec），裝好回覆再續
- **結構偵測**：
  - 有 `openspec/config.yaml` → v1.x，直接接管
  - 有 `openspec/project.md` 或 `openspec/AGENTS.md`（無 config.yaml）→ v0.x legacy——提示使用者官方建議跑 `openspec update` 升級（並照官方 migration guide 手動把 project.md 內容遷到 config.yaml），**不代跑**；specs/changes 核心結構兩代一致，可先照常盤點
  - 都沒有 → **停**，請使用者自行在終端跑 `openspec init`（互動式，不代跑），跑完回覆再續
- **舊 Octopus 格式偵測**：Glob `specs/*/spec.md`（v0.4 前的 `specs/NNN-*` 格式）——有就列出並提示：未完成的舊 spec 建議改開成 change（`/octopus:spec` 重新走），已完工的留著當歷史即可；**不代遷移**

### 2. 摸專案
用 Agent 工具啟動 **scout**，請它回報專案概況：
- 架構與分層、主要語言/框架
- 測試怎麼跑（指令、框架）
- DB 種類與 schema/migration 檔位置（找 `*.sql`、`migrations/`、ORM model）
- API 形式（REST/GraphQL/gRPC；有無 OpenAPI 檔）

### 3. 盤點 change 現況（確定性檢查）
- Bash 跑 `openspec list --specs` 與 `openspec list --changes`（或 Glob `openspec/specs/**/spec.md`、`openspec/changes/*/`）
- 逐筆開放中的 change：Read `.openspec.yaml`——**有沒有 `octopus.status`？值是什麼？** 順讀 tasks.md 的 checkbox 完成度

### 4.【TPM 確認點：狀態補登】
缺 `octopus.status` 的 change 列成清單問使用者：「這幾筆各是什麼狀態（Draft／Locked／Implemented）？」
- 他逐一回答 → 用 Edit 補進各 `.openspec.yaml`（無此檔就建立）
- **不可自行判定狀態**——尤其不可擅自標 Locked；他不想現在處理就跳過，缺狀態的 change 進 build 會在入口被要求先補登

### 5. 建 Arena
- 建 `.claude/.octopus-arena/decisions.md`（表頭：`日期｜change｜決策｜結論`）
- 檢查該 repo `.gitignore`：沒有 `.claude/.octopus-arena/` 這行就加上（Octopus 預設私有），並告知使用者已加

### 6. 交接報告（一屏內）
```markdown
## Octopus 接機報告：<專案名>
- 概況：<語言/框架/分層，一~兩行>
- 測試：<指令>；DB：<種類，schema 位置>
- OpenSpec：CLI <版本>；結構 <v1.x / legacy（建議升級）>；主 spec <N 個 domain>
- Change 盤點：開放中 N 筆——Locked X（可直接 /octopus:build）/ Draft Y / Implemented 待 archive Z / 缺狀態 W
- Arena：已建立（已加入 .gitignore）
- 建議下一步：<例：add-xxx 已 Locked → /octopus:build add-xxx；或：無開放 change，需求進來走 /octopus:spec>
```

## 紅線
- init 只補 `octopus.status`、建 Arena、改 .gitignore——**不動任何 spec/change 內容與實作 code**，不代跑 `openspec init`/`update`/`archive`
- 報告不落檔（可從 code 推導的事實不沉澱，要看就再跑 /octopus:ask）

$ARGUMENTS
