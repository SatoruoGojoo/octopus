# Octopus 功能文件

> **版本**：v0.5 Draft
> **形式**：Claude Code plugin
> **本檔定位**：Octopus 的權威設計文件。實作（agents/、commands/）一律從本檔推導；實作與本檔衝突時，回到本檔修訂後再改實作。

---

## 1. 概述與定位

### 1.1 命名由來

**一顆頭，多隻腳。** 頭是你——TPM（Technical Project Manager）；腳是各管一個領域的專家 agent，聽頭的指揮。腳的數量不追「章魚＝八」的字面，跟問責邊界走（§2）——v0.5 起為七隻。

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

> **Harness 的品質不取決於 agent 數量，取決於三個 TPM 介面的品質**：需求進口、決策呈現、驗收出口（§4）。三個介面任一做爛，這群腳會非常高效地做出你沒有要的東西。

### 1.4 定位演進軌跡（決策紀錄）

本設計經多次收斂，記錄如下以免重蹈：

| 版本 | 定位 | 出場原因 |
|---|---|---|
| v0 | PM/FE/BE 多角色協作中樞（13~17 agent） | PM/FE 是不存在的使用者——服務的角色根本沒有人 |
| v0.x | 唯讀諮詢 → 完整 SDD 引擎 → 個人全棧+UI/UX 設計官（12 agent） | 範圍反覆膨脹；最終認清真實需求是**優化個人後端工作流** |
| **v1（本檔）** | **個人後端工作流，7 agent 精實編制** | — |

出場方案的設計細節存檔於附錄（§10），未來若擴編（多人/全棧）可取用。

---

## 2. 編制原則：為什麼是這幾個

編制判準：**agent 數量不跟功能數走，跟「問責邊界」數量走。** 每個 agent 的存在理由是「守一條失守代價夠大的邊界」。多 agent 工作流常見的失敗模式是模擬一整個產品團隊的組織（PM、用戶代表、SA、QA、戰略顧問各派一個）——solo 情境下這些利害關係人不存在或就是你自己，對應的 agent 是在服務不存在的人。反之，**挑戰你的 agent 增值**（solo 的需求沒人嗆）、**模擬你的 agent 砍掉**（你就是 PM）。

### 2.1 七隻腳各守的邊界

| Agent | 守的邊界 | 失守的代價 |
|---|---|---|
| Scout | 「事實 vs 印象」——專案知識必須查證 | 憑印象回答，決策建立在過時資訊上 |
| Analyst | 「需求進口」——模糊需求不得進管線 | garbage in，整個工程部高效產出 garbage |
| Architect | 「先想再做」——spec 與取捨先於 code | 邊做邊想，返工與範圍漂移 |
| DBA | 「資料層不可輕率」——schema 錯誤最難回滾 | migration 災難、效能債 |
| Builder | 「實作不碰主幹」——一律 feature branch | 失去 TPM 合併權 |
| Reviewer | 「驗收出口」——solo 最缺的第二雙眼睛 | 沒人抓你的盲點，問題進 production |
| Debugger | 「根因 vs 症狀」——不只修哪行炸 | 同一類 bug 反覆出現 |
| （Core） | 路由——確定性，屬頭不佔腳 | — |

> 「七隻腳」＝上列 7 個 agent persona；Core 是編排（commands＋主對話），屬於頭的延伸，不佔腳、不設 agent 檔（§3.0）。
>
> 「理解 vs 盲簽」邊界（盲簽 merge → 長期喪失對自己 codebase 的掌握）由 build 管線的**隨行回報**承接（§3.5、§5.2）：逐 task 的 code 導讀讓 TPM 邊做邊懂，不必事後回頭補看。此邊界不設獨立 agent，長在 Builder 的回報裡。

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

## 3. Agent 能力規格（七隻腳）

所有 agent 共用的紅線見 §6.4 誠實原則。

### 3.0 Core（編排——不是獨立 agent 檔）

路由與管線編排由 **commands + 主對話**承擔：明確 command（`/octopus:db` 等）直達對應 agent，零分類成本；只有自由提問需要意圖判斷。Core 不持有領域知識，不出現在 `agents/` 目錄。

### 3.1 Scout（考古官）

| | |
|---|---|
| 職責 | codebase 架構/慣例/依賴、git 演進（誰改的、為什麼、何時）、專案與 change 進度狀態；**專案鳥瞰（overview，v0.5）**——分層架構、模組職責、依賴方向、關鍵流程走讀 |
| 輸入 | 自然語言提問；`/octopus:overview`（可指定聚焦範圍） |
| 輸出 | 帶來源標註的答案（`file:line`、commit hash、change 路徑）；overview 敘事報告 |
| 工具邊界 | 唯讀（Read/Grep/Glob/git log 類） |
| 紅線 | 查無必須明說；不憑記憶回答可以查證的事 |

