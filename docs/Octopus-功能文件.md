# Octopus 功能文件

> **版本**：v0.8.1
> **形式**：Claude Code plugin
> **本檔定位**：Octopus 的權威設計文件——**只寫「現在的行為是什麼」**。實作（agents/、commands/）一律從本檔推導；實作與本檔衝突時，回到本檔修訂後再改實作。
> **設計過程的思考痕跡不放這裡**：被砍掉的方案與砍掉的理由存於 [退場紀錄.md](退場紀錄.md)。

---

## 1. 概述與定位

### 1.1 命名由來

**一顆頭，多隻腳。** 頭是你——TPM（Technical Project Manager）；腳是各管一個領域的專家 agent，聽頭的指揮。腳的數量不追「章魚＝八」的字面，跟問責邊界走（§2）——目前為七隻。

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

### 1.4 第二公理：模式數量是複雜度的真正來源

功能多不可怕，**模式多才可怕**。每多一個執行模式（`auto` / `step`）、每多一條旁路（自動鎖定）、每多一種組織形態（epic），同一個概念就要在設計文件、command、agent 三處各解釋一次，而且會讓狀態欄位帶上多重意義。

判準：**新增分支前先問「刪掉它會壞什麼」**。答不出具體損失就不要加。v0.6 依此砍掉 `auto`、`step`、epic/roadmap 與管線內的 browser 驗證（理由見 [退場紀錄.md](退場紀錄.md)）。

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
| （Core） | 路由與編排——確定性，屬頭不佔腳 | — |

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
| 環境／設定查詢 agent | 讀固定格式的檔案是 Read，不是判斷；資料不是邊界 |

### 2.3 設計支柱（不縮的部分）

- **管線只服務需要 spec 的工作**（§5.3）：小事不進 Octopus，防流程形式主義
- **Arena 知識庫**（§6.1）：拍板決策跨 session 沉澱
- **hooks 紀律**（§6.2）：流程閘門用程式強制，不靠 agent 自覺
- **管線自我追蹤**（`metrics.md`，§6.1——用量與指標由管線收尾自動追記）

### 2.4 橫切機制（新增/修訂 agent 時的 checklist）

所有 agent 規格共用五個「防 LLM 天性」的機制——它們不在職責欄，在紅線欄與輸出格式欄，新增或修訂 agent 時逐項檢查：

1. **來源標註**：查證型 agent 的每個論斷標依據等級（權威／推導／文件示意／查無），查無不杜撰——防「聽起來合理」被說成事實
2. **預算上限**：互動與迴圈都有上限，且超限後的降級行為有定義（Analyst ≤3 問×2 輪後改帶假設判斷、Debugger ≤2 問、P1 退修 ≤3 輪後標紅收尾）——防無限深挖
3. **不可留白欄位**：輸出格式中「沒有就寫無」的強制誠實欄（Builder 自主決定、Reviewer 沒做什麼）——把「不提」變成格式違規
4. **負面表列紅線**：不准做什麼寫到動作級，權力靠「紅線＋tools 最小權限＋hooks」三層疊——防越權
5. **格式即介面**：輸出格式是 agent 之間的 API（tasks 的「需人眼確認」流進 Reviewer 高風險段、Builder 自主決定流進驗收報告開頭）——改格式＝改契約，要看下游

---

## 3. Agent 能力規格（七隻腳）

所有 agent 共用的紅線見 §6.4 誠實原則。

### 3.0 Core（編排——不是獨立 agent 檔）

路由與管線編排由 **commands + 主對話**承擔：明確 command（`/octopus:db` 等）直達對應 agent，零分類成本；只有自由提問需要意圖判斷。Core 不持有領域知識，不出現在 `agents/` 目錄。

### 3.1 Scout（考古官）

| | |
|---|---|
| 職責 | codebase 架構/慣例/依賴、git 演進（誰改的、為什麼、何時）、專案與 change 進度狀態；**專案鳥瞰（overview）**——分層架構、模組職責、依賴方向、關鍵流程走讀 |
| 輸入 | 自然語言提問；`/octopus:overview`（可指定聚焦範圍） |
| 輸出 | 帶來源標註的答案（`file:line`、commit hash、change 路徑）；overview 敘事報告 |
| 工具邊界 | 唯讀（Read/Grep/Glob/git log 類） |
| 紅線 | 查無必須明說；不憑記憶回答可以查證的事 |

