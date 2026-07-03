---
description: 根因分析——Debugger 出根因報告（症狀→定位→根因→為什麼以前沒炸→修法選項→回歸防護）。
argument-hint: <錯誤訊息 / log / 重現步驟>
---

用 Agent 工具啟動 **debugger** agent，把錯誤資訊原文（含截圖/log）完整轉給它。

- 它若反問（最多 2 問），轉給使用者後把答案轉回（SendMessage 延續同一個 agent）
- 它只分析不修檔；產出根因報告後完整轉述給使用者，**保留「確認 vs 推測」的區分**，不要擅自把推測講成定論
- 使用者決定修法後：小修走 `/octopus:quick`，大修建議走 `/octopus:spec`（修法本身就是需求）

問題：$ARGUMENTS
