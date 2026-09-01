#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 SatoruoGojoo
// spec-status-guard.mjs — Octopus change 狀態機保護（PreToolUse / Edit|Write）
//
// 守的不變量（設計文件 §5.3 狀態機 / §6.2 hook 表，v0.5 OpenSpec 換血後）：
//   change 中繼資料檔 changes/<name>/.openspec.yaml 的 octopus.status 只能單步順向
//   Draft → Locked → Implemented；禁回退、禁跳關、禁從既有檔移除；
//   新 change 只能生為 Draft。
// 補登例外：檔案原本沒有 octopus.status（init 補登）→ 放行插入，不限值（TPM 確認過）。
// 例外：回退／修復由 TPM 親手改檔（hook 只攔 Claude 的工具呼叫，攔不到人）。
// fail-open：hook 自身錯誤一律放行（exit 0），不卡流程。

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ORDER = { Draft: 0, Locked: 1, Implemented: 2 };
const STDIN_TIMEOUT_MS = 5000;
const RUN_MARKER_TTL_MS = 4 * 60 * 60 * 1000;
const TARGET_FILE_RE = /[\\/]\.openspec\.ya?ml$/i;
const LOOSE_STATUS_RE = /(?:^|\n)[ \t]*status:[ \t]*(Draft|Locked|Implemented)\b/;

/**
 * 從完整檔案內容抽 octopus: 區塊底下的 status（找不到回傳 null）。
 * 零相依的行掃描：定位頂層 `octopus:` 行，往下只看縮排行，撞到下一個頂層 key 停。
 */
export function statusFromFile(content) {
  if (typeof content !== "string") return null;
  const lines = content.split(/\r?\n/);
  let inOctopus = false;
  for (const line of lines) {
    if (/^octopus:[ \t]*(#.*)?$/.test(line)) {
      inOctopus = true;
      continue;
    }
    if (!inOctopus) continue;
    if (/^\S/.test(line)) break; // 下一個頂層 key，octopus 區塊結束
    const m = line.match(/^[ \t]+status:[ \t]*(Draft|Locked|Implemented)\b/);
    if (m) return m[1];
  }
  return null;
}

/** 從字串片段（old_string / new_string）抽 status（片段沒碰 status 行回傳 null） */
function statusFromFragment(fragment) {
  if (typeof fragment !== "string") return null;
  const m = fragment.match(LOOSE_STATUS_RE);
  return m ? m[1] : null;
}

function checkTransition(from, to) {
  if (from === to) return null;
  if (ORDER[to] === ORDER[from] + 1) return null; // 單步順向 OK（拍板時序由 command 流程把關）
  return [
    `⛔ Octopus spec-status-guard 擋下狀態變更 ${from} → ${to}。`,
    "change 狀態機只允許單步順向：Draft → Locked → Implemented（設計文件 §5.3）。",
    "回退或修復請 TPM 親手改 .openspec.yaml——hook 只攔 Claude 的工具呼叫。",
  ].join("\n");
}

/**
 * 純判斷邏輯（可獨立驗證）。
 * @param {string} toolName  "Edit" | "Write"
 * @param {object} toolInput 工具參數
 * @param {(p: string) => string|null} readFile  讀檔函式（不存在回傳 null；供測試注入）
 * @returns {string|null} 要擋下時回傳訊息，放行回傳 null
 */
export function evaluate(toolName, toolInput, readFile = defaultReadFile) {
  const filePath = toolInput?.file_path;
  if (!filePath || !TARGET_FILE_RE.test(filePath)) return null;

  const existing = readFile(filePath);
  const fileStatus = statusFromFile(existing ?? "");

  if (toolName === "Write") {
    const newStatus = statusFromFile(toolInput.content ?? "");
    if (existing == null) {
      // 新建 change：只有帶 octopus.status 的才管
      if (newStatus && newStatus !== "Draft") {
        return [
          `⛔ Octopus spec-status-guard 擋下：新 change 不得直接以 ${newStatus} 建立。`,
          "change 一律生為 Draft，經 TPM 拍板後由 command 流轉（Draft → Locked → Implemented）。",
        ].join("\n");
      }
      return null;
    }
    if (fileStatus == null) return null; // 既有檔還沒登記 octopus.status（init 補登），不管
    if (newStatus == null) {
      return [
        "⛔ Octopus spec-status-guard 擋下：整檔覆寫移除了 change 的 octopus.status。",
        "octopus.status 不得從既有 .openspec.yaml 移除；如需改其他中繼資料請保留該欄位。",
      ].join("\n");
    }
    return checkTransition(fileStatus, newStatus);
  }

  if (toolName === "Edit") {
    if (fileStatus == null) return null; // 檔案還沒有 octopus.status（init 補登插入），不管
    const oldTouch = statusFromFragment(toolInput.old_string);
    const newTouch = statusFromFragment(toolInput.new_string);
    if (oldTouch == null && newTouch == null) return null; // 沒動 status 行
    if (oldTouch != null && newTouch != null) {
      return checkTransition(oldTouch, newTouch);
    }
    return [
      "⛔ Octopus spec-status-guard 擋下：這個編輯會刪除或重複插入 change 的 octopus.status。",
      "status 只能單步順向流轉（Draft → Locked → Implemented），不得移除或重複。",
    ].join("\n");
  }

  return null;
}

function defaultReadFile(p) {
  try {
    if (!existsSync(p)) return null;
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/**
 * 守門跟著管線走（設計文件 §6.2）：從 cwd 往上找 .claude/.octopus-arena/.run
 * （管線 command 起跑寫入 ISO 時間戳、收尾刪除）。存在且未逾 TTL 才啟動守門——
 * 日常工作（無管線在跑）hook 零干預；TTL 是 crash 殘留 marker 的兜底。
 * 判定不了（讀檔錯誤、時間戳無法判讀等）回傳 false，fail-open 放行。
 */
export function pipelineActive(startDir, now = Date.now()) {
  try {
    let dir = resolve(startDir || process.cwd());
    while (true) {
      const marker = join(dir, ".claude", ".octopus-arena", ".run");
      if (existsSync(marker)) {
        const ts = Date.parse(readFileSync(marker, "utf8").trim());
        return Number.isFinite(ts) && now - ts < RUN_MARKER_TTL_MS;
      }
      const parent = dirname(dir);
      if (parent === dir) return false;
      dir = parent;
    }
  } catch {
    return false;
  }
}

/**
 * 非同步讀 stdin，逾時回傳 null（fail-open）。
 * 不用 readFileSync(0)：它同步阻塞直到 EOF，harness 沒關 stdin 就永不返回，
 * 且此時 event loop 已卡死，setTimeout 看門狗救不了（設計文件 §6.2）。
 */
function readStdin(timeoutMs) {
  return new Promise((resolve) => {
    let data = "";
    const done = (value) => {
      clearTimeout(timer);
      process.stdin.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => done(data));
    process.stdin.on("error", () => done(null));
  });
}

async function main() {
  try {
    const raw = await readStdin(STDIN_TIMEOUT_MS);
    if (raw == null) process.exit(0); // 讀不到 payload → fail-open
    const payload = JSON.parse(raw);
    if (payload.tool_name !== "Edit" && payload.tool_name !== "Write") {
      process.exit(0);
    }
    if (!pipelineActive(payload.cwd)) process.exit(0); // 守門跟著管線走
    const message = evaluate(payload.tool_name, payload.tool_input || {});
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