**Overview 行為規格（v0.5）**：**說明優先、圖為輔**——輸出是敘事文件（分層架構、各模組職責一句話、依賴方向、2~3 條關鍵流程走讀），mermaid 圖只當配角，不做 graph-first 的知識圖譜（外部工具實測的教訓：圖建得再全，說明能力差就沒有理解價值）。on-demand 生成、**不落檔**（Arena 原則：不沉澱可推導事實，每次拉都是現況）；來源標註紅線照舊。

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
| 職責 | 把 Analyst 的結構化需求寫成 OpenSpec change（proposal＋spec delta＋design（如需）＋tasks，格式見 §5.3）；方案有取捨時產出決策卡（§4.2）給 TPM 拍板；tasks 逐條標註驗證方式（`test`/`browser`，供拍板時勾選）；**自主判斷組織方式（單 change vs 拆多 change＝epic，見下）** |
| 輸入 | Analyst 的結構化需求（或 TPM 直接給的明確需求）；入口輕問的 TPM 指定（如有，見 §5.2） |
| 輸出 | change 資料夾（`openspec/changes/<name>/`）、決策卡；拆 epic 時另產 roadmap |
| 紅線 | delta 的每條 Requirement 必含至少一個可測 Scenario（GIVEN/WHEN/THEN）；寫不出可測情境＝需求沒釐清，退回 Analyst；只 Write change 資料夾與 roadmap，不碰實作 code |

**組織判準（單 change vs epic）**：change 的天然邊界＝**一次可獨立驗收、獨立 merge 的單位**。Architect 動筆前自主判斷（TPM 於入口輕問可指定、拍板停點可改，見 §5.2）：

- 需求能在一條 feature branch、一次驗收 merge 內收完 → **單 change＋平鋪 tasks**（預設傾向，多數需求應落在這裡）
- 需求含多個可獨立驗收的交付面（跨 schema/契約邊界、砍掉其中一塊其餘照常運作）→ **拆多筆 change（＝epic）**，每筆各自走狀態機與驗收 merge；另產 **roadmap**（位置見 §5.3）記各 change 名稱、順序與相依。**roadmap 不是 change：不帶 octopus.status、不受狀態機管**
- 拆或不拆的判斷理由寫進完整包一併呈現——它屬拍板範圍，TPM 回 OK 即含對組織方式的認可

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
| 職責 | 從確認過的 change（或 quick 任務）實作 code＋測試；每完成一條 task 出一則 task 回報（**純執行層**，見下） |
| 輸入 | Locked change + tasks（main/build 管線），或直接的小修描述（quick） |
| 輸出 | feature branch 上的 commits + 測試 + 每條 task 的 task 回報 + 最終變更摘要 |
| 紅線 | **一律在 feature branch 工作，絕不直接改主幹**（TPM 合併權的執行機制）；測試跟著實作走，不可宣稱完成而無測試（除非 change 明示免測並有理由） |

**純執行層（v0.5 修訂）**：Builder 的邊界是**實作紀律**與「不碰主幹」（§2.1），**不含派工節奏**。它實作被指派的 task，每完成一條就回一則 **task 回報**（做了什麼一~兩句／關鍵 code 導讀 `file:line`——改哪裡、為什麼／自主決定——spec 未釘死、自己拿主意的點），全部做完回最終變更摘要。「逐 task 回報」是誠實原則（§6.4）的延伸——讓工作可讀、讓 TPM 隨行看懂每條 task 對應的 code（守住「理解 vs 盲簽」邊界、不盲簽 merge），**不論誰在編排、怎麼派工都成立**。至於「一次派一條、逐條轉呈、SendMessage 續派」——那是**編排層**（Core）在當前工具限制下讓進度可見的實作手段（見 §5.2「自主段的兩個契約」），不是 Builder 的身份；harness 就緒後 Builder 一個字都不用改。

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

呈報時機分兩種：**拍板點呈報**（預設 spec/main 的 OK 停點、`step` 模式、諮詢情境——當場等 TPM 回答，回 OK＝全採建議）；**事後呈報**（`auto` 模式的鎖定與執行段所有保守預設決策——留痕後集中列在驗收報告開頭的「執行中自動拍板清單」，TPM 於驗收停點以否決權行使拍板）。

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

Browser 驗證為 opt-in（§5.2）：有執行時，操作結果與截圖附於驗收報告之後，不改動四段結構。

---

## 5. Commands 與管線

### 5.1 Command 總表

| Command | 用途 | 路由 |
|---|---|---|
| `/octopus:init` | 既有專案接機（一次性）：摸專案、偵測/建立 OpenSpec 結構（認 v1.x 與 v0.x legacy）、檢查 `openspec` CLI（缺則請使用者安裝）、建 Arena＋gitignore、交接報告 | Scout＋確定性檢查 |
| `/octopus:ask` | codebase/git/進度問答 | Scout 直答 |
| `/octopus:overview` | 專案鳥瞰：分層架構＋模組職責＋依賴方向＋關鍵流程走讀（§3.1） | Scout 直答 |
| `/octopus:db` | DB 三方言諮詢 | DBA 直答 |
| `/octopus:quick` | 小修小補：不啟動管線、不開 change | Builder 直做（仍出簡版報告） |
| `/octopus:spec` | SDD 討論段（可獨立停住） | Analyst → Architect → change 落檔（proposal＋delta＋tasks）→【鎖定】 |
| `/octopus:build <change\|roadmap>` | SDD 執行段（**全自主**，入口 Draft 自動鎖定；收 roadmap 則逐 change 執行） | 讀 tasks → Builder 逐 task 隨行回報（進度可見契約，§5.2）→ Reviewer → P1 自動修（≤3 輪）→ browser 驗證（opt-in）→【merge】→ archive |
| `/octopus:main` | spec + build 連跑（拍板一個 OK 後全自主；加 `auto` 純一條龍） | 上兩段串接，零重複邏輯 |
| `/octopus:tasks` | 單獨產 tasklist（change 或需求文字皆可；不實作） | Architect（情境 B）；無 change 時 Analyst 輕量釐清先行 |
| `/octopus:debug` | 根因分析 | Debugger |
| `/octopus:review` | 單獨審查（不限管線產出） | Reviewer |
| `/octopus:recall` | session 恢復 | Phase 3 |

