// Content script — LeetCode page integration, accepted detection, button injection.

import { leetcodeAdapter } from "../integrations/leetcode/index.js";

const BUTTON_ID = "gitlee-sync-btn";
const BUTTON_CONTAINER_ID = "gitlee-btn-container";

let currentState = "idle"; // idle | committing | committed | failed
let disconnectWatcher = null;
let lastInjectedUrl = null;
let readinessAttempt = 0;

function log(msg) {
  console.log(`[GitLee] ${msg}`);
}

// ─── Button ──────────────────────────────────────────────────────────────────

function createSyncButton() {
  const container = document.createElement("div");
  container.id = BUTTON_CONTAINER_ID;
  container.style.cssText = `
    display: inline-flex;
    align-items: center;
    margin-left: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.textContent = "Commit to GitHub";
  btn.style.cssText = `
    background: #238636;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background 0.2s, opacity 0.2s;
    white-space: nowrap;
  `;

  btn.addEventListener("mouseenter", () => {
    if (currentState === "idle") btn.style.background = "#2ea043";
  });
  btn.addEventListener("mouseleave", () => {
    if (currentState === "idle") btn.style.background = "#238636";
  });

  btn.addEventListener("click", handleSyncClick);
  container.appendChild(btn);
  return container;
}

function updateButtonState(state, message) {
  currentState = state;
  const btn = document.getElementById(BUTTON_ID);
  if (!btn) return;

  const states = {
    idle: { text: "Commit to GitHub", bg: "#238636", disabled: false },
    committing: { text: "⏳ Committing...", bg: "#6e7681", disabled: true },
    committed: { text: "Commit done", bg: "#1a7f37", disabled: false },
    failed: { text: "Retry commit", bg: "#da3633", disabled: false },
  };

  const s = states[state] || states.idle;
  btn.textContent = message || s.text;
  btn.style.background = s.bg;
  btn.disabled = s.disabled;
  btn.style.opacity = s.disabled ? "0.7" : "1";
  btn.style.cursor = s.disabled ? "not-allowed" : "pointer";
}

function removeSyncButton() {
  const container = document.getElementById(BUTTON_CONTAINER_ID);
  if (container) container.remove();
  currentState = "idle";
}

// ─── Injection ────────────────────────────────────────────────────────────────

function findInjectionTarget() {
  // Try to find the result area near the "Accepted" text
  const targetSelectors = [
    '[data-e2e-locator="submission-result"]',
    ".flex.items-center.space-x-4",
    '[class*="result-container"]',
    ".flex.items-center.gap-2",
  ];
  for (const selector of targetSelectors) {
    const resultEl = document.querySelector(selector);
    if (resultEl) return resultEl.parentElement || resultEl;
  }

  // Fallback: locate the nearest compact container around an Accepted badge.
  const acceptedBadge = [...document.querySelectorAll("span, div, p")].find(
    (el) => el.textContent?.replace(/\s+/g, " ").trim() === "Accepted",
  );
  if (acceptedBadge) {
    return (
      acceptedBadge.parentElement?.parentElement || acceptedBadge.parentElement
    );
  }

  return null;
}

function injectSyncButton() {
  if (document.getElementById(BUTTON_CONTAINER_ID)) return; // already injected

  const target = findInjectionTarget();
  if (!target) {
    log("Could not find injection target for sync button");
    return;
  }

  const container = createSyncButton();
  target.appendChild(container);
  log("Sync button injected");
}

// ─── Sync Handler ─────────────────────────────────────────────────────────────

async function handleSyncClick() {
  if (currentState === "committing") return;

  updateButtonState("committing");
  log("Commit button clicked — extracting submission");

  const result = await leetcodeAdapter.getSubmission();

  if (!result.success) {
    log(`Extraction failed: ${result.errors.join(", ")}`);
    updateButtonState("failed", "✗ Extraction failed");
    showToast(
      `GitLee could not extract the submission:\n${result.errors.join("\n")}`,
      "error",
    );
    return;
  }

  log(
    `Submission extracted: ${result.data.problemTitle} (${result.data.language})`,
  );

  const defaultCommitMessage = `Commit ${result.data.problemTitle} from LeetCode`;
  const commitMessage = await promptCommitMessage(defaultCommitMessage);

  if (commitMessage === null) {
    log("Commit cancelled by user — no commit message provided");
    updateButtonState("idle");
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "SYNC_SUBMISSION",
    payload: { ...result.data, commitMessage },
  });

  if (!response.success) {
    log(`Commit failed: ${response.error}`);
    updateButtonState("failed");
    showToast(`Commit failed: ${response.error}`, "error");
    return;
  }

  log("Commit completed successfully");
  updateButtonState("committed");

  const commitUrl = response.data?.commit?.url;
  showToast(
    `✓ Committed to GitHub\n${result.data.problemTitle}\n${result.data.language}`,
    "success",
    commitUrl,
  );
}

// ─── Commit Message Prompt ──────────────────────────────────────────────────────

function promptCommitMessage(defaultMessage) {
  return new Promise((resolve) => {
    const existing = document.getElementById("gitlee-commit-modal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "gitlee-commit-modal";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
      width: 360px;
      max-width: 90vw;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    `;

    const title = document.createElement("div");
    title.textContent = "Write Commit Message";
    title.style.cssText =
      "color:#f0f6fc; font-size:14px; font-weight:600; margin-bottom:10px;";

    const input = document.createElement("textarea");
    input.value = defaultMessage;
    input.rows = 3;
    input.style.cssText = `
      display: block;
      width: 100%;
      box-sizing: border-box;
      background: #0d1117;
      color: #f0f6fc;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 8px;
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      margin-bottom: 14px;
    `;

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex; justify-content:flex-end; gap:8px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      background: transparent;
      color: #c9d1d9;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 13px;
      cursor: pointer;
    `;

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Commit";
    confirmBtn.style.cssText = `
      background: #238636;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    `;

    function close(value) {
      overlay.remove();
      document.removeEventListener("keydown", onKeydown);
      resolve(value);
    }

    function onKeydown(e) {
      if (e.key === "Escape") close(null);
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        close(input.value.trim() || defaultMessage);
      }
    }

    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", () =>
      close(input.value.trim() || defaultMessage),
    );
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(null);
    });
    document.addEventListener("keydown", onKeydown);

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    input.focus();
    input.select();
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message, type, actionUrl) {
  const existing = document.getElementById("gitlee-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "gitlee-toast";
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${type === "success" ? "#1a7f37" : "#da3633"};
    color: #fff;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    line-height: 1.5;
    max-width: 300px;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    white-space: pre-line;
  `;
  toast.textContent = message;

  if (actionUrl) {
    const link = document.createElement("a");
    link.href = actionUrl;
    link.target = "_blank";
    link.textContent = "View on GitHub →";
    link.style.cssText =
      "display:block; color:#fff; margin-top:6px; font-weight:600; text-decoration:underline;";
    toast.appendChild(link);
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

// ─── Route / SPA Observation ──────────────────────────────────────────────────

function onPageChange() {
  if (!leetcodeAdapter.isLeetCodePage()) {
    removeSyncButton();
    return;
  }

  // Reset if URL changed (new problem)
  if (lastInjectedUrl && lastInjectedUrl !== window.location.href) {
    removeSyncButton();
  }

  // Start watching for accepted state
  if (disconnectWatcher) disconnectWatcher();
  disconnectWatcher = leetcodeAdapter.watchSubmissionResult({
    onAccepted: async () => {
      log("Accepted submission detected");
      const attempt = ++readinessAttempt;

      // The Accepted verdict can render before LeetCode mounts the selected
      // submission's code panel. Retry briefly instead of permanently hiding
      // the button after the first incomplete DOM snapshot.
      for (let retry = 0; retry < 12; retry += 1) {
        if (attempt !== readinessAttempt) return;
        const readiness = await leetcodeAdapter.getSubmission();
        if (readiness.success) {
          lastInjectedUrl = window.location.href;
          injectSyncButton();
          return;
        }
        if (retry === 0 || retry === 11) {
          log(`Commit button withheld: ${readiness.errors.join(", ")}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    },
    onNonAccepted: () => {
      readinessAttempt += 1;
      log("Submission result changed — removing sync button");
      removeSyncButton();
    },
  });
}

// ─── SPA Navigation Detection ─────────────────────────────────────────────────

let lastUrl = window.location.href;

const navObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    log(`Navigation detected: ${lastUrl}`);
    onPageChange();
  }
});

navObserver.observe(document.body, { childList: true, subtree: true });

// ─── Init ─────────────────────────────────────────────────────────────────────

log("Content script loaded");
onPageChange();
