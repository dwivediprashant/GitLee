// GitHub API calls — user info, repositories.

import { createClient } from './client.js';
import { storage } from '../../storage/index.js';

const client = createClient(() => storage.getAuthToken());

export const githubApi = {
  async getGitHubUser() {
    return client.get('/github/user');
  },

  async getRepositories() {
    return client.get('/github/repositories');
  },

  async getAuthUrl() {
    return client.get('/auth/github');
  },
};
