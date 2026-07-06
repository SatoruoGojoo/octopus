# Octopus 🐙

> 一顆頭（你，TPM）＋ 八隻腳（8 個專家 agent）的個人後端工作流 harness。
> Claude Code plugin：你定義意圖、拍板取捨、驗收放行，八隻腳做剩下的事。

- 不知道某情境該用哪個指令、術語看不懂？先看 [使用指南](docs/使用指南.md)（情境 → 指令決策地圖＋術語對照表）。
- 想了解設計原理與各腳的邊界？看 [Octopus 功能文件](docs/Octopus-功能文件.md)（權威設計文件）。

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
| `/octopus:init` | 把既有專案接上 Octopus：摸專案概況、盤點 spec 狀態欄位（缺的問你補登）、建 Arena＋gitignore、出交接報告（告訴你哪些 spec 已可直接 build） |

### 諮詢與輕通道

| 指令 | 用途 |
|---|---|
| `/octopus:ask <問題>` | 問這個專案的 codebase / git 歷史 / 進度（Scout 唯讀直答，附來源標註） |
| `/octopus:db <問題>` | DB 諮詢：schema 設計、SQL Server/SQLite/PostgreSQL 方言差異、migration 影響、索引（DBA 唯讀，不連 DB） |
| `/octopus:quick <任務>` | 小修小補輕通道：單檔可定位、不碰 schema/契約/權限的修改，直接做完出簡版報告（在 feature branch 上） |
| `/octopus:debug <錯誤>` | 根因分析：症狀 → 定位 → 根因 → 為什麼以前沒炸 → 修法選項 |
| `/octopus:review [branch]` | 單獨審查：7 級嚴重度 + 高風險變更點，產可直接貼 PR 的驗收報告 |

另可直接請主對話啟動 **analyst** agent 做需求拆解（貼文字或截圖都行）：它會反問釐清、嗆你的需求（魔鬼代言人），產出結構化需求分析。

### SDD 交付管線

設計原則：**討論集中在前段、拍板一次，之後全自主**。整條管線只有兩個硬停點——

| 指令 | 用途 |
|---|---|
| `/octopus:spec <需求>` | 討論段：釐清＋挑戰 → **EARS spec＋tasklist 一次落檔**（Draft）→ 你看完整包拍板 →【硬停點一】鎖定。**可以停在這**，改天再 build |
| `/octopus:build <spec>` | 執行段（**全自主**）：入口驗狀態（非 Locked 直接拒絕）→ 照 tasks 在 feature branch 實作＋測試 → 審查 → **P1 自動退修到乾淨（上限 3 輪）** → 帶驗收報告回來 →【硬停點二】你 merge → Implemented |
| `/octopus:main <需求>` | 兩段連跑：鎖定停一次，之後自主跑到驗收報告 |
| `/octopus:tasks <spec 或需求>` | 單獨產 tasklist：給 spec 就展開；給需求文字就先輕量釐清再拆（標明非正式）。不實作 |

執行段**例外才停**（事件觸發）：高風險決策（migration/權限/對外契約/不可逆且 spec 未涵蓋）、P1 三輪修不乾淨、實作中發現 spec 矛盾。想逐步盯流程？指令加 `step`。

spec 狀態（Draft/Locked/Implemented）記在 spec 檔 frontmatter，只由 command 在你明確確認後改寫——agent 無權動狀態。

## 使用須知

- **merge 權在你手上**：所有實作都在 feature branch，Octopus 不 commit 主幹、不 merge。
- **程式化守門（v0.2 起，不只靠自律）**：plugin 內建兩個 PreToolUse hook——`branch-guard`（擋主幹 commit/push、`git merge`、force push）與 `spec-status-guard`（spec `status` 只准單步順向 Draft→Locked→Implemented，禁回退/跳關）。你明確同意的例外＝請 Claude 在指令前加 `OCTOPUS_TPM_OK=1 `（寫在指令裡＝留痕可稽核）；spec 狀態修復請自己動手改檔。裝好後可用 `/hooks` 確認已註冊。
- **誠實原則**：所有回答標註來源等級（權威檔案 / code 推導 / 文件示意 / 查無）；查無不杜撰。
- **Arena 知識庫**：spec/build 管線會在目標 repo 的 `.claude/.octopus-arena/decisions.md` 追記拍板決策，**預設請加進該 repo 的 `.gitignore`**（每人私有）；想升級成團隊共享再移除該行。
- 本插件不連線任何資料庫、不需要任何憑證。

## 給同事：第一次用建議

1. 裝好後在你的專案先跑 `/octopus:init`——它會盤點專案與 spec 狀態，告訴你下一步
2. 試 `/octopus:ask 這個專案的進入點在哪、分幾層？`
3. 再試 `/octopus:db` 問一個你正在煩惱的 schema 問題（記得說你用哪種 DB）
4. 需求很模糊的時候，把客戶訊息直接貼給 analyst，讓它先嗆你三個問題

## 版本

v0.2.0 — 程式化 hooks 第一批上線：主幹保護（branch-guard）＋ spec 狀態機保護（spec-status-guard），兩條最貴的紅線從 prompt 紀律升級為程式閘門。
v0.1.0 — 諮詢（ask/db）＋輕通道（quick）＋ SDD 交付管線（spec/build/main）＋ debug/review 全部可用。
尚未實作：其餘 hooks 備援（SubagentStart/Stop 檢核、build 入口程式擋）、session memory 與 `/octopus:recall`、模型分級。
