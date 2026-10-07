import { getOctokitForUser } from './auth.js';

/**
 * Returns the authenticated GitHub user's profile.
 */
export async function getGitHubUser(userId) {
  const octokit = await getOctokitForUser(userId);
  const { data } = await octokit.rest.users.getAuthenticated();
  return data;
}

/**
 * Returns all repositories accessible to the authenticated user.
 * Paginates through all pages.
 */
export async function getUserRepositories(userId) {
  const octokit = await getOctokitForUser(userId);

  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    sort: 'updated',
    per_page: 100,
    affiliation: 'owner,collaborator',
  });

  return repos.map(r => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    private: r.private,
    default_branch: r.default_branch,
    owner: { login: r.owner.login },
    html_url: r.html_url,
    pushed_at: r.pushed_at,
  }));
}

/**
 * Returns all folder (tree) paths in a repository via the Git Trees API.
 * Uses the recursive flag and filters entries where type === 'tree'.
 * Empty repositories (no commits yet) resolve to an empty list with isEmpty: true
 * instead of throwing, so callers can fall back to the root level.
 */
export async function getRepositoryFolders(userId, owner, repo, branch) {
  const octokit = await getOctokitForUser(userId);

  let ref = branch;
  if (!ref) {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    ref = repoData.default_branch || 'main';
  }

  let tree;
  try {
    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: ref,
      recursive: '1',
    });
    tree = data;
  } catch (err) {
    if (err.status === 404) {
      // Empty repository (no commits) or missing ref — default to root level.
      return { folders: [], isEmpty: true, truncated: false, branch: ref };
    }
    if (err.status === 403 && /rate limit/i.test(err.message || '')) {
      throw Object.assign(
        new Error('GitHub API rate limit reached. Please wait a minute and try again.'),
        { status: 429 }
      );
    }
    if (err.status === 401) {
      throw Object.assign(
        new Error('GitHub session has expired. Please reconnect your GitHub account.'),
        { status: 401 }
      );
    }
    throw new Error(`Could not list folders in ${owner}/${repo}: ${err.message}`);
  }

  const entries = tree.tree || [];
  const folders = [...new Set(
    entries.filter((n) => n?.type === 'tree' && n.path).map((n) => n.path)
  )].sort((a, b) => a.localeCompare(b));

  return {
    folders,
    isEmpty: entries.length === 0,
    truncated: Boolean(tree.truncated),
    branch: ref,
  };
}

/**
 * Verifies that the user has push access to the given repository.
 * Throws a descriptive error if not.
 */
export async function verifyRepositoryAccess(userId, owner, repo) {
  const octokit = await getOctokitForUser(userId);

  let repoData;
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo });
    repoData = data;
  } catch (err) {
    if (err.status === 404) {
      throw new Error(`Repository ${owner}/${repo} was not found or is not accessible. Please select another repository.`);
    }
    throw new Error(`Could not access repository ${owner}/${repo}: ${err.message}`);
  }

  if (!repoData.permissions?.push) {
    throw new Error(`GitLee does not have write permission for ${owner}/${repo}. Please select a repository you can push to.`);
  }

  return repoData;
}
