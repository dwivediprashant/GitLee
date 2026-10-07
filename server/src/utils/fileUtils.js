/**
 * Maps LeetCode language identifiers to file extensions.
 * Add new languages here only.
 */
const LANGUAGE_EXTENSIONS = {
  python: 'py',
  python3: 'py',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  javascript: 'js',
  typescript: 'ts',
  csharp: 'cs',
  go: 'go',
  ruby: 'rb',
  swift: 'swift',
  kotlin: 'kt',
  rust: 'rs',
  scala: 'scala',
  php: 'php',
  r: 'r',
  racket: 'rkt',
  erlang: 'erl',
  elixir: 'ex',
  dart: 'dart',
};

export function languageToExtension(language) {
  const ext = LANGUAGE_EXTENSIONS[language?.toLowerCase()];
  if (!ext) throw new Error(`Unsupported language: ${language}`);
  return ext;
}

/**
 * Sanitizes a problem title into a safe folder name.
 * Retains alphanumerics, spaces, hyphens, underscores, and parentheses.
 * Collapses multiple spaces. Trims.
 */
export function sanitizeProblemFolderName(title) {
  if (!title) throw new Error('Problem title is required for folder name');
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')  // remove unsafe path chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100); // cap length
}

/**
 * Sanitizes a user-chosen base folder path (e.g. "algorithms/arrays").
 * Strips leading/trailing slashes, blocks path traversal (".."), removes
 * characters GitHub rejects, collapses duplicate slashes.
 * Empty input resolves to "" (repository root level).
 */
export function sanitizeTargetFolder(raw) {
  if (raw == null) return '';
  const cleaned = String(raw)
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => seg.trim().replace(/[<>:\"|?*\x00-\x1f]/g, ''))
    .filter((seg) => seg.length > 0 && seg !== '.' && seg !== '..')
    .join('/');
  return cleaned.slice(0, 200); // cap length
}

/**
 * Builds the file paths for a sync operation.
 * When targetFolder is provided (e.g. "algorithms/arrays"), the problem
 * folder is nested under it; otherwise it lands at the repository root.
 * GitHub's Git Data API builds any missing intermediate directories
 * automatically from the full file path — no folder-creation call needed.
 */
export function buildFilePaths(problemTitle, language, targetFolder = '') {
  const folder = sanitizeProblemFolderName(problemTitle);
  const base = sanitizeTargetFolder(targetFolder);
  const prefix = base ? `${base}/` : '';
  const ext = languageToExtension(language);
  return {
    folder,
    baseFolder: base,
    solutionPath: `${prefix}${folder}/solution.${ext}`,
    descriptionPath: `${prefix}${folder}/Description.md`,
  };
}
