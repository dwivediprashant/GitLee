// CSS selectors for LeetCode DOM elements.
// Isolated here so updates only require changes in one place.

export const SELECTORS = {
  // Submission result — the verdict text element
  submissionResult: [
    '[data-e2e-locator="submission-result"]',
    '.text-green-s',
    '[class*="accepted"]',
    '[class*="Accepted"]',
    '[class*="text-green"]',
  ],

  // The "Accepted" text we look for (case-insensitive match in parser)
  acceptedText: 'Accepted',

  // Problem title on the problem page
  problemTitle: [
    '[data-cy="question-title"]',
    'div[class*="title"] a',
    'a[href*="/problems/"]',
    '.mr-2.text-lg',
    'div.text-title-large a',
  ],

  // Code editor — Monaco editor content
  codeEditor: [
    '.view-lines',
    '.monaco-editor .view-lines',
  ],

  // Language selector button
  languageSelector: [
    '[data-e2e-locator="lang-select"]',
    '[data-e2e-locator*="language"]',
    'button[id*="headlessui-listbox-button"]',
    'button[class*="lang"]',
    '[data-cy="lang-select"]',
    '[data-cy*="language"]',
    '[role="combobox"]',
  ],

  // Submission detail page — code block
  submissionCode: [
    '[data-cy="submission-code"]',
    '[data-testid="submission-code"]',
    '.submission-view',
    '[class*="submission"]',
    '.submission-view .view-line',
    '[class*="submission"] .view-line',
    '.submission-view .CodeMirror-code',
    '[class*="submission"] .CodeMirror-code',
    '.submission-view pre',
    '[class*="submission"] pre',
  ],

  // Problem description container
  problemDescription: [
    '[data-track-load="description_content"]',
    '[data-cy="question-content"]',
    '[data-testid="question-content"]',
    '[data-testid="description-content"]',
    '.question-content',
    '[class*="question-content"]',
    '.content__u3I1',
  ],

  // Submit button
  submitButton: [
    '[data-e2e-locator="console-submit-button"]',
    'button[class*="submit"]',
  ],

  // Result area where we inject the sync button
  resultActionArea: [
    '[data-e2e-locator="submission-result"]',
    '.flex.items-center.space-x-4',
    '.flex.items-center.gap-2',
    '[class*="result-container"]',
  ],
};
