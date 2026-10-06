// Public adapter for LeetCode integration.
// All other modules interact with LeetCode through this interface.

import { isLeetCodeProblemPage, isAcceptedSubmissionVisible, watchSubmissionResult } from './detector.js';
import { extractSubmission } from './extractor.js';
import { validateSubmission } from './validator.js';

export const leetcodeAdapter = {
  isLeetCodePage: isLeetCodeProblemPage,
  isAccepted: isAcceptedSubmissionVisible,
  watchSubmissionResult,

  /**
   * Extracts and validates the current accepted submission.
   * Returns { success, data, errors }
   */
  async getSubmission() {
    if (!isAcceptedSubmissionVisible()) {
      return {
        success: false,
        data: null,
        errors: ['No accepted submission is currently visible on this page'],
      };
    }

    let data;
    try {
      data = await extractSubmission();
    } catch (err) {
      return {
        success: false,
        data: null,
        errors: [err.message],
      };
    }

    const { valid, errors } = validateSubmission(data);
    if (!valid) {
      return { success: false, data: null, errors };
    }

    return { success: true, data, errors: [] };
  },
};