**Overview 行為規格**：**說明優先、圖為輔**——輸出是敘事文件（分層架構、各模組職責一句話、依賴方向、2~3 條關鍵流程走讀），mermaid 圖只當配角，不做 graph-first 的知識圖譜（圖建得再全，說明能力差就沒有理解價值）。on-demand 生成、**不落檔**（Arena 原則：不沉澱可推導事實，每次拉都是現況）；來源標註紅線照舊。

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
| 職責 | 把 Analyst 的結構化需求寫成 OpenSpec change（proposal＋spec delta＋design（如需）＋tasks，格式見 §5.3）；方案有取捨時產出決策卡（§4.2）給 TPM 拍板；把 change 展開成 tasks |
| 輸入 | Analyst 的結構化需求（或 TPM 直接給的明確需求） |
| 輸出 | change 資料夾（`openspec/changes/<name>/`）＋決策卡 |
| 紅線 | delta 的每條 Requirement 必含至少一個可測 Scenario（GIVEN/WHEN/THEN）；寫不出可測情境＝需求沒釐清，退回 Analyst；只 Write change 資料夾，不碰實作 code、不碰 `openspec/specs/` 主 spec |

**一個需求＝一筆 change。** change 的天然邊界＝一次可獨立驗收、獨立 merge 的單位。需求大到裝不進一筆時，TPM 自己跑第二次 `/octopus:spec` 開第二筆——**Architect 不做自動拆分**（拆分判斷交給人，比讓它猜便宜）。

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
| 職責 | 從 Locked change 實作 code＋測試；每完成一條 task 出一則 task 回報 |
| 輸入 | Locked change + tasks（main/build 管線） |
| 輸出 | feature branch 上的 commits + 測試 + 每條 task 的 task 回報 + 最終變更摘要 |
| 紅線 | **一律在 feature branch 工作，絕不直接改主幹**（TPM 合併權的執行機制）；測試跟著實作走，不可宣稱完成而無測試（除非 change 明示免測並有理由） |

**純執行層**：Builder 的邊界是**實作紀律**與「不碰主幹」（§2.1），**不含派工節奏**。它實作被指派的 task，每完成一條就回一則 **task 回報**（做了什麼一~兩句／關鍵 code 導讀 `file:line`——改哪裡、為什麼／自主決定——spec 未釘死、自己拿主意的點），全部做完回最終變更摘要。逐 task 回報是誠實原則（§6.4）的延伸——讓工作可讀、讓 TPM 隨行看懂每條 task 對應的 code（守住「理解 vs 盲簽」邊界），**不論誰在編排、怎麼派工都成立**。「一次派一條、SendMessage 續派」是編排層（Core）在當前工具限制下的手段（§5.2），不是 Builder 的身份。

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

> **根因交接**：TPM 選定的修法會改變預期行為（或該行為從未寫進主 spec）→ 轉進 `/octopus:spec` 時**根因報告全文隨行**作為輸入；該 change 的 delta 必須把實際炸過的失敗案例編碼成至少一個 Scenario——回歸防護寫進 spec，Reviewer 逐條比對時自然涵蓋。

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

呈報時機分兩種：

- **拍板點呈報**——spec 的 OK 停點與諮詢情境：當場等 TPM 回答，回 OK＝全採建議選項
- **事後呈報**——執行段的保守預設決策：留痕後集中列在驗收報告開頭的「執行中自動拍板清單」，TPM 於驗收停點以否決權行使拍板

### 4.3 驗收出口：驗收報告（Reviewer）

驗收模式＝**報告放行為主，高風險變更點親掃**。報告必含四段，5 分鐘內可判斷：

