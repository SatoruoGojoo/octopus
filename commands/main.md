---
description: 完整 SDD 管線：討論一次（釐清→spec＋tasks→你拍板鎖定）→ 之後全自主執行到驗收報告，你只剩 merge。
argument-hint: <需求描述>（加 step 可逐步確認）
---

這是 Octopus 的 **main 管線**＝ `/octopus:spec` 接 `/octopus:build` 連跑，沒有第三套邏輯。整條管線只有**兩個硬停點**：

1. 完整執行 spec.md 的步驟 1~4——釐清與挑戰的往返都集中在這段，最後一次呈現完整包（spec＋決策卡＋tasklist），【硬停點一：拍板鎖定】
2. 使用者選「鎖定並繼續」→ 以剛產出的 spec 路徑執行 build.md 步驟 0~5：**全自主**（實作→測試→審查→P1 自動修到乾淨），直到【硬停點二：驗收 merge】
3. 使用者在鎖定點選「先停」→ 正常結束，日後 `/octopus:build` 接續

例外停點（事件觸發，非排程確認）：高風險決策、P1 三輪修不乾淨、spec 矛盾——見 build.md「何時停」。
使用者輸入含 `step` 時，兩段都改逐步模式。

兩段行為規則一律以 `${CLAUDE_PLUGIN_ROOT}/commands/spec.md` 與 `${CLAUDE_PLUGIN_ROOT}/commands/build.md` 為準（先 Read 這兩檔再開始）。

需求：$ARGUMENTS
