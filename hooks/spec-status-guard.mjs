#!/usr/bin/env node
// spec-status-guard.mjs — Octopus spec 狀態機保護（PreToolUse / Edit|Write）
//
// 守的不變量（設計文件 §5.2 / §6.2）：spec frontmatter 的 status 只能單步順向
//   Draft → Locked → Implemented；禁回退、禁跳關、禁刪除或憑空插入 status 行；
//   新 spec 只能生為 Draft。
// 例外：回退／修復由 TPM 親手改檔（hook 只攔 Claude 的工具呼叫，攔不到人）。
// fail-open：hook 自身錯誤一律放行（exit 0），不卡流程。

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ORDER = { Draft: 0, Locked: 1, Implemented: 2 };
const STDIN_TIMEOUT_MS = 5000;
const RUN_MARKER_TTL_MS = 4 * 60 * 60 * 1000;
const LOOSE_STATUS_RE = /^status:[ \t]*(Draft|Locked|Implemented)\b/m;

/** 從完整檔案內容抽 frontmatter 內的 status（檔案不是 spec 回傳 null） */
export function statusFromFile(content) {
  if (typeof content !== "string" || !content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const fm = content.slice(0, end + 4);
  const m = fm.match(LOOSE_STATUS_RE);
  return m ? m[1] : null;
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
    "spec 狀態機只允許單步順向：Draft → Locked → Implemented（設計文件 §5.2）。",
    "回退或修復請 TPM 親手改檔——hook 只攔 Claude 的工具呼叫。",
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
  if (!filePath || !/\.md$/i.test(filePath)) return null;

  const existing = readFile(filePath);
  const fileStatus = statusFromFile(existing ?? "");

  if (toolName === "Write") {
    const newStatus = statusFromFile(toolInput.content ?? "");
    if (existing == null) {
      // 新建檔案：只有帶 spec status 的才管
      if (newStatus && newStatus !== "Draft") {
        return [
          `⛔ Octopus spec-status-guard 擋下：新 spec 不得直接以 ${newStatus} 建立。`,
          "spec 一律生為 Draft，經 TPM 拍板後由 command 流轉（Draft → Locked → Implemented）。",
        ].join("\n");
      }
      return null;
    }
    if (fileStatus == null) return null; // 既有檔不是 spec，不管
    if (newStatus == null) {
      return [
        "⛔ Octopus spec-status-guard 擋下：整檔覆寫移除了 spec 的 status frontmatter。",
        "status 行不得刪除；如需改 spec 內容請保留 frontmatter。",
      ].join("\n");
    }
    return checkTransition(fileStatus, newStatus);
  }

  if (toolName === "Edit") {
    if (fileStatus == null) return null; // 目標不是 spec，不管
    const oldTouch = statusFromFragment(toolInput.old_string);
    const newTouch = statusFromFragment(toolInput.new_string);
    if (oldTouch == null && newTouch == null) return null; // 沒動 status 行
    if (oldTouch != null && newTouch != null) {
      return checkTransition(oldTouch, newTouch);
    }
    return [
      "⛔ Octopus spec-status-guard 擋下：這個編輯會刪除或憑空插入 spec 的 status 行。",
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
