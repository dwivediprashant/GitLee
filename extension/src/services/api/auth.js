// Auth API calls — login, logout, current user.

import { createClient } from './client.js';
import { storage } from '../../storage/index.js';

const client = createClient(() => storage.getAuthToken());

export const authApi = {
  async getMe() {
    return client.get('/auth/me');
  },

  async logout() {
    await client.post('/auth/logout');
    await storage.clearAll();
  },

  // Called after OAuth callback returns a token
  async saveToken(token) {
    await storage.setAuthToken(token);
    const user = await client.get('/auth/me');
    await storage.setUser(user);
    return user;
  },
};
