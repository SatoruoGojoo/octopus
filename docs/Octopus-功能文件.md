# Octopus 功能文件

> **版本**：v0.1 Draft
> **形式**：Claude Code plugin
> **本檔定位**：Octopus 的權威設計文件。實作（agents/、commands/）一律從本檔推導；實作與本檔衝突時，回到本檔修訂後再改實作。

---

## 1. 概述與定位

### 1.1 命名由來

**一顆頭，八隻腳。** 頭是你——TPM（Technical Project Manager）；八隻腳是八個專家 agent，各管一個領域，聽頭的指揮。

### 1.2 Octopus 是什麼

Octopus 是**個人後端工作流 harness**：給單一後端工程師使用的 Claude Code 插件，把日常工作的兩種型態都接起來——

- **諮詢**：問需求怎麼拆、DB schema 怎麼設計、這個專案的 code 為什麼長這樣
- **交付**：從模糊需求走到可合併的 code，中間經過 spec 鎖定與審查（SDD 流程）

它**不是**團隊協作平台。部署對象是「每個後端工程師各自安裝、各自使用」，沒有共用狀態（見 §6.1 Arena 私有預設）。

### 1.3 核心世界觀：你是 TPM

當 agent 把實作、審查、除錯都吃掉之後，使用者身上不可替代的工作剩下三件：

1. **定義意圖**——要做什麼、為什麼做、做到什麼程度算好
2. **拍板取捨**——方案 A 還是 B、這個風險收不收、範圍砍不砍
3. **驗收放行**——這個產出能不能 merge

這三件事就是 TPM 的工作。所以 Octopus 的設計公理是：

> **Harness 的品質不取決於 agent 數量，取決於三個 TPM 介面的品質**：需求進口、決策呈現、驗收出口（§4）。三個介面任一做爛，八隻腳會非常高效地做出你沒有要的東西。

### 1.4 定位演進軌跡（決策紀錄）

本設計經多次收斂，記錄如下以免重蹈：

| 版本 | 定位 | 出場原因 |
|---|---|---|
| v0 | PM/FE/BE 多角色協作中樞（13~17 agent） | PM/FE 是不存在的使用者——服務的角色根本沒有人 |
| v0.x | 唯讀諮詢 → 完整 SDD 引擎 → 個人全棧+UI/UX 設計官（12 agent） | 範圍反覆膨脹；最終認清真實需求是**優化個人後端工作流** |
| **v1（本檔）** | **個人後端工作流，8 agent 精實編制** | — |

出場方案的設計細節存檔於附錄（§10），未來若擴編（多人/全棧）可取用。

---

## 2. 編制原則：為什麼是 8 個

編制判準：**agent 數量不跟功能數走，跟「問責邊界」數量走。** 每個 agent 的存在理由是「守一條失守代價夠大的邊界」。多 agent 工作流常見的失敗模式是模擬一整個產品團隊的組織（PM、用戶代表、SA、QA、戰略顧問各派一個）——solo 情境下這些利害關係人不存在或就是你自己，對應的 agent 是在服務不存在的人。反之，**挑戰你的 agent 增值**（solo 的需求沒人嗆）、**模擬你的 agent 砍掉**（你就是 PM）。

### 2.1 八隻腳各守的邊界

| Agent | 守的邊界 | 失守的代價 |
|---|---|---|
| Scout | 「事實 vs 印象」——專案知識必須查證 | 憑印象回答，決策建立在過時資訊上 |
| Analyst | 「需求進口」——模糊需求不得進管線 | garbage in，整個工程部高效產出 garbage |
| Architect | 「先想再做」——spec 與取捨先於 code | 邊做邊想，返工與範圍漂移 |
| DBA | 「資料層不可輕率」——schema 錯誤最難回滾 | migration 災難、效能債 |
| Builder | 「實作不碰主幹」——一律 feature branch | 失去 TPM 合併權 |
| Reviewer | 「驗收出口」——solo 最缺的第二雙眼睛 | 沒人抓你的盲點，問題進 production |
| Debugger | 「根因 vs 症狀」——不只修哪行炸 | 同一類 bug 反覆出現 |
| Examiner | 「理解 vs 盲簽」——動到程式邏輯的變更，定案前 TPM 要講得出功能行為 | 盲簽 merge，長期喪失對自己 codebase 的掌握（理解債） |
| （Core） | 路由——確定性，屬頭不佔腳 | — |