### 5.2 SDD 交付管線

設計原則：**討論集中在前段，拍板一個 OK，之後全自主執行、不中途等人**。TPM 在管線起點本來就在場（Analyst 反問），change 產出後只需回一個 **OK**（＝決策卡全採建議＋鎖定）就放手；執行段以**隨行回報**讓 TPM 看得到進度（每條 task 一則回報，單向呈現、不停等回覆），跑完帶回「驗證過的成品＋驗收報告＋執行中自動拍板清單」。輸入含 `auto` 時連 OK 都省（build 入口自動鎖定＋留痕），純一條龍直達驗收。

```
── 討論段（/octopus:spec 單獨跑，或 main 前半）──────
模糊需求
  → Analyst：反問釐清（≤3 問 ×≤2 輪）＋魔鬼代言人挑戰
  → 規劃輕問（非停點）：組織方式交 Architect 判斷（預設），或 TPM 指定單 change / epic；auto 不問
  → Architect：change 一次產齊——proposal ＋ spec delta ＋ design（如需）＋ tasks（逐條標驗證方式
    test/browser）＋（如有取捨）決策卡；判斷拆 epic 時另產 roadmap
  → 落檔 openspec/changes/<name>/，.openspec.yaml 標 octopus.status: Draft
  → 鎖定：
     · 預設（spec / main）→【拍板 OK 停點：TPM 看完整包（含勾選哪些 task 要 browser 驗證），
       回 OK＝決策卡全採建議＋鎖定】→ command 改標 Locked
     · 輸入含 auto，或直接 /octopus:build 一筆 Draft change → 不停，build 入口自動鎖定＋留痕
       （browser 驗證是 opt-in，沒人勾＝不做）
── 執行段（/octopus:build，全自主）─────────────────
  → 入口閘門：openspec CLI 缺 → 停，請使用者安裝；
              Draft → 未定案決策卡取建議選項留痕 → command 自動改標 Locked 續跑；
              Implemented / 已歸檔 → 拒絕（已完工，建議開新 change）；缺 octopus.status → 停，請先補登
  → Builder 逐 task 派工（進度可見契約實作，§5.2）：同一個 builder，一條 task——實作＋測試 → 返回 task 回報
    （做了什麼／code 導讀 file:line／自主決定）→ Core 轉呈 TPM ＋ todo 勾銷進度（不停等回覆）
    → SendMessage 續派下一條，直到 tasks 做完
  → Reviewer：驗收報告
  → 有 P1？→ 自動退回同一個 builder 修 → 重審（迴圈，上限 3 輪；未清空→收尾標紅，不中途等人）
  → Browser 驗證（opt-in，有 task 被勾選才執行）：由 Core 親自操作 Chrome（subagent 用不到瀏覽器
    工具——工具限制，見 §5.3），逐項操作＋截圖附進驗收報告；環境不可用 → 不中斷，報告標紅「未執行＋原因」
  →【唯一硬停點：TPM 驗收 → merge】→ command 改標 Implemented
  → 收尾：tasks 全勾 → 建議執行 openspec archive（delta 合回主 spec＋歸檔），TPM 點頭即跑；
          有未完 task（如舊資料 backfill）→ 不 archive，change 留開——「code 已修、舊資料待補」
          這類修復狀態就長在這裡
── epic 模式（build 收到 roadmap）─────────────────
  → 依 roadmap 相依順序逐 change 執行：每筆 change 各自走完整執行段＋驗收 merge
  → 前一筆經 TPM merge 後才啟動下一筆；不 merge 即中止後續（否決權天然存在）
```

**為什麼 spec/build 拆兩段而不是 main 一條龍**：change 的討論與實作經常不在同一天（等確認、排隊、跨週）。change 必須是**可暫停、可累積、可回頭對賬的獨立交付物**——只活在對話裡的規格不是 SDD，是「動手前有先想」。`/octopus:main` 只是連跑糖衣。

**自主段的兩個契約——契約 vs 實作（v0.5 修訂）**：自主執行段沒人逐步盯著，靠兩個契約維持 §4 的 TPM 介面（決策呈現、驗收出口）不失真。**契約是穩定介面、實作是可換手段**——分開寫，未來 harness 才有明確接手目標，agent 也不必揹著編排邏輯（規則漂移風險見 §9）：

