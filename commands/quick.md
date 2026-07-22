---
description: 小修小補輕通道——不啟動管線、不開 change，直接做完出簡版報告
argument-hint: <要修/要加的小東西>
---

這是 Octopus 的 **quick 輕通道**：給「單檔可定位、不碰 schema/契約/權限」的小任務用，刻意不走 change 管線（防止小事也被流程綁架）。要留修復追蹤紀錄的工作（哪怕很小）請改走 `/octopus:spec` 開 change。

執行規則：

1. **先檢查適用性**。若任務涉及以下任一項，停下並告知使用者改走 `/octopus:spec`（Phase 2）或自行評估，不要硬做：
   - DB schema / migration 變更
   - 對外 API 契約變更（request/response 結構、status code）
   - 權限與認證邏輯
   - 跨多模組的行為變更
2. **起跑 run-marker**（適用性通過後、動工前）：把當下 ISO 時間戳寫進目標 repo 的 `.claude/.octopus-arena/.run`（目錄不存在先建立）——守門 hook 只在 marker 有效期間生效；輸出簡版報告前刪除。
3. **在 feature branch 上工作**：開始前確認目前不在主幹直改；若在主幹，先建立 `quick/<簡短描述>` branch。
4. 實作 + 對應測試（行為變更必附測試；純文案/註解修正可免）。
5. 完成後先刪 run-marker，再輸出**簡版報告**（不超過十行）：
   - 改了什麼（file:line）
   - 測試結果（實際執行的指令與輸出摘要，不可只寫「測試通過」）
   - 有沒有順手發現但沒處理的問題（沒有就寫無）
   - 文件影響：這個修改有沒有讓哪份文件過時（沒有就寫無）
6. **不要 commit**——把建議的 commit message 給使用者，merge 與 commit 權在他手上。

任務：$ARGUMENTS
