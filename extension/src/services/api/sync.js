// Sync API calls.

import { createClient } from './client.js';
import { storage } from '../../storage/index.js';

const client = createClient(() => storage.getAuthToken());

export const syncApi = {
  async sync(submissionData) {
    return client.post('/sync', submissionData);
  },

  async getHistory() {
    return client.get('/sync/history');
  },
};