- **進度可見契約**：TPM 能漸進看到 build 進度，不是等整段跑完才一次看到成品。
  - *當前限制*：Claude Code 的 subagent 輸出在它返回前 Core 看不到，要即時拿到每條 task 的回報，只能把 Builder 的執行切成回合、讓每次返回帶一條。
  - *當前實作＝回合制*：Core 逐條派 task 給同一個 builder（SendMessage 續派、context 連貫），每回合即時轉呈回報＋勾銷 todo、不停等回覆。代價：每回合一次 agent 往返＋context 重載，且「Core 記得續派、別讓 builder 跑過頭」靠 prompt 撐（漂移風險見 §9）。
  - *未來實作＝harness*：工作佇列／串流機制機械化捕捉逐 task 回報，免去往返；屆時 Builder（§3.5）與本契約都不必改。
- **決策留存契約**：自主段每個自動決定（入口 auto-lock、保守預設）都可回溯，TPM 在驗收停點一次審完。
  - *當前實作*：Core 把自動決定即時寫進 Arena `decisions.md`（跨 session 知識面），並在驗收報告開頭集中呈現「執行中自動拍板清單」（當次稽核面）；兩者分工見 §6.1。

「回合制」「SendMessage 續派」是**實作細節**，描述位置在 build.md 編排步驟，不在 Builder persona——這條界線與「Command＝編排層、Agent＝執行層」（§3.0）一致。

**停點規則**（v0.3 起：TPM 判斷集中到 merge 一點；v0.5 語彙隨 OpenSpec 換血更新）：
- **硬停點只有一個**：驗收 merge（決定什麼進主幹）——TPM 權力核心，任何模式都要人類明確回答
- **拍板 OK 停點（預設，可跳過）**：spec/main 呈現完整包（proposal 摘要＋決策卡＋tasklist＋browser 驗證勾選）後等 TPM 一個 **OK**——OK＝決策卡全部採建議選項＋同意鎖定；想改就回話逐項處理。成本極低（TPM 在管線起點本來就在場、剛答完反問），擋掉的是純自動最大的浪費：方向全錯的整輪 build。輸入含 `auto`、或直接 `/octopus:build` 一筆 Draft change 時跳過此停點：入口自動鎖定＋留痕，此時 `Locked` 只代表「**規格定稿、進入執行、不再漂移**」而非 TPM 看過——拍板權後置到驗收停點以否決權行使（前提：Builder 紅線保證 **branch 上一切可逆**——不 merge、不推主幹、migration 只產檔不執行，不 merge 即否決，代價只是白跑一輪 token）
- **執行段不中途等人**：原本的三種例外停點改為「保守預設＋留痕＋驗收報告集中呈報」——
  - 高風險決策（spec 未涵蓋且涉及 migration / 權限認證 / 對外契約 / 不可逆）→ 取保守選項，以決策卡格式記錄，呈報在驗收報告開頭的「執行中自動拍板清單」
  - P1 三輪修不乾淨 → 直接收尾出報告，如實標紅「修不掉的 P1 與原因」，不建議 merge
  - 實作中發現 spec 矛盾 → 按最合理解釋標註後繼續，差異寫入報告，不自行竄改 spec delta
- **隨行回報不是停點（v0.5）**：逐 task 回報（進度可見契約的呈現面）單向呈現、不停等回覆——TPM 隨時可以人為打斷，但管線不主動停。它同時守住「理解 vs 盲簽」邊界：spec 未釘死、Builder 自主決定的點即時攤開在回報裡，TPM 隨行看懂就不必事後補看
- **Browser 驗證不是停點（v0.5）**：Core 自主執行拍板時勾選的項目並附證據，結果只進驗收報告
- **step 模式（可選）**：command 輸入含 `step` 時改為逐步確認，鎖定點與上述三種事件照停——給想盯流程的場合；預設是自主模式
- **規劃輕問不是停點**：Analyst 釐清後、Architect 動筆前問一句組織方式（交 Architect 判斷／指定單 change／指定 epic），不答或答「交給你」即走預設。它發生在 TPM 本來就在場的討論段，不違反「執行段不中途等人」；`auto` 模式不問
- **epic 模式的 merge 不合併**：每筆 change 的驗收 merge 都是獨立硬停點——merge 權不隨拆分稀釋成一次性大放行
- **merge ≠ 結案（archive）**：merge 決定 code 進主幹；archive 決定 delta 合回主 spec、change 歸檔結案。兩權都在 TPM——tasks 未全完成（如資料修補待跑）可以先 merge code、change 留開繼續追蹤，archive 前 tasks 必須全數完成

### 5.3 SDD 整合細節（OpenSpec 換血，v0.5）

