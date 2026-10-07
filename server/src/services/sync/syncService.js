import { generateDescription } from '../llm/description.js';
import { commitFiles } from '../github/contents.js';
import { verifyRepositoryAccess } from '../github/repositories.js';
import { buildFilePaths, sanitizeTargetFolder } from '../../utils/fileUtils.js';
import { SyncRecord } from '../../models/SyncRecord.js';
import { RepositoryPreference } from '../../models/RepositoryPreference.js';

/**
 * Validates the incoming sync payload from the extension.
 */
function validatePayload(payload) {
  const errors = [];
  if (!payload.problemTitle?.trim()) errors.push('problemTitle is required');
  if (!payload.sourceCode?.trim()) errors.push('sourceCode is required');
  if (!payload.problemDescription?.trim()) errors.push('problemDescription is required');
  if (!payload.language?.trim()) errors.push('language is required');
  if (payload.accepted !== true) errors.push('Submission must be accepted');
  if (payload.targetFolder != null && typeof payload.targetFolder !== 'string') {
    errors.push('targetFolder must be a string when provided');
  }
  return errors;
}

/**
 * Checks if this exact submission has already been synced.
 */
async function isDuplicateSubmission(userId, submissionId) {
  if (!submissionId) return false;
  const existing = await SyncRecord.findOne({ userId, submissionId, status: 'success' });
  return !!existing;
}

/**
 * Main sync orchestrator.
 * Returns actual GitHub result or throws with a descriptive error.
 */
export async function performSync(userId, payload) {
  // 1. Validate payload
  const validationErrors = validatePayload(payload);
  if (validationErrors.length > 0) {
    throw Object.assign(new Error(validationErrors.join('; ')), { status: 400 });
  }

  // The backend cannot prove a page verdict from an extension payload. It requires
  // the extension's accepted DOM check and rejects any payload lacking that proof.
  // 2. Check for duplicate submission
  if (payload.submissionId) {
    const duplicate = await isDuplicateSubmission(userId, payload.submissionId);
    if (duplicate) {
      throw Object.assign(
        new Error(`Submission ${payload.submissionId} has already been synced.`),
        { status: 409 }
      );
    }
  }

  // 3. Get selected repository
  const repoPref = await RepositoryPreference.findOne({ userId });
  if (!repoPref) {
    throw Object.assign(
      new Error('No repository selected. Please select a GitHub repository in the GitLee extension.'),
      { status: 400 }
    );
  }

  const { owner, name: repo, defaultBranch: branch } = repoPref;

  // 4. Verify repository access
  console.log(`[GitLee] Verifying repository access: ${owner}/${repo}`);
  await verifyRepositoryAccess(userId, owner, repo);

  // 5. Build file paths
  // Per-sync targetFolder (sent by the extension) takes precedence over the
  // saved repository preference; both fall back to the repository root.
  const targetFolder = sanitizeTargetFolder(
    payload.targetFolder ?? repoPref.targetFolder ?? ''
  );
  const { solutionPath, descriptionPath } = buildFilePaths(payload.problemTitle, payload.language, targetFolder);

  // 6. Generate Description.md
  console.log('[GitLee] Generating description');
  const descResult = await generateDescription({
    problemTitle: payload.problemTitle,
    problemDescription: payload.problemDescription,
  });

  // 7. Prepare files for commit
  const files = [
    { path: descriptionPath, content: descResult.content },
    { path: solutionPath, content: payload.sourceCode },
  ];

  // 8. Commit to GitHub atomically
  console.log('[GitLee] Creating GitHub commit');
  const commitMessage = payload.commitMessage?.trim() || `Sync ${payload.problemTitle} from LeetCode`;
  let githubResult;
  try {
    githubResult = await commitFiles(userId, {
      owner,
      repo,
      branch,
      files,
      message: commitMessage,
    });
  } catch (err) {
    // Record the failure
    await SyncRecord.create({
      userId,
      problemTitle: payload.problemTitle,
      problemSlug: payload.problemSlug,
      submissionId: payload.submissionId,
      language: payload.language,
      repositoryOwner: owner,
      repositoryName: repo,
      solutionPath,
      descriptionPath,
      status: 'failed',
      errorMessage: err.message,
    });
    throw err;
  }

  // 9. Record success
  const record = await SyncRecord.create({
    userId,
    problemTitle: payload.problemTitle,
    problemSlug: payload.problemSlug,
    submissionId: payload.submissionId,
    language: payload.language,
    repositoryOwner: owner,
    repositoryName: repo,
    solutionPath,
    descriptionPath,
    commitSha: githubResult.commit.sha,
    commitUrl: githubResult.commit.url,
    status: 'success',
  });

  console.log(`[GitLee] Sync completed: ${githubResult.commit.url}`);

  return {
    success: true,
    repository: githubResult.repository,
    files: githubResult.files,
    commit: githubResult.commit,
    descriptionSource: descResult.source,
    syncId: record._id,
  };
}
