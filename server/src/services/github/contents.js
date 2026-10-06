import { getOctokitForUser } from './auth.js';

/**
 * Gets the SHA of an existing file, or null if it doesn't exist.
 */
async function getFileSha(octokit, owner, repo, path, branch) {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
    return data.sha;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Gets the latest commit SHA on a branch.
 */
async function getBranchSha(octokit, owner, repo, branch) {
  const { data } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  return data.object.sha;
}

/**
 * Gets the tree SHA from a commit.
 */
async function getCommitTreeSha(octokit, owner, repo, commitSha) {
  const { data } = await octokit.rest.git.getCommit({ owner, repo, commit_sha: commitSha });
  return data.tree.sha;
}

/**
 * Creates a blob for file content.
 */
async function createBlob(octokit, owner, repo, content) {
  const { data } = await octokit.rest.git.createBlob({
    owner,
    repo,
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64',
  });
  return { sha: data.sha, url: data.url };
}

/**
 * Commits multiple files atomically using the Git Data API.
 * This ensures both Description.md and solution.* land in one commit.
 *
 * files: [{ path: string, content: string }]
 * Returns the actual GitHub commit data.
 */
export async function commitFiles(userId, { owner, repo, branch, files, message }) {
  const octokit = await getOctokitForUser(userId);

  // 1. Get the current HEAD commit SHA
  const headSha = await getBranchSha(octokit, owner, repo, branch);

  // 2. Get the tree SHA from that commit
  const baseTreeSha = await getCommitTreeSha(octokit, owner, repo, headSha);

  // 3. Create blobs for each file
  let treeItems;
  try {
    treeItems = await Promise.all(
      files.map(async (file) => {
        const blob = await createBlob(octokit, owner, repo, file.content);
        return {
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
          url: blob.url,
        };
      })
    );
  } catch (err) {
    if (err.status === 403) {
      throw Object.assign(
        new Error(`GitHub rejected the write to ${owner}/${repo} (HTTP 403). Reinstall or reconfigure the GitHub App with Repository contents: Read and write, then reconnect GitHub.`),
        { status: 403 }
      );
    }
    throw err;
  }

  // 4. Create a new tree
  const { data: newTree } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // 5. Create the commit
  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [headSha],
  });

  // 6. Update the branch reference
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  // Blob API URLs are returned by GitHub; do not invent result URLs locally.
  const fileUrls = treeItems.map(f => ({
    path: f.path,
    url: f.url,
  }));

  return {
    commit: {
      sha: newCommit.sha,
      url: newCommit.html_url || newCommit.url,
    },
    files: fileUrls,
    repository: { owner, name: repo },
  };
}