- **檔案格式全面採用 OpenSpec**（Fission-AI/OpenSpec，v1.x）：`openspec/specs/<domain>/spec.md` 是「系統現況」的活文件（純 markdown，無 frontmatter）；每筆工作——新功能、bug 修復、資料修補——都是 `openspec/changes/<name>/` 一筆 change（proposal.md＋specs delta＋design.md（如需）＋tasks.md）；結案 archive 時 delta 合回主 spec（ADDED 附加／MODIFIED 整段取代／REMOVED 刪除），整夾移入 `changes/archive/YYYY-MM-DD-<name>/`。自有格式（`specs/NNN-*`＋frontmatter status）出場（§10）
- **Octopus 狀態機掛在 change 上**：`changes/<name>/.openspec.yaml`（OpenSpec 官方未規範內容的中繼資料檔）寫入 `octopus.status: Draft / Locked / Implemented`；**狀態流轉仍由 command 確定性寫入**，agent 一律無權改。Draft＝提案中、Locked＝拍板後執行中、Implemented＝已 merge；archive 後整夾移入 archive/ 即終態。鎖定兩條路不變：TPM 在 OK 停點確認，或 `auto`／直接 build 時入口自動鎖定（Arena 留痕「auto-locked」）
- **`openspec` CLI 是前置依賴**：validate / archive 等確定性動作交給 CLI（code 能答的不用模型）；init 與 build 入口檢查 CLI，缺則停下請使用者安裝（附官方安裝指引），**不自行模擬 CLI 行為**
- **與 `/opsx:*` 共存的立場**：`openspec init` 會在目標 repo 裝 OpenSpec 自己的 AI 工作流指令。查詢類（status/list/show/view）隨意用；**會動檔案的工作流（propose/apply/archive）建議走 `/octopus:*`**——feature branch 紀律、拍板停點、狀態機、守門 hook 只在 Octopus 管線內有保障，混用會造成狀態漂移（該筆 change 沒有 Locked/Implemented 紀錄）
- **行為規格句式跟 OpenSpec 官方格式走**：`### Requirement:`（SHALL/MUST）＋`#### Scenario:`（GIVEN/WHEN/THEN），每條 Requirement 至少一個可測 Scenario——EARS「行為必可測」的原則不變，句式讓位給 `openspec validate` 認得的結構；內建範本 `templates/spec-template.md` 出場。proposal 保留「目標與動機」脈絡（change 兼任業務故事）
- **roadmap 位置**：`openspec/roadmaps/<需求名>.md`（自訂資料夾，不是 change、不受 CLI 與狀態機管；`openspec validate` 對此的容忍度待實測，見 §9）
- `/octopus:quick` 明確**不開 change**——防形式主義；判準：單檔可定位、不碰 schema/契約/權限的修改。要留修復追蹤紀錄的工作請開 change（哪怕很小）
- **tasks 驗證方式欄位**：tasks.md 每條 task 標 `test`（預設，自動測試）或 `browser`（瀏覽器操作＋截圖）；browser 為 **opt-in**——拍板 OK 停點時 TPM 勾選才生效，執行由 Core 親自操作（Claude Code 的瀏覽器整合僅主對話可用，subagent 不可用——工具限制，非設計選擇）
- **完工文件同步（build 收尾，不另設停點）**：merge 後補 proposal 的「相關 API」表，並列出本次變更使哪些既有文件過時的建議更新清單
- **修復場景（本次換血的原始動機）**：bug 修復＝開一筆 `fix-*` change；「code 已修、舊資料待補」＝tasks 部分打勾＋change 未 archive；結案時機（archive）由 TPM 控制——OpenSpec 官方查無「部署後修復追蹤」概念，這是 Octopus 賦予 change 生命週期的用法

---

## 6. 基建

### 6.1 Arena 知識庫（預設私有）

- 位置：目標 repo 的 `.claude/.octopus-arena/`，分片 markdown（`architecture.md` / `conventions.md` / `decisions.md` / `glossary.md`）
- 原則：**只沉澱「拍板過的決策與 Open Questions」，不沉澱可從 code 推導的事實**（那些每次即時掃描，永不過時）
- **知識面 vs 稽核面的分工（v0.5 澄清）**：`decisions.md` 是**跨 session 知識**（哪些決策拍過、為什麼），供日後回想；「這一輪 build 是否誠實執行」的**稽核**由驗收報告的「執行中自動拍板清單」（§4.3 決策呈現）與 feature branch commit 史承擔。自主段把保守預設寫進 `decisions.md`，是因為它們是「值得日後回想的決策」，不是要把 Arena 當管線的執行軌跡日誌。run-marker（`.run`，§6.2）是**編排狀態**、不是知識，本就與 `decisions.md` 分開存放
- **預設加入目標 repo 的 `.gitignore`**：同事在同一公司 repo 各自用 Octopus 時，Arena 寫進 git 會默默變成共用狀態，違反「各自使用」的部署前提。想升級成團隊共享知識庫時，拿掉 gitignore 那行即可（屆時需要有人負責清理髒資料）

### 6.2 流程閘門

**v0.1 實作方式：閘門寫在 command 的確定性步驟裡**（build 入口先 Read spec frontmatter：`Draft` 自動鎖定後續跑、`Implemented` 拒絕、缺 status 停下要求補登；Builder agent 動工前自驗 `Locked`＝雙重檢查；狀態流轉只由 command Edit）。v0.5 換血後檢查對象改為 change 的 `.openspec.yaml`（`octopus.status`），機制不變。

**v0.2 程式化 hooks 備援（第一批，已實作）**：plugin 附帶 PreToolUse hooks（`hooks/hooks.json`），防 agent 被說服繞過 prompt 層閘門。挑選標準＝「失守代價最大的兩條紅線」。工程慣例：純 node、零相依、**fail-open**（hook 自身故障一律放行，不卡流程）、判斷邏輯以 `evaluate()` export 可獨立驗證、擋下訊息 zh-TW 並附解法。