> 「八隻腳」＝上列 8 個 agent persona；Core 是編排（commands＋主對話），屬於頭的延伸，不佔腳、不設 agent 檔（§3.0）。

### 2.2 刻意不設的角色（與理由）

| 不設 | 理由 |
|---|---|
| 需求審查委員會（多個審查 agent） | 多重審查在團隊叫制衡，在個人工作流叫官僚——對抗式挑戰縮成 Analyst 的魔鬼代言人模式即可 |
| 獨立 SA 架構審查 | tech spec 之上再一層獨立架構審查是疊床架屋，併入 Reviewer |
| 獨立測試計畫 agent | 測試跟著實作走（Builder 職責），獨立角色多餘 |
| 用戶代表 | 服務的對象不存在——你的使用者就是你自己或你直接面對的人 |
| 外部研究 agent | 偶爾用，臨時請主對話查即可，不常編 |
| 戰略規劃 agent | 產品層級規劃，個人工作流用不到 |
| 治理/狀態流轉 agent | spec 狀態流轉是確定性動作，command + hooks 就能做（code 能答的不用模型） |

### 2.3 設計支柱（不縮的部分）

- **quick/main 雙通道**（§5）：小事不過管線，防流程形式主義
- **Arena 知識庫**（§6.1）：拍板決策跨 session 沉澱
- **hooks 紀律**（§6.2）：流程閘門用程式強制，不靠 agent 自覺
- **session memory**（Phase 3）

---

## 3. Agent 能力規格（八隻腳）

所有 agent 共用的紅線見 §6.4 誠實原則。

### 3.0 Core（編排——不是獨立 agent 檔）

路由與管線編排由 **commands + 主對話**承擔：明確 command（`/octopus:db` 等）直達對應 agent，零分類成本；只有自由提問需要意圖判斷。Core 不持有領域知識，不出現在 `agents/` 目錄。

### 3.1 Scout（考古官）

| | |
|---|---|
| 職責 | codebase 架構/慣例/依賴、git 演進（誰改的、為什麼、何時）、專案與 spec 進度狀態 |
| 輸入 | 自然語言提問 |
| 輸出 | 帶來源標註的答案（`file:line`、commit hash、spec 路徑） |
| 工具邊界 | 唯讀（Read/Grep/Glob/git log 類） |
| 紅線 | 查無必須明說；不憑記憶回答可以查證的事 |

### 3.2 Analyst（需求分析官）

| | |
|---|---|
| 職責 | 把現實面問題（客戶訊息、ticket、模糊想法）拆解成技術問題＋假設＋風險；context 不足時反問；需求進管線前做魔鬼代言人挑戰 |
| 輸入 | 任何形式——文字、截圖（ticket/對話/手繪）、改寫過的轉述。**不揣測需求來源、不切換模式**：你怎麼餵都行，它收到什麼就釐清什麼 |
| 輸出 | 結構化需求（目標/範圍 In-Out/技術問題清單/假設/Open Questions）；Open Questions 要不要轉給 PM 是你的事 |
| 工具邊界 | 唯讀（可請 Scout 補 codebase 脈絡） |

**反問行為規格**：
- 觸發條件（任一成立即反問）：① 關鍵名詞歧義（「即時」「優化」「更好」未量化）② 缺驗收標準（說不出做到什麼程度算完成）③ 影響範圍不明（碰不碰既有資料/介面）④ 與已知架構或慣例可能衝突
- 一次最多 **3 個問題**，按對答案影響度排序；能列選項就用選項式
- 最多 **兩輪**；兩輪後仍有缺口 → 給出「帶假設的初步判斷」並把未決點列入 Open Questions，不無限追問

