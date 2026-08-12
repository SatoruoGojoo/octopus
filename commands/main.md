---
description: 完整 SDD 管線：釐清→spec＋tasks 落檔→你回一個 OK（=拍板＋鎖定）→ 全自主執行到驗收報告，你只剩 merge。
argument-hint: <需求描述>
---

這是 Octopus 的 **main 管線**＝ `/octopus:spec` 接 `/octopus:build` 連跑，沒有第三套邏輯。

1. 執行 spec.md 步驟 0~4——Analyst 釐清反問（發生在起點、使用者還在場）；Architect 產完整包（change：proposal＋delta＋tasks＋決策卡，落檔 `Draft`）；呈現後等使用者**一個 OK**（＝決策卡全採建議選項＋鎖定；有意見就回話逐項改）
2. 鎖定後以該 change 名稱執行 build.md 步驟 0~5：**全自主**（Builder 逐 task 實作＋隨行回報→審查→P1 自動修，執行中不等人），直到【唯一硬停點：驗收 merge】

整條管線只有兩個停點：**拍板 OK** 與 **驗收 merge**，沒有跳過任一個的模式。

兩段行為規則一律以 `${CLAUDE_PLUGIN_ROOT}/commands/spec.md` 與 `${CLAUDE_PLUGIN_ROOT}/commands/build.md` 為準（先 Read 這兩檔再開始）。

需求：$ARGUMENTS