```markdown
## 驗收報告：<change 名稱>

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

**頁面實測不進管線**：變更的效果需要在頁面上人眼確認時，Reviewer 在「高風險變更點」段落註明「建議親自在 <測試站/頁面> 確認 <什麼>」即可。管線不代跑瀏覽器——要它跑就明講（`/octopus:review` 之後直接叫主對話開頁面），這是一次性請求，不是流程步驟。

---

## 5. Commands 與管線

### 5.1 Command 總表

| Command | 用途 | 路由 |
|---|---|---|
| `/octopus:init` | 既有專案接機（一次性）：摸專案、偵測/建立 OpenSpec 結構、檢查 `openspec` CLI（缺則請使用者安裝）、盤點 change 狀態、建 Arena＋gitignore、交接報告 | Scout＋確定性檢查 |
| `/octopus:ask` | codebase/git/進度問答 | Scout 直答 |
| `/octopus:overview` | 專案鳥瞰：分層架構＋模組職責＋依賴方向＋關鍵流程走讀（§3.1） | Scout 直答 |
| `/octopus:db` | DB 三方言諮詢 | DBA 直答 |
| `/octopus:spec` | SDD 討論段（可獨立停住） | Analyst → Architect → change 落檔（proposal＋delta＋tasks）→【拍板 OK 停點】→ Locked |
| `/octopus:build <change>` | SDD 執行段（**全自主**） | 驗 Locked → Builder 逐 task 隨行回報 → Reviewer → P1 自動修（≤3 輪）→【驗收 merge】→ archive |
| `/octopus:main` | spec + build 連跑（拍板一個 OK 後全自主） | 上兩段串接，零重複邏輯 |
| `/octopus:debug` | 根因分析 | Debugger |
| `/octopus:review` | 單獨審查（不限管線產出） | Reviewer |

### 5.2 SDD 交付管線

設計原則：**討論集中在前段，拍板一個 OK，之後全自主執行、不中途等人**。TPM 在管線起點本來就在場（Analyst 反問），change 產出後只需回一個 **OK**（＝決策卡全採建議＋鎖定）就放手；執行段以**隨行回報**讓 TPM 看得到進度（每條 task 一則回報，單向呈現、不停等回覆），跑完帶回「驗證過的成品＋驗收報告＋執行中自動拍板清單」。

```
── 討論段（/octopus:spec 單獨跑，或 main 前半）──────
模糊需求
  → Analyst：反問釐清（≤3 問 ×≤2 輪）＋魔鬼代言人挑戰
  → Architect：change 一次產齊——proposal ＋ spec delta ＋ design（如需）＋ tasks
    ＋（如有取捨）決策卡
  → 落檔 openspec/changes/<name>/，.openspec.yaml 標 octopus.status: Draft
  →【拍板 OK 停點：TPM 看完整包（proposal 摘要＋決策卡＋tasklist），
     回 OK＝決策卡全採建議＋鎖定】→ command 改標 Locked
  → 不回 OK ＝ 保持 Draft，正常結束（改天再回來）
── 執行段（/octopus:build，全自主）─────────────────
  → 入口閘門：openspec CLI 缺 → 停，請使用者安裝；
              Draft → 停，呈現完整包請 TPM 拍板（同上停點）後才鎖定續跑；
              Implemented / 已歸檔 → 拒絕（已完工，建議開新 change）；
              缺 octopus.status → 停，請先補登
  → Builder 逐 task 派工：同一個 builder，一條 task——實作＋測試 → 返回 task 回報
    （做了什麼／code 導讀 file:line／自主決定）→ Core 轉呈 TPM ＋ todo 勾銷進度
    （不停等回覆）→ SendMessage 續派下一條，直到 tasks 做完
  → Reviewer：驗收報告
  → 有 P1？→ 自動退回同一個 builder 修 → 重審（迴圈，上限 3 輪；未清空→收尾標紅，不中途等人）
  →【唯一硬停點：TPM 驗收 → merge】→ command 改標 Implemented
  → 收尾：tasks 全勾 → 建議執行 openspec archive（delta 合回主 spec＋歸檔），TPM 點頭即跑；
          有未完 task（如舊資料 backfill）→ 不 archive，change 留開——「code 已修、舊資料待補」
          這類修復狀態就長在這裡