**魔鬼代言人挑戰清單**（需求進 `/octopus:spec` 管線前執行）：
- 驗收標準可測嗎？「體驗變好」這種句子直接打回
- 範圍比上次陳述膨脹了嗎？膨脹的部分是必要還是順手？
- 有更便宜的方案嗎？（改設定 vs 改 code、查詢 vs 新欄位）
- 這個需求跟既有行為衝突嗎？

### 3.3 Architect（規格官）

| | |
|---|---|
| 職責 | 把 Analyst 的結構化需求寫成 EARS tech spec（含可測驗收標準、In/Out、相依）；方案有取捨時產出決策卡（§4.2）給 TPM 拍板；功能拆解成 tasks |
| 輸入 | Analyst 的結構化需求（或 TPM 直接給的明確需求） |
| 輸出 | spec 檔（落檔 `specs/`，格式見 §5 SDD 整合）、決策卡、tasks 清單（含相依順序與驗收條件） |
| 紅線 | spec 必含可測驗收標準；驗收標準寫不出來＝需求沒釐清，退回 Analyst |

### 3.4 DBA（資料庫專家）

| | |
|---|---|
| 職責 | 關聯式 DB 諮詢，專精 **SQL Server / SQLite / PostgreSQL** |
| 輸入 | schema 設計問題、migration 評估、效能問題 |
| 輸出 | 帶方言對照的建議（指定 DB 則只給該 DB，未指定則三方言並列差異） |
| 工具邊界 | **只讀 schema / migration 檔，不連實體 DB**（避免連線憑證管理與誤觸資料；以實際 code/schema 檔為真實來源） |

**能力矩陣**：

| 類別 | 範例問題 | 知識來源 |
|---|---|---|
| Schema 設計 | 「一人一獎一票怎麼用約束保證？」 | 訓練知識 + 實際 schema 檔 |
| 方言差異 | 「SQLite 沒有原生 BOOLEAN/UUID，PG 有，SQL Server 用 BIT/UNIQUEIDENTIFIER，怎麼對齊？」 | 訓練知識（**最高 ROI 能力**，零外部依賴） |
| Migration 影響 | 「這個 ALTER 在現有資料量會鎖表嗎？PG 和 SQL Server 行為差在哪？」 | migration 檔 + 訓練知識 |
| 索引/效能 | 「這個統計查詢該建什麼複合索引？」 | schema 檔 + 訓練知識 |

### 3.5 Builder（實作官）

| | |
|---|---|
| 職責 | 從確認過的 spec（或 quick 任務）實作 code＋測試 |
| 輸入 | Locked spec + tasks（main/build 管線），或直接的小修描述（quick） |
| 輸出 | feature branch 上的 commits + 測試 + 給 Reviewer 的變更摘要 |
| 紅線 | **一律在 feature branch 工作，絕不直接改主幹**（TPM 合併權的執行機制）；測試跟著實作走，不可宣稱完成而無測試（除非 spec 明示免測並有理由） |

### 3.6 Reviewer（審查官）

| | |
|---|---|
| 職責 | 7 級嚴重度 review（Correct/Safe/Clear/Minimal/Consistent/Resilient/Performant）+ 風險資安掃描 + 需求對齊驗證（實作 vs spec 驗收標準逐條比對）。**鐵律：碰到任何 API 實作（哪怕一行）必查多步寫入有無交易保護，缺少列高風險＋評級** |
| 輸入 | Builder 的 branch diff + 對應 spec |
| 輸出 | **TPM 驗收報告**（格式見 §4.3），設計成可直接當 PR description——公司有真人 code review 時，Octopus 是丟 PR 前的前置審查 |

### 3.7 Debugger（除錯官）

| | |
|---|---|
| 職責 | 錯誤定位、根因分析（不只找到哪行炸，要回答為什麼炸、為什麼以前沒炸） |
| 輸入 | 錯誤訊息/log/重現步驟 |
| 輸出 | 根因報告（症狀→定位過程→根因→修法選項；修法有取捨時用決策卡） |
| 紅線 | 區分「確認的根因」與「推測」，不得把推測寫成結論 |

