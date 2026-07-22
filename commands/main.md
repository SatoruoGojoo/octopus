---
description: 完整 SDD 管線：釐清→spec＋tasks 落檔→你回一個 OK（=拍板＋鎖定）→ 全自主執行到驗收報告，你只剩 merge。加 auto 連 OK 都省。
argument-hint: <需求描述>（加 auto 純一條龍；加 step 逐步確認）
---

這是 Octopus 的 **main 管線**＝ `/octopus:spec` 接 `/octopus:build` 連跑，沒有第三套邏輯。

1. 執行 spec.md 步驟 0~4——Analyst 釐清反問與規劃輕問照常（都發生在起點、使用者還在場）；Architect 產完整包（spec＋決策卡＋tasklist，落檔 `Draft`；判斷拆 epic 時另產 roadmap）；呈現後等使用者**一個 OK**（＝決策卡全採建議選項＋鎖定；有意見就回話逐項改）
2. 鎖定後以該 spec 路徑（epic 模式為 roadmap 路徑）執行 build.md 步驟 0~6：**全自主**（實作→測試→審查→P1 自動修，執行中不等人），直到【唯一硬停點：驗收 merge】
3. 輸入含 `auto` → 跳過 spec.md 的規劃輕問（逕交 Architect 判斷）與步驟 3~4 的拍板停點，直接進 build（入口自動鎖定＋留痕），純一條龍直達驗收報告
4. 輸入含 `step` → 兩段都改逐步確認模式

兩段行為規則一律以 `${CLAUDE_PLUGIN_ROOT}/commands/spec.md` 與 `${CLAUDE_PLUGIN_ROOT}/commands/build.md` 為準（先 Read 這兩檔再開始）。

需求：$ARGUMENTS
