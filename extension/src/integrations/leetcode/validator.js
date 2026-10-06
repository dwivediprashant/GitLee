// Validates extracted submission data before sync.

const SUPPORTED_LANGUAGES = new Set([
  'python', 'python3', 'java', 'cpp', 'c', 'javascript', 'typescript',
  'csharp', 'go', 'ruby', 'swift', 'kotlin', 'rust', 'scala', 'php',
  'r', 'racket', 'erlang', 'elixir', 'dart',
]);

/**
 * Validates a complete submission object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateSubmission(submission) {
  const errors = [];

  if (!submission) {
    return { valid: false, errors: ['Submission object is null'] };
  }

  if (!submission.accepted) {
    errors.push('Submission is not accepted');
  }

  if (!submission.problemTitle || submission.problemTitle.trim() === '') {
    errors.push('Problem title is missing');
  }

  if (!submission.sourceCode || submission.sourceCode.trim() === '') {
    errors.push('Source code is missing');
  }

  if (!submission.problemDescription || submission.problemDescription.trim() === '') {
    errors.push('Problem description is missing');
  }

  if (!submission.language) {
    errors.push('Language is missing');
  } else if (!SUPPORTED_LANGUAGES.has(submission.language.toLowerCase())) {
    errors.push(`Unsupported language: ${submission.language}`);
  }

  // problemSlug is preferred but not strictly required if title is present
  if (!submission.problemSlug && !submission.problemTitle) {
    errors.push('Neither problem slug nor title is available');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
