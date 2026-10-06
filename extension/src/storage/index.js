// Typed wrappers around chrome.storage.local for extension-wide state.

const KEYS = {
  AUTH_TOKEN: 'authToken',
  USER: 'user',
  GITHUB_CONNECTED: 'githubConnected',
  SELECTED_REPO: 'selectedRepo',
  LAST_SYNC: 'lastSync',
};

function get(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, result => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(result);
    });
  });
}

function set(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

function remove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

export const storage = {
  async getAuthToken() {
    const r = await get(KEYS.AUTH_TOKEN);
    return r[KEYS.AUTH_TOKEN] || null;
  },
  async setAuthToken(token) {
    await set({ [KEYS.AUTH_TOKEN]: token });
  },
  async clearAuthToken() {
    await remove(KEYS.AUTH_TOKEN);
  },

  async getUser() {
    const r = await get(KEYS.USER);
    return r[KEYS.USER] || null;
  },
  async setUser(user) {
    await set({ [KEYS.USER]: user });
  },

  async getSelectedRepo() {
    const r = await get(KEYS.SELECTED_REPO);
    return r[KEYS.SELECTED_REPO] || null;
  },
  async setSelectedRepo(repo) {
    await set({ [KEYS.SELECTED_REPO]: repo });
  },

  async getLastSync() {
    const r = await get(KEYS.LAST_SYNC);
    return r[KEYS.LAST_SYNC] || null;
  },
  async setLastSync(syncRecord) {
    await set({ [KEYS.LAST_SYNC]: syncRecord });
  },

  async clearAll() {
    await remove(Object.values(KEYS));
  },
};