```

**為什麼 spec/build 拆兩段而不是 main 一條龍**：change 的討論與實作經常不在同一天（等確認、排隊、跨週）。change 必須是**可暫停、可累積、可回頭對賬的獨立交付物**——只活在對話裡的規格不是 SDD，是「動手前有先想」。`/octopus:main` 只是連跑糖衣。

**兩個停點，沒有第三個**：

| 停點 | 何時 | TPM 要做什麼 | 跳過的代價 |
|---|---|---|---|
| **拍板 OK** | change 落檔後 | 回一個 `OK`（或逐項提意見） | 方向全錯的整輪 build |
| **驗收 merge** | build 段尾 | 看報告後自行 merge（或明確同意代跑） | 失去合併權——不可跳過 |

`Locked` 只有一個意思：**TPM 拍板過了**。沒有自動鎖定的旁路——`/octopus:build` 遇到 Draft change 一律停下請拍板，拍完才跑。這是 `Locked` 保持單義的代價，也是它的價值。

**自主段的兩個契約**：自主執行段沒人逐步盯著，靠兩個契約維持 §4 的 TPM 介面不失真。

- **進度可見契約**：TPM 能漸進看到 build 進度，不是等整段跑完才一次看到成品。
  當前實作＝**回合制**：Core 逐條派 task 給同一個 builder（SendMessage 續派、context 連貫），每回合即時轉呈回報＋勾銷 todo、不停等回覆。原因是 Claude Code 的 subagent 輸出在它返回前 Core 看不到；harness 支援串流後可替換，Builder persona 不必改。
- **決策留存契約**：自主段每個自動決定（保守預設）都可回溯。當前實作＝Core 即時寫進 Arena `decisions.md`（跨 session 知識面），並在驗收報告開頭集中呈現「執行中自動拍板清單」（當次稽核面）。

**執行段不中途等人**——下列事件一律「保守預設＋留痕＋驗收報告集中呈報」：

- 高風險決策（spec 未涵蓋且涉及 migration / 權限認證 / 對外契約 / 不可逆）→ 取保守選項，以決策卡格式記錄
- P1 三輪修不乾淨 → 直接收尾出報告，如實標紅「修不掉的 P1 與原因」，不建議 merge
- 實作中發現 spec 矛盾 → 按最合理解釋標註後繼續，差異寫入報告，不自行竄改 spec delta

前提是 **Builder 紅線保證 branch 上一切可逆**——不 merge、不推主幹、migration 只產檔不執行。不 merge 即否決，代價只是白跑一輪 token。

**隨行回報不是停點**：逐 task 回報單向呈現、不停等回覆——TPM 隨時可以人為打斷，但管線不主動停。

**merge ≠ 結案（archive）**：merge 決定 code 進主幹；archive 決定 delta 合回主 spec、change 歸檔結案。兩權都在 TPM——tasks 未全完成（如資料修補待跑）可以先 merge code、change 留開繼續追蹤，archive 前 tasks 必須全數完成。

### 5.3 SDD 整合細節（OpenSpec）

- **檔案格式全面採用 OpenSpec**（Fission-AI/OpenSpec，v1.x）：`openspec/specs/<domain>/spec.md` 是「系統現況」的活文件（純 markdown，無 frontmatter）；每筆工作——新功能、bug 修復、資料修補——都是 `openspec/changes/<name>/` 一筆 change（proposal.md＋specs delta＋design.md（如需）＋tasks.md）；結案 archive 時 delta 合回主 spec（ADDED 附加／MODIFIED 整段取代／REMOVED 刪除），整夾移入 `changes/archive/YYYY-MM-DD-<name>/`
- **Octopus 狀態機掛在 change 上**：`changes/<name>/.openspec.yaml`（OpenSpec 官方未規範內容的中繼資料檔）寫入 `octopus.status: Draft / Locked / Implemented`；**狀態流轉只由 command 確定性寫入**，agent 一律無權改。Draft＝提案中、Locked＝TPM 拍板後執行中、Implemented＝已 merge；archive 後整夾移入 archive/ 即終態
- **`openspec` CLI 是前置依賴**：validate / archive 等確定性動作交給 CLI（code 能答的不用模型）；init 與 spec/build 入口檢查 CLI，缺則停下請使用者安裝（附官方安裝指引），**不自行模擬 CLI 行為**
- **與 `/opsx:*` 共存的立場**：`openspec init` 會在目標 repo 裝 OpenSpec 自己的 AI 工作流指令。查詢類（status/list/show/view）隨意用；**會動檔案的工作流（propose/apply/archive）建議走 `/octopus:*`**——feature branch 紀律、拍板停點、狀態機、守門 hook 只在 Octopus 管線內有保障，混用會造成狀態漂移
- **行為規格句式跟 OpenSpec 官方格式走**：`### Requirement:`（SHALL/MUST）＋`#### Scenario:`（GIVEN/WHEN/THEN），每條 Requirement 至少一個可測 Scenario——「行為必可測」的原則不變，句式讓位給 `openspec validate` 認得的結構。proposal 保留「目標與動機」脈絡（change 兼任業務故事）
- **管線只服務「改變預期行為」的工作**——判準不是改動大小，是 **spec 要不要變**：純缺陷修正（code 沒做到 spec 本來就寫的事）修完 spec 一個字不用改，沒有 delta 可寫，不進管線、直接在主對話處理；預期行為要變、或發現該行為從未被寫進主 spec，才開 change。這是刻意的邊界不是漏洞——代價是日常小修時無 run-marker，hooks 不生效（§6.2），主幹保護在 Octopus 之外靠 TPM 自律
- **完工文件同步（build 收尾，不另設停點）**：merge 後補 proposal 的「相關 API」表，並列出本次變更使哪些既有文件過時的建議更新清單
- **修復場景**：bug 修復＝開一筆 `fix-*` change；「code 已修、舊資料待補」＝tasks 部分打勾＋change 未 archive；結案時機（archive）由 TPM 控制——OpenSpec 官方查無「部署後修復追蹤」概念，這是 Octopus 賦予 change 生命週期的用法

