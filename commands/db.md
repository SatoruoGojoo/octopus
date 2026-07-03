---
description: DB 三方言諮詢（SQL Server / SQLite / PostgreSQL）—— DBA 直答（唯讀，不連 DB）
argument-hint: <schema 設計 / migration / 索引效能問題>
---

使用 Agent 工具啟動 **dba** agent（Octopus 資料庫專家）回答以下問題。

把問題原文與當前工作目錄完整轉給它。提醒事項一併轉達：
- 若問題涉及本專案實際結構，它必須先讀實際 schema/migration 檔再回答
- 若使用者已指定 DB 種類，只答該 DB；未指定則列三方言差異
- 它不連實體資料庫；給出的 SQL/DDL 為建議稿

它回覆後，將其答案完整轉述給使用者，保留來源標註與方言標示。

問題：$ARGUMENTS
