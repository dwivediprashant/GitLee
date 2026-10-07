import { getGitHubUser, getUserRepositories, getRepositoryFolders, verifyRepositoryAccess } from '../services/github/repositories.js';
import { sanitizeTargetFolder } from '../utils/fileUtils.js';
import { RepositoryPreference } from '../models/RepositoryPreference.js';

export const githubController = {
  async getUser(req, res) {
    const user = await getGitHubUser(req.user._id);
    res.json({ id: user.id, login: user.login, name: user.name, avatarUrl: user.avatar_url });
  },

  async listRepositories(req, res) {
    const repositories = await getUserRepositories(req.user._id);
    res.json({ repositories });
  },

  async listRepositoryFolders(req, res) {
    const { owner, repo, branch } = req.query || {};
    if (!owner?.trim() || !repo?.trim()) {
      return res.status(400).json({ message: 'owner and repo query parameters are required.' });
    }
    const result = await getRepositoryFolders(
      req.user._id,
      owner.trim(),
      repo.trim(),
      branch?.trim() || undefined
    );
    res.json(result);
  },

  async getRepositoryPreference(req, res) {
    const repository = await RepositoryPreference.findOne({ userId: req.user._id }).lean();
    res.json({ repository: repository || null });
  },

  async setRepositoryPreference(req, res) {
    const { owner, name, fullName, defaultBranch, private: isPrivate, targetFolder } = req.body || {};
    if (![owner, name, fullName, defaultBranch].every(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'owner, name, fullName, and defaultBranch are required.' });
    }
    if (targetFolder != null && typeof targetFolder !== 'string') {
      return res.status(400).json({ message: 'targetFolder must be a string when provided.' });
    }
    await verifyRepositoryAccess(req.user._id, owner, name);
    const repository = await RepositoryPreference.findOneAndUpdate(
      { userId: req.user._id },
      { userId: req.user._id, owner, name, fullName, defaultBranch, private: Boolean(isPrivate), targetFolder: sanitizeTargetFolder(targetFolder ?? '') },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ repository });
  },
};