**熱路徑成本（hook 是 user-scope，每個專案的每次工具呼叫都會跑）**：hook 必須先用純字串判斷確認「這次呼叫可能踩到不變量」，才做任何昂貴動作（spawn 子行程、讀檔）。`branch-guard` 由此定下不變量：**指令不含 `git` 時直接 exit 0，不查分支**——`evaluate()` 對這類指令本來就恆回傳 `null`，查了也用不到。子行程只為真正需要 `branch` 的規則（主幹上的 `git commit`、裸 `git push`）而開。

**生效範圍——守門跟著管線走（v0.3.1）**：plugin hook 是 user-scope（plugin 啟用後，在使用者所有專案的工具呼叫前執行），但機械守門真正要保護的對象是**全自主執行段裡沒人盯著的 agent**，不是使用者日常指揮的 Claude。曾以「Arena 存在」為啟動條件（守門跟著專案走），實務證偽：init 是每個用 Octopus 的專案都會跑的起手式，該條件等於「用 Octopus＝全時被管」——日常合法操作（TPM 叫 Claude 在主幹 commit）也被攔，把「我要 Octopus 理解這個專案」與「我要它管制此專案所有 Claude 行為」兩種不同的同意綁在一起。

改為 **run-marker**：管線 command（spec/build/main/quick）起跑時寫入 `.claude/.octopus-arena/.run`（內容為 ISO 8601 時間戳，一行），收尾（呈完整包/驗收報告/簡版報告）時刪除。兩支 hook 做任何昂貴動作前，先從 payload `cwd` 往上找 `.run`——**存在且未過期（TTL 4 小時）才啟動守門，否則直接 exit 0**。TTL 是 crash 殘留的兜底：管線異常中斷沒清到 marker，守門最多多活 4 小時自動失效；新一輪管線起跑直接覆寫。推論：
- 日常工作（無管線在跑）hook 零干預——含 merge、worktree 操作、主幹 commit
- 管線收尾後 TPM 叫 Claude merge，**不再需要 `OCTOPUS_TPM_OK=1` 前綴**（marker 已清）；同意通道保留，供執行中的例外（如 step 模式中途同意）
- `/octopus:init` 回歸純粹「理解專案＋建 Arena」，不再隱含開啟管制
- 判定不了（讀檔錯誤、時間戳無法解析等）視為無有效 marker，fail-open 放行

**阻塞等待一律要有上界**：hook 卡住的代價是整個工具呼叫卡住（實測曾撞到 harness 的 hook timeout 上限）。凡是等外部的動作都要能自己逾時，逾時即 fail-open 放行：

- 讀 stdin payload 用**非同步讀＋逾時**（`readStdin()`，5s）。**不可用 `readFileSync(0)`**——它同步阻塞 event loop 直到 EOF，harness 沒關 stdin 就永遠不返回，而且 `setTimeout` 看門狗此時根本觸發不了。
- spawn 子行程一律給 `timeout`（`branch-guard` 查分支：3s），失敗或逾時退回 `branch = null`，只做不需分支的檢查。

| Hook | 攔截 | 守的不變量 | 例外（留痕） |
|---|---|---|---|
| `hooks/branch-guard.mjs` | PreToolUse(Bash) | **主幹保護**：擋「在 main/master 上 `git commit` / `git push`」「push 到 main/master」「`git merge`（`--abort`/`--quit` 善後除外）」「任何 force push」；同一指令串內 `checkout`/`switch` 換到主幹也會被追蹤 | TPM 明確同意時在指令前加 `OCTOPUS_TPM_OK=1 `——例外寫在指令裡＝可稽核；同意後 Claude 直接前綴重跑，不重複請示 |
| `hooks/spec-status-guard.mjs` | PreToolUse(Edit\|Write) | **change 狀態機**：`octopus.status` 只能單步順向 `Draft → Locked → Implemented`，禁回退、禁跳關、禁刪除或憑空插入；新 change 只能生為 `Draft`。（v0.5 目標：守 `changes/<name>/.openspec.yaml`；現行實作守 spec frontmatter，隨換血改寫） | 回退/修復由 TPM 親手改檔（hook 只攔 Claude 的工具呼叫）；`openspec archive` 走 CLI（Bash），不經此 hook |

界線：hook 守**確定性不變量**（程式能判定的）；鎖定的時序（手動拍板或 build 入口自動鎖定）仍由 command 流程負責——hook 只驗「單步順向」，無從也無需得知這一步是誰確認的，這條界線是刻意的，不要試圖用 hook 驗語意。

**Phase 3 其餘備援（未做）**：

| 時機 | 驗什麼 |
|---|---|
| SubagentStart | Builder 動工前必有 tasks/TODO 清單 |
| SubagentStop | Reviewer 報告必含「高風險變更點」段落；Builder 產出必在 feature branch 上 |
| build 入口 | change 的 `octopus.status` 為 `Implemented` 或缺失 → 程式直接擋下（現由 command 步驟＋Builder 雙重檢查） |

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
- 產出的 change SHALL 含 proposal（意圖/範圍 In-Out）、spec delta 與 tasks；delta 的每條 Requirement SHALL 含至少一個可測 Scenario；寫不出可測情境 SHALL 退回 Analyst
- tasks SHALL 逐條標註驗證方式（test/browser）供拍板時勾選
- WHEN 方案存在實質取捨，Architect SHALL 以決策卡呈現，SHALL NOT 自行拍板
- WHEN TPM 未指定組織方式，Architect SHALL 依「一次可獨立驗收 merge 的單位」判準自主決定單 change 或拆 epic，並將判斷理由納入完整包；WHEN TPM 於入口輕問或拍板停點指定，SHALL 遵循
- WHEN 拆分為 epic，Architect SHALL 產出 roadmap 記各 change 名稱、順序與相依；roadmap SHALL NOT 是一筆 change、SHALL NOT 帶 octopus.status

