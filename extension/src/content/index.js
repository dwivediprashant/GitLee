// Content script — LeetCode page integration, accepted detection, button injection.

import { leetcodeAdapter } from '../integrations/leetcode/index.js';

const BUTTON_ID = 'leetgit-sync-btn';
const BUTTON_CONTAINER_ID = 'leetgit-btn-container';

let currentState = 'idle'; // idle | syncing | synced | failed
let disconnectWatcher = null;
let lastInjectedUrl = null;
let readinessAttempt = 0;

function log(msg) {
  console.log(`[LeetGit] ${msg}`);
}

// ─── Button ──────────────────────────────────────────────────────────────────

function createSyncButton() {
  const container = document.createElement('div');
  container.id = BUTTON_CONTAINER_ID;
  container.style.cssText = `
    display: inline-flex;
    align-items: center;
    margin-left: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.textContent = 'Sync to GitHub';
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

  btn.addEventListener('mouseenter', () => {
    if (currentState === 'idle') btn.style.background = '#2ea043';
  });
  btn.addEventListener('mouseleave', () => {
    if (currentState === 'idle') btn.style.background = '#238636';
  });

  btn.addEventListener('click', handleSyncClick);
  container.appendChild(btn);
  return container;
}

function updateButtonState(state, message) {
  currentState = state;
  const btn = document.getElementById(BUTTON_ID);
  if (!btn) return;

  const states = {
    idle:    { text: 'Sync to GitHub', bg: '#238636', disabled: false },
    syncing: { text: '⏳ Syncing…',    bg: '#6e7681', disabled: true  },
    synced:  { text: '✓ Synced',       bg: '#1a7f37', disabled: false },
    failed:  { text: '✗ Retry Sync',   bg: '#da3633', disabled: false },
  };

  const s = states[state] || states.idle;
  btn.textContent = message || s.text;
  btn.style.background = s.bg;
  btn.disabled = s.disabled;
  btn.style.opacity = s.disabled ? '0.7' : '1';
  btn.style.cursor = s.disabled ? 'not-allowed' : 'pointer';
}

function removeSyncButton() {
  const container = document.getElementById(BUTTON_CONTAINER_ID);
  if (container) container.remove();
  currentState = 'idle';
}

// ─── Injection ────────────────────────────────────────────────────────────────

function findInjectionTarget() {
  // Try to find the result area near the "Accepted" text
  const targetSelectors = [
    '[data-e2e-locator="submission-result"]',
    '.flex.items-center.space-x-4',
    '[class*="result-container"]',
    '.flex.items-center.gap-2',
  ];
  for (const selector of targetSelectors) {
    const resultEl = document.querySelector(selector);
    if (resultEl) return resultEl.parentElement || resultEl;
  }

  // Fallback: locate the nearest compact container around an Accepted badge.
  const acceptedBadge = [...document.querySelectorAll('span, div, p')]
    .find(el => el.textContent?.replace(/\s+/g, ' ').trim() === 'Accepted');
  if (acceptedBadge) {
    return acceptedBadge.parentElement?.parentElement || acceptedBadge.parentElement;
  }

  return null;
}

function injectSyncButton() {
  if (document.getElementById(BUTTON_CONTAINER_ID)) return; // already injected

  const target = findInjectionTarget();
  if (!target) {
    log('Could not find injection target for sync button');
    return;
  }

  const container = createSyncButton();
  target.appendChild(container);
  log('Sync button injected');
}

// ─── Sync Handler ─────────────────────────────────────────────────────────────

async function handleSyncClick() {
  if (currentState === 'syncing') return;

  updateButtonState('syncing');
  log('Sync button clicked — extracting submission');

  const result = await leetcodeAdapter.getSubmission();

  if (!result.success) {
    log(`Extraction failed: ${result.errors.join(', ')}`);
    updateButtonState('failed', '✗ Extraction failed');
    showToast(`LeetGit could not extract the submission:\n${result.errors.join('\n')}`, 'error');
    return;
  }

  log(`Submission extracted: ${result.data.problemTitle} (${result.data.language})`);

  const response = await chrome.runtime.sendMessage({
    type: 'SYNC_SUBMISSION',
    payload: result.data,
  });

  if (!response.success) {
    log(`Sync failed: ${response.error}`);
    updateButtonState('failed');
    showToast(`Sync failed: ${response.error}`, 'error');
    return;
  }

  log('Sync completed successfully');
  updateButtonState('synced');

  const commitUrl = response.data?.commit?.url;
  showToast(
    `✓ Synced to GitHub\n${result.data.problemTitle}\n${result.data.language}`,
    'success',
    commitUrl
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message, type, actionUrl) {
  const existing = document.getElementById('leetgit-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'leetgit-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${type === 'success' ? '#1a7f37' : '#da3633'};
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
    const link = document.createElement('a');
    link.href = actionUrl;
    link.target = '_blank';
    link.textContent = 'View on GitHub →';
    link.style.cssText = 'display:block; color:#fff; margin-top:6px; font-weight:600; text-decoration:underline;';
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
      log('Accepted submission detected');
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
          log(`Sync button withheld: ${readiness.errors.join(', ')}`);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    },
    onNonAccepted: () => {
      readinessAttempt += 1;
      log('Submission result changed — removing sync button');
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

log('Content script loaded');
onPageChange();
