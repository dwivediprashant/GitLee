import { getGitHubUser, getUserRepositories, verifyRepositoryAccess } from '../services/github/repositories.js';
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

  async getRepositoryPreference(req, res) {
    const repository = await RepositoryPreference.findOne({ userId: req.user._id }).lean();
    res.json({ repository: repository || null });
  },

  async setRepositoryPreference(req, res) {
    const { owner, name, fullName, defaultBranch, private: isPrivate } = req.body || {};
    if (![owner, name, fullName, defaultBranch].every(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'owner, name, fullName, and defaultBranch are required.' });
    }
    await verifyRepositoryAccess(req.user._id, owner, name);
    const repository = await RepositoryPreference.findOneAndUpdate(
      { userId: req.user._id },
      { userId: req.user._id, owner, name, fullName, defaultBranch, private: Boolean(isPrivate) },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ repository });
  },
};