### 3.8 Examiner（考官）

| | |
|---|---|
| 職責 | merge 前的**認知債對齊**：檢核對象是「TPM 的認知 ↔ 成品現況」——spec↔code 的對齊是 Reviewer 的事，考官在 Reviewer 之後出場，以審查通過的現況為答案依據。依 diff＋spec 出 2~4 題功能理解題（改動後的行為、設計取捨、失效模式），**優先取材 spec 未釘死、Builder 自主決定的點**（那是 TPM 唯一沒在場的決策現場，認知債只長在那裡）；答錯或答不出就講解現況並引 code（file:line）。**教學型，不是閘門** |
| 觸發 | 僅 build 管線、變更**動到程式碼層面的邏輯**才觸發；純文案/註解/格式/設定調整跳過。quick 不觸發——意圖與變更之間沒有自主距離，且判準已排除高風險，沒有落差可抓。附著在硬停點二，不新增硬停點 |
| 輸入 | branch diff（唯讀 git 指令）＋對應 spec（如有）＋驗收報告（如有） |
| 輸出 | 考題（逐題問答，多輪經 SendMessage 往返）＋理解檢核摘要（每題一行判定，附在驗收報告後）。若對齊中 TPM 表示「這個自主決定不是我要的」，如實記入摘要——裁量在 TPM 的驗收停點，不經考官判斷 |
| 紅線 | **不考檔名、路徑、函式名等實作瑣事——考的是功能理解，不是記憶力**；不論答題結果 merge 權在 TPM，不得建議「不准 merge」；只讀不改；每題答案須有依據（diff/spec/code 推導），不杜撰 |

---

## 4. TPM 三介面規格

### 4.1 需求進口（Analyst）

行為規格見 §3.2。介面承諾：**你餵什麼都行，但走進交付管線的需求一定是被嗆過的。**

### 4.2 決策呈現：決策卡

所有要 TPM 拍板的點（方案選擇、風險接受、範圍取捨）一律用決策卡，**一屏內**，不丟千字分析：

```markdown
## 決策卡：<一句話說清楚要決定什麼>

| 選項 | 做法 | 代價 | 何時會後悔 |
|---|---|---|---|
| A（建議） | … | … | … |
| B | … | … | … |

**建議 A，因為**：<一~兩句>
**不可逆性**：<可隨時改 / 改要付遷移成本 / 基本不可逆>
```

### 4.3 驗收出口：驗收報告（Reviewer）

驗收模式＝**報告放行為主，高風險變更點親掃**。報告必含四段，5 分鐘內可判斷：

```markdown
## 驗收報告：<spec 編號與標題 / quick 任務>

### 做了什麼
<對應驗收標準逐條：✅ 通過（證據 file:line）/ ⚠️ 部分 / ❌ 未做>

### 沒做什麼
<明示排除或未完成的部分與原因——不可留白，沒有就寫「無」>

### 高風險變更點（建議親掃 diff）
<凡涉及：DB migration / 交易邊界 / 權限與認證 / 金流 / 對外介面變更，
 一律列出 file:line 與一句話風險說明>

### Review 發現
<7 級嚴重度分組，只列 P1/P2 詳情，P3 以下計數即可>
```

---

## 5. Commands 與管線

### 5.1 Command 總表

