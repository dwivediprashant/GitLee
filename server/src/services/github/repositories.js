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
    throw new Error(`LeetGit does not have write permission for ${owner}/${repo}. Please select a repository you can push to.`);
  }

  return repoData;
}
