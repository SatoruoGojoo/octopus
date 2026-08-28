# Octopus 🐙

> 一顆頭（你，TPM）＋ 七隻腳（7 個專家 agent）的個人後端工作流 harness。
> Claude Code plugin：你定義意圖、拍板取捨、驗收放行，七隻腳做剩下的事。
> v0.5 起 spec 格式全面採用 [OpenSpec](https://github.com/Fission-AI/OpenSpec)（需安裝其 CLI）。

- 不知道某情境該用哪個指令、術語看不懂？先看 [使用指南](docs/使用指南.md)（情境 → 指令決策地圖＋術語對照表）。
- 想了解設計原理與各腳的邊界？看 [Octopus 功能文件](docs/Octopus-功能文件.md)（權威設計文件）。
- 想知道某個功能為什麼被砍掉？看 [退場紀錄](docs/退場紀錄.md)。

## 安裝

```bash
# 方式一：開發/快速試用（不安裝，僅該次 session 載入）
claude --plugin-dir C:/Users/MX/Project/octopus

# 方式二：正式安裝（在 Claude Code 對話內執行）
/plugin marketplace add C:/Users/MX/Project/octopus
/plugin install octopus@octopus

# 方式三：推上 git 之後，同事安裝（在 Claude Code 對話內執行）
/plugin marketplace add <git 網址或 owner/repo>
/plugin install octopus@octopus
```

- 安裝後在任何專案的 Claude Code 對話以 `/octopus:<指令>` 使用
- 改了插件檔案後，在對話內執行 `/reload-plugins` 重新載入
- 私有 repo 認證走既有 git credential（SSH key / `gh auth login`）

## 指令

### 接機（每個專案跑一次）

| 指令 | 用途 |
|---|---|
| `/octopus:init` | 把既有專案接上 Octopus：檢查 OpenSpec CLI 與結構（缺則引導安裝/初始化）、摸專案概況、盤點 change 狀態（缺的問你補登）、建 Arena＋gitignore、出交接報告 |

### 諮詢通道（唯讀）

| 指令 | 用途 |
|---|---|
| `/octopus:ask <問題>` | 問這個專案的 codebase / git 歷史 / 進度（Scout 唯讀直答，附來源標註） |
| `/octopus:overview [範圍]` | 專案鳥瞰：分層架構＋模組職責＋依賴方向＋關鍵流程走讀（Scout 唯讀、敘事型、不落檔） |
| `/octopus:db <問題>` | DB 諮詢：schema 設計、SQL Server/SQLite/PostgreSQL 方言差異、migration 影響、索引（DBA 唯讀，不連 DB） |
| `/octopus:debug <錯誤>` | 根因分析：症狀 → 定位 → 根因 → 為什麼以前沒炸 → 修法選項 |
| `/octopus:review [branch]` | 單獨審查：7 級嚴重度 + 高風險變更點，產可直接貼 PR 的驗收報告 |

另可直接請主對話啟動 **analyst** agent 做需求拆解（貼文字或截圖都行）：它會反問釐清、嗆你的需求（魔鬼代言人），產出結構化需求分析。

### SDD 交付管線

設計原則：**拍板一個 OK，之後全自主、不中途等人**。整條管線**只有兩個停點**——拍板 OK 與驗收 merge，沒有第三個，也沒有跳過任一個的模式。

| 指令 | 用途 |
|---|---|
| `/octopus:spec <需求>` | 討論段：釐清＋挑戰 → **OpenSpec change 一次落檔**（proposal＋spec delta＋tasks，Draft）→ 你看完整包回 OK →【拍板停點】鎖定。**可以停在這**，改天再 build |
| `/octopus:build <change>` | 執行段（**全自主**）：驗 `Locked`（Draft 會停下請你拍板；Implemented/已歸檔拒絕）→ Builder **逐 task** 照 tasks 實作＋測試（**每條 task 即時回報**：做了什麼／code 導讀／自主決定）→ 審查 → **P1 自動退修（上限 3 輪）** → 帶驗收報告回來 →【唯一硬停點】你 merge → tasks 全完成則（經你點頭）`openspec archive` 結案 |
| `/octopus:main <需求>` | 兩段連跑：一個 OK 拍板後全自主直達驗收報告 |

**進不進管線看「spec 要不要變」，不是改動大小**：純缺陷修正（code 沒做到 spec 本來就寫的事）修完 spec 一個字不用改，沒有 delta 可寫——直接在對話中處理，不進 Octopus。預期行為要變、或發現該行為從未被寫進主 spec，才開 change。代價：管線外沒有 run-marker，兩支 hook 都不生效。

執行段**不中途等人、但看得到進度**：Builder 每完成一條 task 即時回報（單向呈現，不等你回覆——這也是你隨行理解每條 task 對應 code 的機制）；高風險決策取保守預設＋決策卡留痕、P1 三輪修不乾淨直接收尾標紅、spec 矛盾標註後繼續——全部集中呈報在驗收報告開頭的「執行中自動拍板清單」，你不 merge 即否決（branch 上一切可逆）。看到方向不對隨時可以插話打斷。

change 狀態（Draft/Locked/Implemented）記在該 change 的 `.openspec.yaml`（`octopus.status`），只由 command 確定性改寫——agent 無權動狀態。**`Locked` 只有一個意思：你拍板過了**（沒有自動鎖定的旁路）。**merge ≠ 結案**：merge 決定 code 進主幹，`openspec archive` 才結案（delta 合回主 spec）；tasks 沒做完（如舊資料待補）可以先 merge、change 留開追蹤修復狀態。

## 使用須知

- **merge 權在你手上**：所有實作都在 feature branch，Octopus 不 commit 主幹、不 merge。
- **需要 OpenSpec CLI（v0.5 起）**：spec/build/init 管線依賴 `openspec` CLI（validate/archive 等確定性動作）；缺的話管線入口會停下引導你安裝（安裝指令見官方 README：github.com/Fission-AI/OpenSpec）。目標 repo 沒有 `openspec/` 結構時，請自行跑一次 `openspec init`（互動式）。
- **程式化守門（v0.2 起，不只靠自律；v0.4 起只在管線執行中生效）**：plugin 內建兩個 PreToolUse hook——`branch-guard`（擋主幹 commit/push、`git merge`、force push）與 `spec-status-guard`（change 的 `octopus.status` 只准單步順向 Draft→Locked→Implemented，禁回退/跳關，守 `.openspec.yaml`）。**守門跟著管線走**：管線 command 起跑寫入 `.claude/.octopus-arena/.run`、收尾刪除，hook 只在 marker 有效（TTL 4 小時）時攔截——日常叫 Claude 做的 git 操作零干預。執行中的例外同意＝請 Claude 在指令前加 `OCTOPUS_TPM_OK=1 `（寫在指令裡＝留痕可稽核）；狀態修復請自己動手改檔。裝好後可用 `/hooks` 確認已註冊。
- **誠實原則**：所有回答標註來源等級（權威檔案 / code 推導 / 文件示意 / 查無）；查無不杜撰。
- **Arena 知識庫**：spec/build 管線會在目標 repo 的 `.claude/.octopus-arena/decisions.md` 追記拍板決策，**預設請加進該 repo 的 `.gitignore`**（每人私有）；想升級成團隊共享再移除該行。
- 本插件不連線任何資料庫、不需要任何憑證。

## 給同事：第一次用建議

1. 裝好後在你的專案先跑 `/octopus:init`——它會檢查 OpenSpec 環境、盤點專案與 change 狀態，告訴你下一步
2. 試 `/octopus:ask 這個專案的進入點在哪、分幾層？`
3. 再試 `/octopus:db` 問一個你正在煩惱的 schema 問題（記得說你用哪種 DB）
4. 需求很模糊的時候，把客戶訊息直接貼給 analyst，讓它先嗆你三個問題

## 授權

GPL-3.0-or-later（全文見 [`LICENSE`](LICENSE)）。

你可以自由使用、修改、散布這個 plugin，包含商業用途。條件是：**散布修改後的版本時必須同樣以 GPL-3.0 開源**，並保留原始著作權聲明。

只在自己或公司內部使用、不對外散布，GPL 不產生任何額外義務。

## 版本

v0.7.0 — **入口減法**：砍掉 `/octopus:quick`（實測從未使用）與 `/octopus:tasks`（規格與 spec 重複）。管線判準由「改動大小」改為 **「spec 要不要變」**——純缺陷修正不進 Octopus，直接在對話處理。Architect 章節重組：tasklist 規格獨立成節，「情境 A/B」並列模式改為「主線＋窄入口」。指令數 11→9。
v0.6.0 — **減法**：砍掉 `auto` 模式、`step` 模式、epic/roadmap、管線內 browser 驗證與規劃輕問。停點收斂為兩個（拍板 OK、驗收 merge），`Locked` 恢復單義（＝TPM 拍板過，無自動鎖定旁路）；設計文件瘦身、設計痕跡移入 `docs/退場紀錄.md`。指令數不變。
v0.5.0 — OpenSpec 換血：spec 格式全面改用 OpenSpec（活文件＋change 生命週期，狀態機遷至 `.openspec.yaml`，merge ≠ archive 原生支援修復追蹤）；Builder 逐 task 隨行回報（每 task 附 code 導讀）；`/octopus:overview` 專案鳥瞰。
v0.4.0 — 守門跟著管線走：hook 改由 run-marker（TTL 4h）啟動，日常工作零干預。
v0.3.0 — 停點模型 v0.3：拍板收斂成一個 OK，執行段不中途等人；build 入口 Draft 自動鎖定。
v0.2.0 — 程式化 hooks 第一批上線：主幹保護（branch-guard）＋ spec 狀態機保護（spec-status-guard），兩條最貴的紅線從 prompt 紀律升級為程式閘門。
v0.1.0 — 諮詢（ask/db）＋輕通道（quick）＋ SDD 交付管線（spec/build/main）＋ debug/review 全部可用。
尚未實作：其餘 hooks 備援（SubagentStart/Stop 檢核、build 入口程式擋）、session memory 與 `/octopus:recall`、模型分級。