| Command | 用途 | 路由 |
|---|---|---|
| `/octopus:init` | 既有專案接機（一次性）：摸專案、盤點 spec 狀態欄位（缺漏經 TPM 確認後補登）、建 Arena＋gitignore、交接報告 | Scout＋確定性檢查 |
| `/octopus:ask` | codebase/git/進度問答 | Scout 直答 |
| `/octopus:db` | DB 三方言諮詢 | DBA 直答 |
| `/octopus:quick` | 小修小補：不啟動管線、不寫 spec | Builder 直做（仍出簡版報告） |
| `/octopus:spec` | SDD 討論段（可獨立停住） | Analyst → Architect → spec＋tasks 落檔 →【鎖定】 |
| `/octopus:build <spec>` | SDD 執行段（**全自主**，入口驗 Locked） | 讀 tasks → Builder → Reviewer → P1 自動修（≤3 輪）→【merge】 |
| `/octopus:main` | spec + build 連跑（鎖定停一次，其後自主） | 上兩段串接，零重複邏輯 |
| `/octopus:tasks` | 單獨產 tasklist（spec 或需求文字皆可；不實作） | Architect（情境 B）；無 spec 時 Analyst 輕量釐清先行 |
| `/octopus:debug` | 根因分析 | Debugger |
| `/octopus:review` | 單獨審查（不限管線產出） | Reviewer |
| `/octopus:recall` | session 恢復 | Phase 3 |

### 5.2 SDD 交付管線

設計原則：**討論集中在前段、拍板一次，之後全自主執行**。TPM 的決策工作在鎖定點結束；執行段跑回來的是「驗證過的成品＋驗收報告」，不是一連串確認請求。

```
── 討論段（/octopus:spec）─────────────────────────
模糊需求
  → Analyst：反問釐清（≤3 問 ×≤2 輪）＋魔鬼代言人挑戰
  → Architect：EARS spec ＋ tasklist ＋（如有取捨）決策卡——一次產齊
  → 落檔 specs/NNN-*/spec.md + tasks.md，標 Draft
  →【硬停點一：TPM 看完整包拍板】→ command 確定性改標 Locked
── 執行段（/octopus:build，全自主）─────────────────
  → 入口閘門：非 Locked 直接拒絕
  → Builder：照 tasks 在 feature branch 實作＋測試
  → Reviewer：驗收報告
  → 有 P1？→ 自動退回 Builder 修 → 重審（迴圈，上限 3 輪）
  → Examiner：理解檢核（動到程式邏輯才觸發，逐題問答＋講解）
  →【硬停點二：TPM 驗收 → merge】→ command 改標 Implemented
```

**為什麼 spec/build 拆兩段而不是 main 一條龍**：spec 與實作經常不在同一天（等確認、排隊、跨週）。spec 必須是**可暫停、可累積、可回頭對賬的獨立交付物**——只活在對話裡的 spec 不是 SDD，是「動手前有先想」。`/octopus:main` 只是連跑糖衣。

**停點規則**：
- **硬停點只有兩個**：① spec 鎖定（決定做什麼）② 驗收 merge（決定什麼進主幹）——TPM 權力核心，任何模式都要人類明確回答
- **執行段例外停點（事件觸發，非排程確認）**：高風險決策（spec 未涵蓋且涉及 migration / 權限認證 / 對外契約 / 不可逆）、P1 三輪修不乾淨、實作中發現 spec 矛盾
- **step 模式（可選）**：command 輸入含 `step` 時改為逐步確認——給想盯流程的場合；預設是自主模式
- **理解檢核不是新停點**：Examiner 的問答附著在硬停點二之內（反正 TPM 本來就要停下來驗收），答錯採講解不擋 merge，因此不改變「硬停點只有兩個」的不變量

### 5.3 SDD 整合細節

- spec 狀態 `Draft / Locked / Implemented` 記於 spec 檔 frontmatter；**狀態流轉由 command 確定性寫入**（TPM 說鎖才鎖），不經 agent 判斷
- **spec 範本跟著目標 repo 走**：Octopus 內建預設 EARS 範本（`templates/spec-template.md`）；若目標 repo 已有自己的範本（如 `specs/_TEMPLATE.md`），優先用 repo 的——配合既有 SDD 專案慣例，不強加格式
- `/octopus:quick` 明確**不寫 spec**——防 spec 形式主義；判準：單檔可定位、不碰 schema/契約/權限的修改
- **完工文件同步（build 收尾，不另設停點）**：merge 後補 spec 的「相關 API」表（spec 兼任業務故事——記「為什麼有這個功能」與「對應哪支 API」），並列出本次變更使哪些既有文件過時的建議更新清單
- spec 範本含「目標與動機」段：記錄為什麼需要這個功能，EARS 行為規格之外保留業務脈絡

