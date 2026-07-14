---
spec: NNN-short-slug
title: <能力名稱>
status: Draft   # Draft → Locked → Implemented（由 command 確定性流轉；手動拍板或 build 入口自動鎖定）
depends_on: []  # 相依的其他 spec
---

# NNN：<能力名稱>

> Octopus 內建預設範本。目標 repo 若有自己的 spec 範本（如 `specs/_TEMPLATE.md`），優先用 repo 的。

## 目標與動機

<這個能力解決什麼問題、為什麼需要它（背景脈絡）。一~三句——這段是日後回答「為什麼有這個功能」的依據，不要省。>

## 範圍

- **In**：
- **Out**：（明示不做什麼）

## 行為規格（EARS）

<!-- 句式：
  普遍   THE SYSTEM SHALL ...
  事件   WHEN <事件> THE SYSTEM SHALL ...
  狀態   WHILE <狀態> THE SYSTEM SHALL ...
  條件   IF <條件> THEN THE SYSTEM SHALL ...
  非期望 IF <非期望情況> THEN THE SYSTEM SHALL ...
-->

1. WHEN … THE SYSTEM SHALL …
2. IF … THEN THE SYSTEM SHALL …

## 驗收標準（每條可測，對應上方行為編號）

- [ ] AC1（對應 #1）：…
- [ ] AC2（對應 #2）：…

## 資料契約（示意）

> 僅示意。實際欄位/索引/SQL 以實作後的 code 與 schema 檔為真實來源。

## 相關 API

> 實作完成後由 build 收尾補上——這份表讓 spec 兼任業務故事：查「這個功能對應哪支 API」從這裡進。

| API | 說明 |
|---|---|

## 已拍板決策

| 決策 | 結論 | 日期 |
|---|---|---|

## Open Questions

- …
