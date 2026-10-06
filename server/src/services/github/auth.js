import { Octokit } from '@octokit/rest';
import { config } from '../../config/index.js';
import { GitHubIntegration } from '../../models/GitHubIntegration.js';
import { decryptToken, encryptToken } from '../../utils/tokenEncryption.js';

/**
 * Exchanges an OAuth code for a user access token.
 * Returns { access_token, refresh_token, expires_in, refresh_token_expires_in, token_type, scope }
 */
export async function exchangeCodeForToken(code) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code,
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  if (!data.access_token) {
    throw new Error('GitHub did not return an access token');
  }

  return data;
}

/**
 * Refreshes an expiring GitHub user access token.
 */
export async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`GitHub token refresh error: ${data.error_description || data.error}`);
  }

  return data;
}

/**
 * Returns a valid Octokit instance for the given user.
 * Automatically refreshes the token if it is expired.
 */
export async function getOctokitForUser(userId) {
  const integration = await GitHubIntegration.findOne({ userId });

  if (!integration) {
    throw new Error('GitHub is not connected. Please connect your GitHub account before synchronizing.');
  }

  // Refresh token if expired
  if (integration.isTokenExpired()) {
    if (!integration.refreshToken || integration.isRefreshTokenExpired()) {
      throw new Error('GitHub session has expired. Please reconnect your GitHub account.');
    }

    const refreshed = await refreshAccessToken(decryptToken(integration.refreshToken));

    integration.accessToken = encryptToken(refreshed.access_token);
    integration.refreshToken = refreshed.refresh_token ? encryptToken(refreshed.refresh_token) : integration.refreshToken;

    if (refreshed.expires_in) {
      integration.tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    }
    if (refreshed.refresh_token_expires_in) {
      integration.refreshTokenExpiresAt = new Date(Date.now() + refreshed.refresh_token_expires_in * 1000);
    }

    await integration.save();
    console.log('[LeetGit] GitHub token refreshed for user', userId);
  }

  return new Octokit({ auth: decryptToken(integration.accessToken) });
}