---

## 6. 基建

### 6.1 Arena 知識庫（預設私有）

- 位置：目標 repo 的 `.claude/.octopus-arena/`，分片 markdown（`architecture.md` / `conventions.md` / `decisions.md` / `glossary.md`）
- 原則：**只沉澱「拍板過的決策與 Open Questions」，不沉澱可從 code 推導的事實**（那些每次即時掃描，永不過時）
- **預設加入目標 repo 的 `.gitignore`**：同事在同一公司 repo 各自用 Octopus 時，Arena 寫進 git 會默默變成共用狀態，違反「各自使用」的部署前提。想升級成團隊共享知識庫時，拿掉 gitignore 那行即可（屆時需要有人負責清理髒資料）

### 6.2 流程閘門

**v0.1 實作方式：閘門寫在 command 的確定性步驟裡**（build 入口先 Read spec frontmatter，非 `Locked` 直接拒絕；Builder agent 自己再驗一次＝雙重檢查；狀態流轉只由 command 在 TPM 明確確認後 Edit）。

**v0.2 程式化 hooks 備援（第一批，已實作）**：plugin 附帶 PreToolUse hooks（`hooks/hooks.json`），防 agent 被說服繞過 prompt 層閘門。挑選標準＝「失守代價最大的兩條紅線」。工程慣例：純 node、零相依、**fail-open**（hook 自身故障一律放行，不卡流程）、判斷邏輯以 `evaluate()` export 可獨立驗證、擋下訊息 zh-TW 並附解法。

**熱路徑成本（hook 是 user-scope，每個專案的每次工具呼叫都會跑）**：hook 必須先用純字串判斷確認「這次呼叫可能踩到不變量」，才做任何昂貴動作（spawn 子行程、讀檔）。`branch-guard` 由此定下不變量：**指令不含 `git` 時直接 exit 0，不查分支**——`evaluate()` 對這類指令本來就恆回傳 `null`，查了也用不到。子行程只為真正需要 `branch` 的規則（主幹上的 `git commit`、裸 `git push`）而開。

| Hook | 攔截 | 守的不變量 | 例外（留痕） |
|---|---|---|---|
| `hooks/branch-guard.mjs` | PreToolUse(Bash) | **主幹保護**：擋「在 main/master 上 `git commit` / `git push`」「push 到 main/master」「`git merge`（`--abort`/`--quit` 善後除外）」「任何 force push」；同一指令串內 `checkout`/`switch` 換到主幹也會被追蹤 | TPM 明確同意時指示在指令前加 `OCTOPUS_TPM_OK=1 `——例外寫在指令裡＝可稽核 |
| `hooks/spec-status-guard.mjs` | PreToolUse(Edit\|Write) | **spec 狀態機**：`status` 只能單步順向 `Draft → Locked → Implemented`，禁回退、禁跳關、禁刪除或憑空插入 status 行；新 spec 只能生為 `Draft` | 回退/修復由 TPM 親手改檔（hook 只攔 Claude 的工具呼叫） |

界線：hook 守**確定性不變量**（程式能判定的）；「TPM 拍板才鎖」的時序仍由 command 流程負責——hook 無從得知對話中誰點了頭，這條界線是刻意的，不要試圖用 hook 驗語意。

**Phase 3 其餘備援（未做）**：

| 時機 | 驗什麼 |
|---|---|
| SubagentStart | Builder 動工前必有 tasks/TODO 清單 |
| SubagentStop | Reviewer 報告必含「高風險變更點」段落；Builder 產出必在 feature branch 上 |
| build 入口 | spec frontmatter 非 `Locked` → 程式直接擋下（現由 command 步驟＋Builder 雙重檢查） |

### 6.3 寫入隔離：feature branch

每個交付任務（main/build/quick 涉及改 code 者）開 feature branch；**merge 權永遠在 TPM 手上**。

