#!/usr/bin/env node
// branch-guard.mjs — Octopus 主幹保護（PreToolUse / Bash）
//
// 守的不變量（設計文件 §6.2 / §6.3）：merge 權永遠在 TPM 手上。
//   擋：在 main/master 上 git commit / git push、push 到 main/master、
//       git merge（--abort / --quit 善後除外）、任何 force push。
// 例外（留痕）：指令前綴 OCTOPUS_TPM_OK=1 ＝ TPM 明確同意，放行——例外寫在指令裡＝可稽核。
// fail-open：hook 自身錯誤一律放行（exit 0），不卡流程。

import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MAINLINES = ["main", "master"];

/**
 * 純判斷邏輯（可獨立驗證）。
 * @param {string} command  Bash 工具收到的指令字串
 * @param {string|null} currentBranch  執行當下的分支（查不到給 null）
 * @returns {string|null}  要擋下時回傳訊息，放行回傳 null
 */
export function evaluate(command, currentBranch) {
  if (!command || typeof command !== "string") return null;
  if (/\bOCTOPUS_TPM_OK=1\b/.test(command)) return null;

  // 粗粒度拆段：&&、||、;、| 視為潛在獨立指令，逐段檢查
  const segments = command
    .split(/&&|\|\||;|\|/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 追蹤指令串內的分支切換（git checkout main && git commit 這種繞法）
  let branch = currentBranch;

  for (const seg of segments) {
    if (!/\bgit\b/.test(seg)) continue;

    // 分支切換追蹤：checkout/switch 到既有分支（-b/-c 開新分支則取新名）
    const sw = seg.match(
      /\bgit\b[^\n]*\b(?:checkout|switch)\b\s+(?:(?:-b|-c)\s+(\S+)|(?!-)(\S+))/
    );
    if (sw) {
      const target = sw[1] || sw[2];
      if (target && !target.startsWith("-")) branch = target;
      continue;
    }

    // 1) force push：一律擋
    if (
      /\bgit\b[^\n]*\bpush\b/.test(seg) &&
      /(\s--force(-with-lease|-if-includes)?\b|\s-f\b)/.test(seg)
    ) {
      return [
        "⛔ Octopus branch-guard 擋下 force push。",
        "紅線：絕不 force push（設計文件 §3.4 Builder 紅線）。",
        "若 TPM 已明確同意，請在指令最前面加上 OCTOPUS_TPM_OK=1 再執行（留痕）。",
      ].join("\n");
    }

    // 2) git merge：merge 權在 TPM（--abort / --quit 是善後，放行）
    if (
      /\bgit\b[^\n]*\bmerge\b/.test(seg) &&
      !/--abort\b|--quit\b/.test(seg)
    ) {
      return [
        "⛔ Octopus branch-guard 擋下 git merge。",
        "merge 權永遠在 TPM 手上（硬停點二）——請 TPM 自行 merge。",
        "若 TPM 已明確同意由 Claude 代為執行，請在指令最前面加上 OCTOPUS_TPM_OK=1 再執行（留痕）。",
      ].join("\n");
    }

    // 3) push 明示指到主幹（git push origin main / HEAD:main）
    const push = seg.match(/\bgit\b[^\n]*\bpush\b(.*)$/);
    if (push) {
      const rest = push[1] || "";
      const hitMain = MAINLINES.find((b) =>
        new RegExp(`(^|\\s|:)${b}(\\s|$)`).test(rest)
      );
      if (hitMain) {
        return [
          `⛔ Octopus branch-guard 擋下 push 到 ${hitMain}。`,
          "主幹只能由 TPM 更新（Builder 紅線：一律 feature branch）。",
          "請改 push feature branch；TPM 明確同意時加 OCTOPUS_TPM_OK=1 前綴（留痕）。",
        ].join("\n");
      }
      // 4) 人在主幹上的任何 push（裸 push 預設推當前分支）
      if (branch && MAINLINES.includes(branch)) {
        return [
          `⛔ Octopus branch-guard 擋下在主幹（${branch}）上的 git push。`,
          "請先切到 feature branch（git checkout -b feat/...）再作業。",
          "TPM 明確同意時加 OCTOPUS_TPM_OK=1 前綴（留痕）。",
        ].join("\n");
      }
    }

    // 5) 在主幹上 commit
    if (
      /\bgit\b[^\n]*\bcommit\b/.test(seg) &&
      branch &&
      MAINLINES.includes(branch)
    ) {
      return [
        `⛔ Octopus branch-guard 擋下在主幹（${branch}）上的 git commit。`,
        "紅線：一律在 feature branch 工作，絕不直接改主幹。",
        "請先開分支（git checkout -b feat/...）；TPM 明確同意時加 OCTOPUS_TPM_OK=1 前綴（留痕）。",
      ].join("\n");
    }
  }

  return null;
}

async function main() {
  try {
    const { readFileSync } = await import("node:fs");
    const payload = JSON.parse(readFileSync(0, "utf8"));
    if (payload.tool_name !== "Bash") process.exit(0);

    const command = payload.tool_input?.command || "";
    let branch = null;
    try {
      branch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: payload.cwd || process.cwd(),
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      })
        .toString()
        .trim();
    } catch {
      /* 不在 git repo / git 不在 → branch=null，僅做不需分支的檢查 */
    }

    const message = evaluate(command, branch);
    if (message) {
      process.stderr.write(message);
      process.exit(2);
    }
    process.exit(0);
  } catch {
    process.exit(0); // fail-open
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