---

## 6. 基建

### 6.1 Arena（Octopus 私有工作區，預設私有）

Arena（`.claude/.octopus-arena/`）是 Octopus 在目標 repo 的**唯一持久化落腳點**——所有足跡集中一個目錄：gitignore 一行、清理一處、hook 認一個路徑。三個住戶、三種性質，**新增住戶前先過 §1.4**：

| 住戶 | 性質 | 誰寫 | 誰讀 |
|---|---|---|---|
| `decisions.md` | 知識（拍板決策、翻案史） | Core（停點追記） | spec 前置讀取、Scout（決策類考古） |
| `.run` | 編排狀態（守門開關，§6.2） | Core（管線起訖） | hooks |
| `metrics.md` | 遙測（用量與指標） | Core（收尾追記） | TPM（彙整到 `docs/實測指標.md`） |

- **知識原則**：只沉澱「拍板過的決策與 Open Questions」，不沉澱可從 code 推導的事實（那些每次即時掃描，永不過時）。**通用記憶交給平台**（目標 repo 的 `CLAUDE.md`、auto-memory）——Octopus 只沉澱管線自己產生、平台記不了的東西
- **讀取接線**（decisions.md 不是只寫不讀）：`/octopus:spec` 落檔前由 Core 讀取相關舊決策附進 Analyst/Architect 的輸入——與舊拍板衝突時明標「翻案」開決策卡，防無痕翻案；Scout 回答「當初為什麼這樣定」時查 decisions.md（Arena 不進版控，git 考古看不到它）
- **`metrics.md`（append-only）**：init/spec/build 收尾時由 Core **確定性追記**本次 agent 呼叫用量（harness 回報的 subagent tokens）與段落小計——spec 小計附拍板往返次數、build 小計附 P1 退修輪數與攔截 P1/P2 數，服務 §8 四指標。fail-open：用量拿不到記「查無」、追記失敗不阻塞管線；agent 一律無權寫 metrics。跨專案彙整與讀數判準見 `docs/實測指標.md`（octopus repo，手動彙整）
- **知識面 vs 稽核面的分工**：`decisions.md` 是**跨 session 知識**（哪些決策拍過、為什麼），供日後回想；「這一輪 build 是否誠實執行」的**稽核**由驗收報告的「執行中自動拍板清單」與 feature branch commit 史承擔
- **預設加入目標 repo 的 `.gitignore`**：同事在同一公司 repo 各自用 Octopus 時，Arena 寫進 git 會默默變成共用狀態，違反「各自使用」的部署前提。想升級成團隊共享知識庫時，拿掉 gitignore 那行即可

### 6.2 流程閘門

**Command 層**：閘門寫在 command 的確定性步驟裡（build 入口先 Read change 的 `.openspec.yaml`：`Draft` 停下請拍板、`Implemented` 拒絕、缺 status 停下要求補登；Builder agent 動工前自驗 `Locked`＝雙重檢查；狀態流轉只由 command Edit）。

**程式化 hooks 備援**：plugin 附帶 PreToolUse hooks（`hooks/hooks.json`），防 agent 被說服繞過 prompt 層閘門。挑選標準＝「失守代價最大的兩條紅線」。工程慣例：純 node、零相依、**fail-open**（hook 自身故障一律放行，不卡流程）、判斷邏輯以 `evaluate()` export 可獨立驗證、擋下訊息 zh-TW 並附解法。

**熱路徑成本**（hook 是 user-scope，每個專案的每次工具呼叫都會跑）：hook 必須先用純字串判斷確認「這次呼叫可能踩到不變量」，才做任何昂貴動作（spawn 子行程、讀檔）。`branch-guard` 由此定下不變量：**指令不含 `git` 時直接 exit 0，不查分支**。子行程只為真正需要 `branch` 的規則（主幹上的 `git commit`、裸 `git push`）而開。

**生效範圍——守門跟著管線走**：機械守門真正要保護的對象是**全自主執行段裡沒人盯著的 agent**，不是使用者日常指揮的 Claude。實作為 **run-marker**：管線 command（spec/build/main）起跑時寫入 `.claude/.octopus-arena/.run`（ISO 8601 時間戳，一行），收尾時刪除。兩支 hook 做任何昂貴動作前，先從 payload `cwd` 往上找 `.run`——**存在且未過期（TTL 4 小時）才啟動守門，否則直接 exit 0**。TTL 是 crash 殘留的兜底。推論：