### 6.4 誠實原則（全 agent 共用紅線）

回答依據分四級，**必須標註等級**：

1. **權威**：契約檔（OpenAPI）/ schema、migration 檔 / spec（Locked）
2. **code 推導**：從實作 code 讀出來的——標註「推導非權威，code 改了即失效」
3. **文件示意**：docs 裡的描述——標註「以實際 code 為準」
4. **查無**：明說「查無依據」，**絕不杜撰**。可列名稱相近的候選供確認

spec 與 code 衝突 → 兩邊攤開、標明差異，不擅自二選一。

---

## 7. 驗收標準（EARS）

**Analyst**
- WHEN 需求含未量化的關鍵名詞或缺驗收標準，Analyst SHALL 反問而非直接產出
- WHEN 反問達兩輪仍有缺口，Analyst SHALL 給出帶假設的初步判斷並列 Open Questions，SHALL NOT 第三輪追問
- WHEN 需求的驗收標準不可測，Analyst SHALL 挑戰並打回，SHALL NOT 放行進 spec 管線

**Architect**
- 產出的 spec SHALL 含可測驗收標準與範圍 In/Out；寫不出可測驗收 SHALL 退回 Analyst
- WHEN 方案存在實質取捨，Architect SHALL 以決策卡呈現，SHALL NOT 自行拍板

**DBA**
- WHEN 使用者指定 DB，回答 SHALL 針對該 DB；WHEN 未指定，SHALL 並列三方言差異
- 回答涉及實際 schema 時 SHALL 引用 schema/migration 檔，SHALL NOT 憑空假設欄位存在

**Builder**
- WHEN 輸入 spec 狀態非 Locked，build SHALL 拒絕啟動並說明缺什麼
- 所有 code 變更 SHALL 發生在 feature branch；SHALL NOT 直接改主幹

**Examiner**
- WHEN build 變更動到程式碼層面的邏輯，管線 SHALL 於硬停點二前啟動理解檢核；WHEN 變更僅為文案/註解/格式/設定，SHALL 略過；quick 通道 SHALL NOT 觸發理解檢核
- 考題 SHALL 針對功能行為、設計取捨與失效模式，並 SHALL 優先取材 spec 未釘死、Builder 自主決定之處；SHALL NOT 考檔名、路徑、函式名等實作瑣事
- WHEN 回答錯誤或不完整，Examiner SHALL 講解現況並引 code（file:line），SHALL NOT 阻擋 merge 或建議禁止 merge
- 理解檢核 SHALL 附著於硬停點二，SHALL NOT 新增硬停點；WHEN TPM 於對齊中表示自主決定不符其意，Examiner SHALL 如實記入摘要，SHALL NOT 自行裁決

**Reviewer**
- 驗收報告 SHALL 逐條對應 spec 驗收標準，無遺漏
- WHEN 變更涉及 migration/交易/權限/對外介面，SHALL 列入高風險變更點段落（含 file:line）
- WHEN 變更觸及含多步寫入的 API 且無交易保護，SHALL 列為高風險變更點並依後果評 P1/P2，SHALL NOT 因改動幅度小而略過檢查

**完工文件同步（build 收尾）**
- WHEN merge 完成，管線 SHALL 補 spec 相關 API 表並列出受影響既有文件的建議更新清單；SHALL NOT 為此新增停點

**自主執行（build 管線預設）**
- WHILE 自主執行，管線 SHALL NOT 以排程確認打斷 TPM；SHALL 僅於事件觸發時停（高風險決策 / P1 三輪未清 / spec 矛盾）
- WHEN 遇到 spec 未涵蓋的高風險決策（migration/權限/對外契約/不可逆），管線 SHALL 停下以決策卡請示，SHALL NOT 自動採納
- WHEN P1 退修達 3 輪仍未清空，管線 SHALL 停下並附「修不掉的 P1 與原因」
- spec 鎖定與 merge 兩個硬停點 SHALL 於任何模式要求使用者明確回答
- 自主過程中的所有自動決定 SHALL 留紀錄可回溯

