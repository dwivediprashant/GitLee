// Background service worker — message routing, OAuth coordination.

import { storage } from "../storage/index.js";

const BACKEND_URL = "https://gitlee-backend.onrender.com";
// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ success: false, error: err.message }));
  return true; // keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case "START_GITHUB_AUTH":
      return startGitHubAuth();

    case "GET_AUTH_STATE":
      return getAuthState();

    case "LOGOUT":
      return logout();

    case "SYNC_SUBMISSION":
      return syncSubmission(message.payload);

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

async function startGitHubAuth() {
  const authUrl = `${BACKEND_URL}/api/auth/github`;

  return new Promise((resolve) => {
    // Open auth tab
    chrome.tabs.create({ url: authUrl }, (tab) => {
      const tabId = tab.id;

      // Listen for the callback redirect
      function onUpdated(updatedTabId, changeInfo, updatedTab) {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status !== "complete") return;

        const url = updatedTab.url || "";
        // Backend redirects to extension after OAuth with token
        if (url.includes("token=")) {
          const params = new URL(url).searchParams;
          const token = params.get("token");

          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.tabs.remove(tabId).catch(() => {});

          if (token) {
            storage.setAuthToken(token).then(async () => {
              try {
                const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const user = await response.json();
                if (!response.ok)
                  throw new Error(
                    user.message || "Could not verify the GitHub session",
                  );
                await storage.setUser(user);
                resolve({ success: true });
              } catch (error) {
                await storage.clearAll();
                resolve({ success: false, error: error.message });
              }
            });
          } else {
            resolve({ success: false, error: "No token in callback URL" });
          }
        } else if (url.includes("error=")) {
          const params = new URL(url).searchParams;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.tabs.remove(tabId).catch(() => {});
          resolve({
            success: false,
            error: params.get("error") || "OAuth failed",
          });
        }
      }

      chrome.tabs.onUpdated.addListener(onUpdated);

      // Timeout after 5 minutes
      setTimeout(
        () => {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.tabs.remove(tabId).catch(() => {});
          resolve({ success: false, error: "Authentication timed out" });
        },
        5 * 60 * 1000,
      );
    });
  });
}

async function getAuthState() {
  const token = await storage.getAuthToken();
  const user = await storage.getUser();
  const repo = await storage.getSelectedRepo();
  return { authenticated: !!token, user, selectedRepo: repo };
}

async function logout() {
  const token = await storage.getAuthToken();
  if (token) {
    await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  await storage.clearAll();
  return { success: true };
}

async function syncSubmission(payload) {
  const token = await storage.getAuthToken();
  if (!token) {
    return {
      success: false,
      error:
        "GitHub is not connected. Please connect your GitHub account before synchronizing.",
    };
  }

  const res = await fetch(`${BACKEND_URL}/api/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      error: data.message || `Sync failed: HTTP ${res.status}`,
    };
  }

  // Cache last sync result
  await storage.setLastSync({
    problemTitle: payload.problemTitle,
    language: payload.language,
    commitUrl: data.commit?.url,
    syncedAt: Date.now(),
  });

  return { success: true, data };
}
