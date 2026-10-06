// Parses raw DOM text/values into structured data.

/**
 * Normalizes language names from LeetCode UI to standard identifiers.
 */
const LANGUAGE_MAP = {
  'python': 'python',
  'python3': 'python3',
  'python 3': 'python3',
  'java': 'java',
  'c++': 'cpp',
  'cpp': 'cpp',
  'c': 'c',
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'c#': 'csharp',
  'csharp': 'csharp',
  'go': 'go',
  'golang': 'go',
  'ruby': 'ruby',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'rust': 'rust',
  'scala': 'scala',
  'php': 'php',
  'r': 'r',
  'racket': 'racket',
  'erlang': 'erlang',
  'elixir': 'elixir',
  'dart': 'dart',
};

export function parseLanguage(rawLanguage) {
  if (!rawLanguage) return null;
  const normalized = rawLanguage.trim().toLowerCase();
  return LANGUAGE_MAP[normalized] || normalized;
}

/**
 * Extracts problem slug from the current URL.
 * e.g. https://leetcode.com/problems/two-sum/description/ → "two-sum"
 */
export function parseProblemSlugFromUrl(url) {
  const match = url.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Cleans up extracted code text — removes zero-width chars, normalizes line endings.
 * Does NOT modify algorithm logic.
 */
export function parseSourceCode(rawCode) {
  if (!rawCode) return null;
  return rawCode
    .replace(/\u200b/g, '')   // zero-width space
    .replace(/\u00a0/g, ' ')  // non-breaking space
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Checks if the result text indicates an accepted submission.
 */
export function isAcceptedResult(text) {
  if (!text) return false;
  return /(^|\s)accepted($|\s)/i.test(text.replace(/\s+/g, ' ').trim());
}

/**
 * Extracts submission ID from URL if on a submission detail page.
 * e.g. https://leetcode.com/submissions/detail/123456789/
 */
export function parseSubmissionIdFromUrl(url) {
  const match = url.match(/\/submissions(?:\/detail)?\/(\d+)/);
  return match ? match[1] : null;
}