**全體**
- 每個回答 SHALL 標註來源等級（§6.4）；WHEN 查無依據，SHALL 明說，SHALL NOT 杜撰

---

## 8. 實作分期

| Phase | 內容 | 狀態 | 完成判準 |
|---|---|---|---|
| **P1 諮詢+輕通道** | Scout / Analyst / DBA + ask / db / quick | ✅ 已實作 | 在真實 repo 裝上後：`/octopus:db` 問三方言問題、`/octopus:ask` 問 codebase 問題，回答含來源標註 |
| **P2 SDD 交付管線** | Architect / Builder / Reviewer / Debugger + spec / build / main / debug / review + command 層流程閘門 + Arena 決策沉澱 | ✅ 已實作（閘門為 command 步驟，見 §6.2） | 拿一個真實 SDD 專案走完 spec→Locked→build→驗收報告→merge 全程 |
| **P2.1 理解檢核** | Examiner + build merge 前整合（quick 不考） | ✅ 已實作 | 動到程式邏輯的 build 於 merge 前出題問答；答錯獲得講解且不擋 merge |
| **P3 基建** | 程式化 hooks 備援、session memory + `/octopus:recall`、模型分級（Scout 輕量、其餘重） | 🔶 部分完成：hooks 第一批 ✅（主幹保護＋spec 狀態機，見 §6.2）；其餘 hooks / memory / 模型分級 ⏳ | 在目標 repo 實測：主幹 commit、force push、spec 跳關改 status 皆被 exit 2 擋下且訊息可讀 |

---

## 9. 風險與 Open Questions

### 風險

| 風險 | 緩解 |
|---|---|
| main 管線多輪 token 成本 | quick 通道分流；Analyst 兩輪上限 |
| 杜撰 schema/契約 | 四級來源標註 + 查無明說（§6.4），hooks 抽驗 |
| Builder 寫壞 code | feature branch 隔離 + TPM 驗收才 merge |
| Reviewer 單點誤判 | solo 本來就沒有更多眼睛——接受，但高風險變更點強制 TPM 親掃 |
| spec 形式主義（小事也走全管線） | quick 通道存在且判準明確（§5.3） |
| Arena 與 code 失同步 | 只沉澱決策、不沉澱可推導事實 |

### Open Questions（待使用後拍板）

- quick 與 spec 的界線實際拿捏（用兩週後回頭調判準）
- 跨專案共用 Arena（個人層級的知識庫）要不要做
- 同事使用回饋進來後，是否需要「公司共用 review 規則」層（可由各專案/公司自帶規則檔，Reviewer 按檔案類型載入）

---

## 10. 附錄：出場方案存檔

以下方案在設計過程中被砍，存檔備查；若未來情境改變（多人協作、接全棧、給 PM 用）可取回：

- **多角色協作中樞（v0）**：PM/FE/BE 各有入口；Feasibility 可行性卡片（六欄位）、Triage 前後端分流 agent、FE task 欄位規格、MSW mock 產出。出場原因：服務不存在的使用者
- **全棧雙 Builder（v0.x）**：+UI 前端專家（GD-Data 的前端鏡像）、Builder 拆 FE/BE、task 端別欄位確定性路由。出場原因：定位收斂為後端專用
- **UI/UX 設計官（v0.x）**：實作前出 design tokens/佈局，實作後「截圖→挑刺→修正」精緻度審查迴圈（上限 2~3 輪）。出場原因：同上
- **Guardian 治理 agent（v0.x）**：spec 狀態流轉的專職裁決者。出場原因：狀態流轉是確定性動作，hooks + command 就能做，不用 agent
- **擴編路線（若部署到團隊共用）**：意圖漂移檢查官（比對客戶原話＝糾紛留痕）、合約對齊驗收官（範圍對齊＝請款驗收）、UAT 測試官（客戶驗收測試）獨立成編——專案公司情境約 11~13 agent。原則：每多一條「對外部利害關係人的問責邊界」，加回一個守邊界的 agent
