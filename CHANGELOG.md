# 變更紀錄

本檔記錄各版本的行為變更。設計理由見 [Octopus 功能文件](docs/Octopus-功能文件.md)，被砍掉的方案見 [退場紀錄](docs/退場紀錄.md)。

## v0.8.1

- **授權**：加入 MIT LICENSE，`plugin.json`、README 與 hook 檔頭同步標示。
- **修正**：`branch-guard` 補上換行拆段——多行指令原本會被當成單一 segment，`checkout` 的分支追蹤 `continue` 掉整段，導致換行版的「切主幹再 commit」漏擋（`&&` 版本正常）。同時 `OCTOPUS_TPM_OK=1` 改為只認指令開頭，藏進註解或中段不再放行。
- **新增**：`hooks/branch-guard.test.mjs`——21 個案例，兌現設計文件 §6.2「`evaluate()` 可獨立驗證」。專案根 `node --test` 執行。
- **文件**：README 改為公開 repo 慣例結構，新增「已知限制」揭露；版本紀錄獨立為本檔。

## v0.8.0

自我治理：Arena 新增 `metrics.md` 用量追蹤（init/spec/build 收尾追記，append-only、fail-open、agent 無權寫）；Arena 職責收斂；`/octopus:debug` 根因交接規則明確化——修法會不會改變預期行為決定是否進管線；確立版更收尾紀律（設計決定落檔、反向對帳、退場紀錄、三處同步）。

## v0.7.0

**入口減法**：砍掉 `/octopus:quick`（實測從未使用）與 `/octopus:tasks`（規格與 spec 重複）。管線判準由「改動大小」改為 **「spec 要不要變」**——純缺陷修正不進 Octopus，直接在對話處理。Architect 章節重組：tasklist 規格獨立成節，「情境 A/B」並列模式改為「主線＋窄入口」。指令數 11→9。

## v0.6.0

**減法**：砍掉 `auto` 模式、`step` 模式、epic/roadmap、管線內 browser 驗證與規劃輕問。停點收斂為兩個（拍板 OK、驗收 merge），`Locked` 恢復單義（＝TPM 拍板過，無自動鎖定旁路）；設計文件瘦身、設計痕跡移入 `docs/退場紀錄.md`。指令數不變。

## v0.5.0

OpenSpec 換血：spec 格式全面改用 OpenSpec（活文件＋change 生命週期，狀態機遷至 `.openspec.yaml`，merge ≠ archive 原生支援修復追蹤）；Builder 逐 task 隨行回報（每 task 附 code 導讀）；`/octopus:overview` 專案鳥瞰。

## v0.4.0

守門跟著管線走：hook 改由 run-marker（TTL 4h）啟動，日常工作零干預。

## v0.3.0

停點模型 v0.3：拍板收斂成一個 OK，執行段不中途等人；build 入口 Draft 自動鎖定。

## v0.2.0

程式化 hooks 第一批上線：主幹保護（`branch-guard`）＋ spec 狀態機保護（`spec-status-guard`），兩條最貴的紅線從 prompt 紀律升級為程式閘門。

## v0.1.0

諮詢（ask/db）＋輕通道（quick）＋ SDD 交付管線（spec/build/main）＋ debug/review 全部可用。

---

## 尚未實作

- 其餘 hooks 備援（SubagentStart/Stop 檢核、build 入口程式擋）
- session memory 與 `/octopus:recall`
- 模型分級