- 日常工作（無管線在跑）hook 零干預——含 merge、worktree 操作、主幹 commit
- 管線收尾後 TPM 叫 Claude merge，**不再需要 `OCTOPUS_TPM_OK=1` 前綴**（marker 已清）；同意通道保留供執行中的例外
- `/octopus:init` 是純粹的「理解專案＋建 Arena」，不隱含開啟管制
- 判定不了（讀檔錯誤、時間戳無法解析等）視為無有效 marker，fail-open 放行

**阻塞等待一律要有上界**：hook 卡住的代價是整個工具呼叫卡住。凡是等外部的動作都要能自己逾時，逾時即 fail-open 放行：

- 讀 stdin payload 用**非同步讀＋逾時**（`readStdin()`，5s）。**不可用 `readFileSync(0)`**——它同步阻塞 event loop 直到 EOF，harness 沒關 stdin 就永遠不返回，而且 `setTimeout` 看門狗此時根本觸發不了
- spawn 子行程一律給 `timeout`（`branch-guard` 查分支：3s），失敗或逾時退回 `branch = null`，只做不需分支的檢查

| Hook | 攔截 | 守的不變量 | 例外（留痕） |
|---|---|---|---|
| `hooks/branch-guard.mjs` | PreToolUse(Bash) | **主幹保護**：擋「在 main/master 上 `git commit` / `git push`」「push 到 main/master」「`git merge`（`--abort`/`--quit` 善後除外）」「任何 force push」；同一指令串內 `checkout`/`switch` 換到主幹也會被追蹤 | TPM 明確同意時在指令前加 `OCTOPUS_TPM_OK=1 `——例外寫在指令裡＝可稽核；同意後 Claude 直接前綴重跑，不重複請示 |
| `hooks/spec-status-guard.mjs` | PreToolUse(Edit\|Write) | **change 狀態機**：`octopus.status` 只能單步順向 `Draft → Locked → Implemented`，禁回退、禁跳關、禁刪除或憑空插入；新 change 只能生為 `Draft` | 回退/修復由 TPM 親手改檔（hook 只攔 Claude 的工具呼叫）；`openspec archive` 走 CLI（Bash），不經此 hook |

界線：hook 守**確定性不變量**（程式能判定的）；鎖定的時序仍由 command 流程負責——hook 只驗「單步順向」，無從也無需得知這一步是誰確認的。這條界線是刻意的，不要試圖用 hook 驗語意。

**Phase 3 其餘備援（未做）**：

| 時機 | 驗什麼 |
|---|---|
| SubagentStart | Builder 動工前必有 tasks/TODO 清單 |
| SubagentStop | Reviewer 報告必含「高風險變更點」段落；Builder 產出必在 feature branch 上 |
| build 入口 | change 的 `octopus.status` 為 `Implemented` 或缺失 → 程式直接擋下（現由 command 步驟＋Builder 雙重檢查） |

### 6.3 寫入隔離：feature branch

每個交付任務（main/build 涉及改 code 者）開 feature branch；**merge 權永遠在 TPM 手上**。

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
- WHEN 方案存在實質取捨，Architect SHALL 以決策卡呈現，SHALL NOT 自行拍板
- 一個需求 SHALL 產出一筆 change；SHALL NOT 自動拆分為多筆（需求過大時由 TPM 自行再跑一次 spec）

**DBA**
- WHEN 使用者指定 DB，回答 SHALL 針對該 DB；WHEN 未指定，SHALL 並列三方言差異
- 回答涉及實際 schema 時 SHALL 引用 schema/migration 檔，SHALL NOT 憑空假設欄位存在

**Builder（純執行層）**
- Builder 動工前 SHALL 自驗 change 為 Locked（與 command 入口構成雙重檢查）
- Builder SHALL 每完成一條 task 返回一則 task 回報（做了什麼／code 導讀 file:line／自主決定）；此為工作可讀，SHALL NOT 因無人催而省略
- 所有 code 變更 SHALL 發生在 feature branch；SHALL NOT 直接改主幹、merge、force push 或改 octopus.status
- Builder 職責 SHALL NOT 含派工節奏——一次派一條或整批、如何轉呈 TPM 由編排層（Core）決定

**Scout（overview）**
- WHEN 使用者要求專案鳥瞰，Scout SHALL 即時生成敘事型 overview（分層/職責/依賴/關鍵流程走讀）並標註來源；SHALL NOT 將 overview 落檔沉澱