**DBA**
- WHEN 使用者指定 DB，回答 SHALL 針對該 DB；WHEN 未指定，SHALL 並列三方言差異
- 回答涉及實際 schema 時 SHALL 引用 schema/migration 檔，SHALL NOT 憑空假設欄位存在

**Builder（純執行層）**
- Builder 動工前 SHALL 自驗 change 為 Locked（與 command 入口構成雙重檢查）
- Builder SHALL 每完成一條 task 返回一則 task 回報（做了什麼／code 導讀 file:line／自主決定）；此為工作可讀，SHALL NOT 因無人催而省略
- 所有 code 變更 SHALL 發生在 feature branch；SHALL NOT 直接改主幹、merge、force push 或改 octopus.status
- Builder 職責 SHALL NOT 含派工節奏——一次派一條或整批、如何轉呈 TPM 由編排層（Core）決定（見「自主執行」）

**Scout（overview）**
- WHEN 使用者要求專案鳥瞰，Scout SHALL 即時生成敘事型 overview（分層/職責/依賴/關鍵流程走讀）並標註來源；SHALL NOT 將 overview 落檔沉澱

**Browser 驗證（opt-in）**
- WHEN 拍板時勾選了 browser 驗證的 task，build SHALL 於審查後、驗收停點前由 Core 親自執行操作＋截圖並附進驗收報告；SHALL NOT 交由 subagent 執行（工具限制）、SHALL NOT 因此新增停點
- WHEN 勾選了 browser 驗證但環境不可用，管線 SHALL 繼續並於報告標明「未執行＋原因」；WHEN 無任何 task 被勾選，SHALL NOT 執行任何瀏覽器動作

**OpenSpec 相容**
- init SHALL 偵測既有 `openspec/`（v1.x 與 v0.x legacy）並接管，不重複建立；WHEN `openspec` CLI 缺失，init/build SHALL 停下請使用者安裝，SHALL NOT 自行模擬 CLI 行為
- archive SHALL 經 TPM 同意後以 CLI 執行；WHEN tasks 未全數完成，SHALL NOT 執行 archive（change 留開＝修復追蹤中）

**Reviewer**
- 驗收報告 SHALL 逐條對應 spec 驗收標準，無遺漏
- WHEN 變更涉及 migration/交易/權限/對外介面，SHALL 列入高風險變更點段落（含 file:line）
- WHEN 變更觸及含多步寫入的 API 且無交易保護，SHALL 列為高風險變更點並依後果評 P1/P2，SHALL NOT 因改動幅度小而略過檢查

**完工文件同步（build 收尾）**
- WHEN merge 完成，管線 SHALL 補 proposal 相關 API 表並列出受影響既有文件的建議更新清單；SHALL NOT 為此新增停點

**自主執行（build 管線預設）**
- WHILE 自主執行，管線 SHALL NOT 中途暫停等待 TPM 回答（step 模式除外）；執行中決策 SHALL 以「保守預設＋留痕」處理並於驗收報告開頭集中呈報
- 進度可見契約：自主段 SHALL 讓 TPM 漸進看到進度；當前實作為 Core 逐條派 task 給同一 builder、每條回報即時轉呈（回合制），SHALL NOT 停等回覆——此為實作手段，harness 就緒後可替換而契約不變（§5.2）
- WHEN 遇到 spec 未涵蓋的高風險決策（migration/權限/對外契約/不可逆），管線 SHALL 取保守選項並以決策卡格式留痕，SHALL NOT 執行任何效果逃出 feature branch 的動作（Builder 紅線不變：migration 只產檔、不推主幹、不 merge）
- WHEN P1 退修達 3 輪仍未清空，管線 SHALL 收尾出報告並標明「修不掉的 P1 與原因」，SHALL NOT 建議 merge、SHALL NOT 中途空等
- WHEN 實作中發現 spec 矛盾，管線 SHALL 按最合理解釋標註後繼續並將差異寫入報告，SHALL NOT 竄改 spec
- 驗收 merge 停點 SHALL 於任何模式要求使用者明確回答；代為 merge SHALL 以 `OCTOPUS_TPM_OK=1 ` 前綴留痕，SHALL NOT 於使用者已明確同意後重複請示
- WHEN 未指定 auto，鎖定 SHALL 經 TPM 明確確認（回 OK 即視為決策卡全採建議＋鎖定）；WHEN 輸入含 auto 或對 Draft change 直接執行 build，入口 SHALL 自動鎖定並留痕
- WHEN build 收到 roadmap，管線 SHALL 依相依順序逐 change 執行；WHEN 前一筆 change 未經 TPM merge，SHALL NOT 啟動下一筆
- 自主過程中的所有自動決定 SHALL 留紀錄可回溯

