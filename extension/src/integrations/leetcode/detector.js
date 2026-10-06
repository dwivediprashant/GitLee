// Detects LeetCode page state and accepted submission status.

import { SELECTORS } from './selectors.js';
import { isAcceptedResult } from './parser.js';

/**
 * Returns true if the current page is a LeetCode problem page.
 */
export function isLeetCodeProblemPage() {
  return /leetcode\.com\/(?:problems|submissions)\//.test(window.location.href);
}

/**
 * Finds the submission result element using the selector list.
 */
function findResultElement() {
  let firstMatch = null;
  for (const selector of SELECTORS.submissionResult) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      firstMatch ||= el;
      if (isAcceptedResult(el.textContent)) return el;
    }
  }

  // LeetCode occasionally renders the verdict without a stable selector.
  // Restrict the fallback to small status-like elements so the page body
  // cannot make a test-run result look like a submission verdict.
  const candidates = document.querySelectorAll('span, div, p');
  for (const el of candidates) {
    const text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (text.length <= 120 && isAcceptedResult(text)) return el;
  }
  return firstMatch;
}

/**
 * Returns true if the current page shows an accepted submission result.
 */
export function isAcceptedSubmissionVisible() {
  const el = findResultElement();
  if (!el) return false;
  return isAcceptedResult(el.textContent);
}

/**
 * Returns the result element if accepted, otherwise null.
 */
export function getAcceptedResultElement() {
  const el = findResultElement();
  if (!el) return null;
  return isAcceptedResult(el.textContent) ? el : null;
}

/**
 * Watches for submission result changes using MutationObserver.
 * Calls onAccepted(resultElement) when an accepted result appears.
 * Calls onNonAccepted() when result changes to non-accepted.
 * Returns a disconnect function.
 */
export function watchSubmissionResult({ onAccepted, onNonAccepted }) {
  let lastState = null;
  let submissionAttempted = /\/submissions(?:\/detail)?\//.test(window.location.href);

  function handleSubmitClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('button, [role="button"], [data-e2e-locator]');
    const buttonText = button?.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
    const isSubmitButton = button && (
      SELECTORS.submitButton.some(selector => target.closest(selector)) ||
      button.getAttribute('data-e2e-locator')?.toLowerCase().includes('submit') ||
      buttonText === 'submit' ||
      button.getAttribute('aria-label')?.trim().toLowerCase() === 'submit'
    );
    if (!isSubmitButton) return;
    submissionAttempted = true;
    // A test run can also display "Accepted". Force the next accepted state to
    // come from the submission attempt rather than the test-run result.
    lastState = null;
    onNonAccepted?.();
  }

  function handleSubmissionHistoryClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const detailLink = target?.closest('a[href*="/submissions/detail/"]');
    if (!detailLink) return;
    const rowText = detailLink.closest('tr, [role="row"], li')?.textContent || detailLink.textContent || '';
    if (!isAcceptedResult(rowText)) return;

    submissionAttempted = true;
    lastState = null;
    onNonAccepted?.();
    setTimeout(checkState, 750);
  }

  function checkState() {
    const el = findResultElement();
    if (!el) {
      if (lastState !== null) {
        lastState = null;
        onNonAccepted?.();
      }
      return;
    }

    const accepted = isAcceptedResult(el.textContent);
    if (accepted && submissionAttempted && lastState !== 'accepted') {
      lastState = 'accepted';
      onAccepted?.(el);
    } else if (!accepted && lastState !== 'rejected') {
      lastState = 'rejected';
      onNonAccepted?.();
    }
  }

  const observer = new MutationObserver(checkState);
  document.addEventListener('click', handleSubmitClick, true);
  document.addEventListener('click', handleSubmissionHistoryClick, true);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Initial check
  checkState();

  return () => {
    observer.disconnect();
    document.removeEventListener('click', handleSubmitClick, true);
    document.removeEventListener('click', handleSubmissionHistoryClick, true);
  };
}
