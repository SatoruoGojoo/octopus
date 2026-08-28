#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 SatoruoGojoo
// branch-guard.test.mjs — evaluate() 的獨立驗證
//
// 存在理由（設計文件 §6.2）：hook 的判斷邏輯以 evaluate() export，就是為了「可獨立驗證」。
// 這支檔案兌現那句承諾。零相依、用 node 內建 test runner，與 hooks 的工程慣例一致。
//
// 跑法：專案根執行 node --test（自動搜尋 *.test.mjs）

import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./branch-guard.mjs";

const blocked = (cmd, branch) =>
  assert.ok(evaluate(cmd, branch), `應擋下但放行了：${JSON.stringify(cmd)} @${branch}`);
const allowed = (cmd, branch) =>
  assert.equal(evaluate(cmd, branch), null, `應放行但擋下了：${JSON.stringify(cmd)} @${branch}`);

// ---------------------------------------------------------------------------
// 守的不變量：merge 權永遠在 TPM 手上（設計文件 §6.2 / §6.3）。
// 這四條失守的代價＝Builder 繞過驗收停點動了主幹，TPM 的否決權就形同虛設。
// ---------------------------------------------------------------------------
test("主幹保護：四條紅線", () => {
  blocked("git commit -m x", "master");                    // 直接改主幹
  blocked("git push", "master");                           // 主幹上裸 push（推的就是主幹）
  blocked("git push origin main", "feature/x");            // 明示推到主幹
  blocked("git merge feat", "feature/x");                  // merge 需 TPM 點頭
  blocked("git push --force origin feat", "feature/x");    // force push 一律擋（歷史不可逆）
  blocked("git push --force-with-lease origin f", "feature/x");
});

// ---------------------------------------------------------------------------
// 拆段的意義：一條指令串可能藏多個指令，逐段檢查才擋得住「先切主幹再動手」。
// 迴歸案例——換行版本曾經漏擋：命中 checkout 的分支追蹤會 continue 掉整個 segment，
// 若換行不切段，同段後續的 commit/push 就永遠不會被檢查到。
// ---------------------------------------------------------------------------
test("拆段：切到主幹後的動作要被追蹤", () => {
  blocked("git checkout main && git commit -m x", "feature/x");   // && 串接
  blocked("git checkout main\ngit commit -m x", "feature/x");     // 換行（曾漏擋）
  blocked("git switch master\ngit push", "feature/x");            // 換行 + switch
  blocked("git checkout main\r\ngit commit -m x", "feature/x");   // CRLF（Windows）
  blocked("git checkout main; git commit -m x", "feature/x");     // 分號
});

// ---------------------------------------------------------------------------
// 同意條的意義：hook 判定不了「TPM 同意了沒」（§6.2 界線：hook 不驗語意），
// 所以用指令前綴把同意帶進 hook 視野。錨定開頭是為了讓「留痕可稽核」真的成立——
// 若不錨定，同意條可被藏進註解或中段，痕跡就失去可見性。
// ---------------------------------------------------------------------------
test("同意條：只認指令開頭的前綴", () => {
  allowed("OCTOPUS_TPM_OK=1 git merge feat", "feature/x");
  allowed("  OCTOPUS_TPM_OK=1 git merge feat", "feature/x");      // 前導空白容許
  blocked("git merge feat # OCTOPUS_TPM_OK=1", "feature/x");      // 藏在註解（曾放行）
  blocked("git merge feat && OCTOPUS_TPM_OK=1 ls", "feature/x");  // 藏在中段（曾放行）
});

// ---------------------------------------------------------------------------
// 誤擋的代價比漏擋更高：hook 是 user-scope，每次 Bash 呼叫都會跑。
// 擋錯一次就是擋住正常工作，使用者會直接把 plugin 拔掉。
// ---------------------------------------------------------------------------
test("不得誤擋：feature branch 上的正常工作", () => {
  allowed("git commit -m x", "feature/x");
  allowed("git push origin feat/x", "feature/x");
  allowed("git add .\ngit commit -m x", "feature/x");
  allowed("git merge --abort", "feature/x");                      // 善後動作，非 merge 本身
  allowed("git checkout -b feat/y\ngit commit -m x", "master");   // 開新分支後就不在主幹了
  allowed("echo hi\nls -la", "master");                           // 不含 git，提前放行
});