**守門（run-marker）**
- 管線 command（spec/build/main/quick）SHALL 於起跑寫入 `.claude/.octopus-arena/.run`（ISO 時間戳）、於收尾刪除
- WHEN 無有效 marker（不存在、逾 TTL 4 小時、或無法判讀），hooks SHALL 直接放行（exit 0）
- WHEN marker 有效，hooks SHALL 執行 §6.2 表列攔截；`OCTOPUS_TPM_OK=1` 同意通道 SHALL 保留

**全體**
- 每個回答 SHALL 標註來源等級（§6.4）；WHEN 查無依據，SHALL 明說，SHALL NOT 杜撰

---

## 8. 實作分期

| Phase | 內容 | 狀態 | 完成判準 |
|---|---|---|---|
| **P1 諮詢+輕通道** | Scout / Analyst / DBA + ask / db / quick | ✅ 已實作 | 在真實 repo 裝上後：`/octopus:db` 問三方言問題、`/octopus:ask` 問 codebase 問題，回答含來源標註 |
| **P2 SDD 交付管線** | Architect / Builder / Reviewer / Debugger + spec / build / main / debug / review + command 層流程閘門 + Arena 決策沉澱 | ✅ 已實作（閘門為 command 步驟，見 §6.2） | 拿一個真實 SDD 專案走完 spec→Locked→build→驗收報告→merge 全程 |
| **P3 基建** | 程式化 hooks 備援、session memory + `/octopus:recall`、模型分級（Scout 輕量、其餘重） | 🔶 部分完成：hooks 第一批 ✅（主幹保護＋spec 狀態機，見 §6.2）；其餘 hooks / memory / 模型分級 ⏳ | 在目標 repo 實測：主幹 commit、force push、spec 跳關改 status 皆被 exit 2 擋下且訊息可讀 |
| **P4 v0.5 換血** | OpenSpec 格式全面採納（init 接管 v1.x/v0.x、CLI 前置依賴、狀態機遷至 `.openspec.yaml`）、Builder 純執行層＋逐 task 隨行回報（回合制為進度可見契約的當前實作）、`/octopus:overview`、browser 驗證 opt-in、spec-status-guard 改寫 | ⏳ 設計完成、待實作 | 在真實 openspec repo：`/octopus:spec` 產出可過 `openspec validate` 的 change；build 逐 task 回報且勾選的 browser 驗證附截圖；archive 後 delta 正確合回主 spec；「code 已修、資料待補」的 change 能留開追蹤 |

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

- quick 與 change 的界線實際拿捏（用兩週後回頭調判準）
- 跨專案共用 Arena（個人層級的知識庫）要不要做
- 同事使用回饋進來後，是否需要「公司共用 review 規則」層（可由各專案/公司自帶規則檔，Reviewer 按檔案類型載入）
- roadmap 放 `openspec/roadmaps/` 的 CLI 容忍度（`openspec validate --all` 會不會抱怨非標準資料夾）——實作時實測
- `/opsx:*` 與 `/octopus:*` 共存的實際邊界（查詢類混用兩週後回頭看有沒有狀態漂移）
- v0.x legacy openspec 專案的接管細節（要不要代跑 `openspec update` 升級）——實作時對照官方 migration guide
- 進度可見契約的實作選擇（§5.2）：回合制讓同一個 builder 跨回合累積 context（雪球＋每回合往返成本）。可視性優先先這樣；成本咬人時可換 per-task 短命 builder（犧牲 context 連貫）或等 harness 串流承接——三者都不動契約與 Builder persona

---

## 10. 附錄：出場方案存檔

以下方案在設計過程中被砍，存檔備查；若未來情境改變（多人協作、接全棧、給 PM 用）可取回：

- **多角色協作中樞（v0）**：PM/FE/BE 各有入口；Feasibility 可行性卡片（六欄位）、Triage 前後端分流 agent、FE task 欄位規格、MSW mock 產出。出場原因：服務不存在的使用者
- **全棧雙 Builder（v0.x）**：+UI 前端專家（GD-Data 的前端鏡像）、Builder 拆 FE/BE、task 端別欄位確定性路由。出場原因：定位收斂為後端專用
- **UI/UX 設計官（v0.x）**：實作前出 design tokens/佈局，實作後「截圖→挑刺→修正」精緻度審查迴圈（上限 2~3 輪）。出場原因：同上
- **Guardian 治理 agent（v0.x）**：spec 狀態流轉的專職裁決者。出場原因：狀態流轉是確定性動作，hooks + command 就能做，不用 agent
- **自有 spec 格式（`specs/NNN-*`＋frontmatter status，v0.1~v0.3）**：含內建 EARS 範本 `templates/spec-template.md`、「範本跟著目標 repo 走」讓位規則。出場原因：v0.5 全面換血為 OpenSpec 格式——活文件＋change 生命週期原生支援「修復狀態追蹤」（code 已修、資料待補、未 archive＝留開），狀態機平移到 change 的 `.openspec.yaml`
- **擴編路線（若部署到團隊共用）**：意圖漂移檢查官（比對客戶原話＝糾紛留痕）、合約對齊驗收官（範圍對齊＝請款驗收）、UAT 測試官（客戶驗收測試）獨立成編——專案公司情境約 11~13 agent。原則：每多一條「對外部利害關係人的問責邊界」，加回一個守邊界的 agent
