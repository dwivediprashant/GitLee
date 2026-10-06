// Settings API calls — repository selection.

import { createClient } from './client.js';
import { storage } from '../../storage/index.js';

const client = createClient(() => storage.getAuthToken());

export const settingsApi = {
  async getRepository() {
    return client.get('/settings/repository');
  },

  async setRepository(repo) {
    const result = await client.post('/settings/repository', repo);
    await storage.setSelectedRepo(repo);
    return result;
  },
};
