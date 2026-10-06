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
 * Builds the file paths for a sync operation.
 */
export function buildFilePaths(problemTitle, language) {
  const folder = sanitizeProblemFolderName(problemTitle);
  const ext = languageToExtension(language);
  return {
    folder,
    solutionPath: `${folder}/solution.${ext}`,
    descriptionPath: `${folder}/Description.md`,
  };
}
