---
description: 在既有專案初始化 Octopus——摸專案、盤點 SDD 現況（spec 狀態欄位）、建 Arena、出交接報告。每個專案跑一次。
argument-hint: （無參數）
---

這是 Octopus 的 **init**：把一個既有專案接上 Octopus。你（主對話）依序執行。

## 步驟

### 1. 摸專案
用 Agent 工具啟動 **scout**，請它回報專案概況：
- 架構與分層、主要語言/框架
- 測試怎麼跑（指令、框架）
- DB 種類與 schema/migration 檔位置（找 `*.sql`、`migrations/`、ORM model）
- API 形式（REST/GraphQL/gRPC；有無 OpenAPI 檔）

### 2. 盤點 SDD 現況（確定性檢查，自己做不用 agent）
- Glob `specs/**/spec.md` 與 `specs/_TEMPLATE.md`（或同等慣例位置）
- 逐份 Read frontmatter：**有沒有 `status:` 欄位？值是什麼？**
- 若專案把狀態記在別處（如總覽/能力地圖文件），把兩邊狀態對照列出

### 3.【TPM 確認點：狀態補登】
缺 `status:` 的 spec 列成清單問使用者：「這幾份各是什麼狀態（Draft/Reviewed/Locked/Implemented）？」
- 他逐一回答（或說「照能力地圖抄」）→ 用 Edit 補進各 spec frontmatter
- **不可自行判定狀態**——尤其不可擅自標 Locked；他不想現在處理就跳過，build 時自然會被閘門擋

### 4. 建 Arena
- 建 `.claude/.octopus-arena/decisions.md`（表頭：`日期｜spec｜決策｜結論`）
- 檢查該 repo `.gitignore`：沒有 `.claude/.octopus-arena/` 這行就加上（Octopus 預設私有），並告知使用者已加

### 5. 交接報告（一屏內）
```markdown
## Octopus 接機報告：<專案名>
- 概況：<語言/框架/分層，一~兩行>
- 測試：<指令>；DB：<種類，schema 位置>
- Spec 盤點：共 N 份——Locked X（可直接 /octopus:build）/ Draft·Reviewed Y / 缺狀態 Z
- Arena：已建立（已加入 .gitignore）
- 建議下一步：<例：004 已 Locked → /octopus:build specs/004-xxx；或：spec 皆未鎖，先審 spec>
```

## 紅線
- init 只補狀態欄位、建 Arena、改 .gitignore——**不動任何 spec 內容與實作 code**
- 報告不落檔（可從 code 推導的事實不沉澱，要看就再跑 /octopus:ask）

$ARGUMENTS