**OpenSpec 相容**
- init SHALL 偵測既有 `openspec/`（v1.x 與 v0.x legacy）並接管，不重複建立；WHEN `openspec` CLI 缺失，init/spec/build SHALL 停下請使用者安裝，SHALL NOT 自行模擬 CLI 行為
- archive SHALL 經 TPM 同意後以 CLI 執行；WHEN tasks 未全數完成，SHALL NOT 執行 archive（change 留開＝修復追蹤中）

**Reviewer**
- 驗收報告 SHALL 逐條對應 spec 驗收標準，無遺漏
- WHEN 變更涉及 migration/交易/權限/對外介面，SHALL 列入高風險變更點段落（含 file:line）
- WHEN 變更觸及含多步寫入的 API 且無交易保護，SHALL 列為高風險變更點並依後果評 P1/P2，SHALL NOT 因改動幅度小而略過檢查
- WHEN 變更的效果需在頁面上人眼確認，SHALL 於高風險變更點註明建議親自確認的內容；SHALL NOT 由管線代跑瀏覽器

**完工文件同步（build 收尾）**
- WHEN merge 完成，管線 SHALL 補 proposal 相關 API 表並列出受影響既有文件的建議更新清單；SHALL NOT 為此新增停點

**停點模型**
- 整條管線 SHALL 只有兩個停點：拍板 OK（change 落檔後）與驗收 merge（build 段尾）；SHALL NOT 存在第三個停點或跳過任一停點的旁路模式
- `octopus.status: Locked` SHALL 只在 TPM 明確拍板後由 command 寫入；SHALL NOT 有自動鎖定路徑
- WHEN `/octopus:build` 收到 Draft change，SHALL 停下呈現完整包請 TPM 拍板，SHALL NOT 自動鎖定後續跑

**自主執行（build 管線）**
- WHILE 自主執行，管線 SHALL NOT 中途暫停等待 TPM 回答；執行中決策 SHALL 以「保守預設＋留痕」處理並於驗收報告開頭集中呈報
- 進度可見契約：自主段 SHALL 讓 TPM 漸進看到進度；當前實作為 Core 逐條派 task 給同一 builder、每條回報即時轉呈，SHALL NOT 停等回覆——此為實作手段，harness 就緒後可替換而契約不變
- WHEN 遇到 spec 未涵蓋的高風險決策（migration/權限/對外契約/不可逆），管線 SHALL 取保守選項並以決策卡格式留痕，SHALL NOT 執行任何效果逃出 feature branch 的動作
- WHEN P1 退修達 3 輪仍未清空，管線 SHALL 收尾出報告並標明「修不掉的 P1 與原因」，SHALL NOT 建議 merge、SHALL NOT 中途空等
- WHEN 實作中發現 spec 矛盾，管線 SHALL 按最合理解釋標註後繼續並將差異寫入報告，SHALL NOT 竄改 spec
- 驗收 merge 停點 SHALL 要求使用者明確回答；代為 merge SHALL 以 `OCTOPUS_TPM_OK=1 ` 前綴留痕（若被攔），SHALL NOT 於使用者已明確同意後重複請示
- 自主過程中的所有自動決定 SHALL 留紀錄可回溯

**守門（run-marker）**
- 管線 command（spec/build/main）SHALL 於起跑寫入 `.claude/.octopus-arena/.run`（ISO 時間戳）、於收尾刪除
- WHEN 無有效 marker（不存在、逾 TTL 4 小時、或無法判讀），hooks SHALL 直接放行（exit 0）
- WHEN marker 有效，hooks SHALL 執行 §6.2 表列攔截；`OCTOPUS_TPM_OK=1` 同意通道 SHALL 保留

**全體**
- 每個回答 SHALL 標註來源等級（§6.4）；WHEN 查無依據，SHALL 明說，SHALL NOT 杜撰

---

## 8. 實作分期

