---
description: 單獨審查——Reviewer 對指定 branch/變更出四段式驗收報告（可直接貼 PR description）。
argument-hint: <branch 名；留空則審當前工作區變更>
---

用 Agent 工具啟動 **reviewer** agent 執行單獨審查（不掛在 build 管線上）。

轉給它：
- 審查範圍：使用者指定的 branch（對主幹 diff）；未指定則審當前工作區未提交變更
- 若使用者有指明對應 spec，連 spec 路徑一起給；沒有就明說「無對應 spec，跳過對齊段」

它產出四段式驗收報告後完整轉述，**不刪減「高風險變更點」段落**。提醒使用者：報告可直接作為 PR description。

範圍：$ARGUMENTS
