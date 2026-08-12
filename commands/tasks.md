---
description: 單獨產出 tasklist——給 change 名稱/路徑從 change 展開；給需求文字則先輕量釐清再拆（非正式 tasklist）。不實作。
argument-hint: <change 名稱/路徑，或一段需求描述>
---

這是 Octopus 的 **tasks 展開**：只產 tasklist，不進實作。你（主對話）依輸入型態二擇一執行。

## 情境 A：輸入是 change（名稱或路徑，`openspec/changes/<name>/` 找得到）

1. Read 該 change 的 proposal 與 specs delta，以及 `.openspec.yaml` 的 `octopus.status`。狀態不限（Draft 也可以拆，方便估量）；**非 Locked 時在輸出頂部標註**：「⚠ 本 tasklist 基於 <status> change，鎖定前可能變動；要進實作請先在 /octopus:spec 或 /octopus:build 入口拍板鎖定」
2. 用 Agent 工具啟動 **architect**（情境 B）展開 tasks（相依順序＋對應 Requirement＋驗證方式）
3. 完整轉述給使用者

## 情境 B：輸入是需求文字（沒有對應 change）

1. 用 Agent 工具啟動 **analyst** 做**輕量釐清**：只在「連拆 task 都拆不下去」時反問（最多 1 輪），否則直接帶假設分析
2. 把 Analyst 的結構化需求轉給 **architect** 拆 tasks
3. 輸出頂部標註：「⚠ 非正式 tasklist——未經 change 化與鎖定，僅供估量與排程參考；要進實作請走 /octopus:spec」
4. 完整轉述，含 Analyst 列出的假設與 Open Questions

## 紅線

- 本 command 只產 tasklist，**不啟動 Builder**、不改任何實作檔案
- 「不確定歸屬/做法」的 task 不硬拆——標明不確定點與該先釐清的問題

輸入：$ARGUMENTS