| Phase | 內容 | 狀態 | 完成判準 |
|---|---|---|---|
| **P1 諮詢** | Scout / Analyst / DBA + ask / db | ✅ 已實作 | 在真實 repo 裝上後：`/octopus:db` 問三方言問題、`/octopus:ask` 問 codebase 問題，回答含來源標註 |
| **P2 SDD 交付管線** | Architect / Builder / Reviewer / Debugger + spec / build / main / debug / review + command 層流程閘門 + Arena 決策沉澱 | ✅ 已實作 | 拿一個真實 SDD 專案走完 spec→Locked→build→驗收報告→merge 全程 |
| **P3 基建** | 程式化 hooks 備援、Arena 讀取接線（spec 前置讀取＋Scout 決策考古——取代原「session memory + `/octopus:recall`」構想，理由見退場紀錄）、模型分級（改為帶觸發條件的判準：實測佔比數據進來才動 frontmatter，見 `docs/實測指標.md` 讀數判準） | 🔶 部分完成：hooks 第一批 ✅、Arena 接線 ✅（v0.8）；其餘 hooks ⏳、模型分級等實測數據 | 在目標 repo 實測：主幹 commit、force push、spec 跳關改 status 皆被 exit 2 擋下且訊息可讀 |
| **P4 OpenSpec 換血** | OpenSpec 格式全面採納（init 接管 v1.x/v0.x、CLI 前置依賴、狀態機遷至 `.openspec.yaml`）、Builder 純執行層＋逐 task 隨行回報、`/octopus:overview`、spec-status-guard 改寫 | ⏳ 設計完成、待實測 | 在真實 openspec repo：`/octopus:spec` 產出可過 `openspec validate` 的 change；build 逐 task 回報；archive 後 delta 正確合回主 spec；「code 已修、資料待補」的 change 能留開追蹤 |
| **P5 減法** | 砍 `auto`／`step`／epic+roadmap／管線內 browser 驗證；停點收斂為兩個；`Locked` 恢復單義；設計文件瘦身 | ✅ 已實作（v0.6） | 全 repo 掃不到 auto/step/epic/roadmap/browser 的管線語意殘留；停點表只有兩列 |
| **P6 入口減法** | 砍 `/octopus:quick`（實測從未使用）與 `/octopus:tasks`（規格重複）；管線判準改為「spec 要不要變」；Architect 章節重組（tasklist 規格獨立成節） | ✅ 已實作（v0.7） | 全 repo 掃不到 quick/tasks 指令殘留；指令數 11→9；architect.md 不再有「情境 B」這個並列模式 |
| **P7 自我治理** | Arena 定位改「私有工作區」（三住戶）＋ `metrics.md` 用量追蹤；Arena 讀取接線；debug→spec 根因交接；幽靈分片與 recall 構想退場；版更收尾紀律（CLAUDE.md）；§2.4 橫切機制 checklist | ✅ 已實作（本版） | 反向對帳通過：設計文件宣稱的每個產物/行為在 commands/agents 有對應 |

**下一步優先於加功能**：拿兩個真實專案各跑三筆 change，補上四個指標——返工率、缺陷攔截數、每筆交付 TPM 回答次數、token 成本。§9 的 Open Questions 多半要靠使用回答，不靠設計回答。

---

## 9. 風險與 Open Questions

### 風險

| 風險 | 緩解 |
|---|---|
| main 管線多輪 token 成本 | 不改變預期行為的小事不進管線（§5.3）；Analyst 兩輪上限 |
| 杜撰 schema/契約 | 四級來源標註 + 查無明說（§6.4） |
| Builder 寫壞 code | feature branch 隔離 + TPM 驗收才 merge |
| Reviewer 單點誤判 | solo 本來就沒有更多眼睛——接受，但高風險變更點強制 TPM 親掃 |
| spec 形式主義（小事也走全管線） | 判準是「spec 要不要變」，不是改動大小（§5.3） |
| 日常小修完全無守門（無 marker → hooks 不生效） | 接受——管線外的紀律本來就靠 TPM；Octopus 不假裝全覆蓋 |
| Arena 與 code 失同步 | 只沉澱決策、不沉澱可推導事實 |
| 功能與模式再度膨脹 | §1.4 第二公理：新增分支前先答「刪掉它會壞什麼」 |

### Open Questions（待使用後拍板）

- 「spec 要不要變」這條判準在真實 itracker 卡上好不好判（用兩週後回頭看：有沒有出現「以為是缺陷、其實是預期行為要變」的誤判）
- 既有專案主 spec 為空時，如何把「本來就對的行為」補進 `openspec/specs/`——目前唯一寫入路徑是 archive 一筆 change，缺一個正式入口
- 跨專案共用 Arena（個人層級的知識庫）要不要做
- `/opsx:*` 與 `/octopus:*` 共存的實際邊界（查詢類混用兩週後回頭看有沒有狀態漂移）
- v0.x legacy openspec 專案的接管細節（要不要代跑 `openspec update` 升級）
- 進度可見契約的實作成本：回合制讓同一個 builder 跨回合累積 context（雪球＋每回合往返成本）。成本咬人時可換 per-task 短命 builder 或等 harness 串流承接——都不動契約與 Builder persona
- 目標專案的環境資訊（測試站/正式站）該不該由 `/octopus:init` 問一次並寫進目標 repo 的 `CLAUDE.md`——待實作

> 被砍掉的方案與砍掉的理由：見 [退場紀錄.md](退場紀錄.md)。
