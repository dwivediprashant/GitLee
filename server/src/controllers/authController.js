import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { exchangeCodeForToken } from '../services/github/auth.js';
import { getGitHubUser } from '../services/github/repositories.js';
import { User } from '../models/User.js';
import { GitHubIntegration } from '../models/GitHubIntegration.js';
import { config } from '../config/index.js';
import { encryptToken } from '../utils/tokenEncryption.js';

// In-memory store for OAuth state params (prevents CSRF)
const pendingStates = new Map();

export const authController = {
  /**
   * GET /api/auth/github
   * Redirects the user to GitHub's OAuth authorization page.
   */
  initiateOAuth(req, res) {
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, Date.now());

    // Clean up states older than 10 minutes
    for (const [s, t] of pendingStates) {
      if (Date.now() - t > 10 * 60 * 1000) pendingStates.delete(s);
    }

    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.callbackUrl,
      scope: 'repo user:email',
      state,
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  },

  /**
   * GET /api/auth/github/callback
   * Handles the OAuth callback from GitHub.
   */
  async handleCallback(req, res) {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${config.cors.clientUrl}?error=${encodeURIComponent(error)}`);
    }

    if (!state || !pendingStates.has(state)) {
      return res.redirect(`${config.cors.clientUrl}?error=invalid_state`);
    }
    pendingStates.delete(state);

    if (!code) {
      return res.redirect(`${config.cors.clientUrl}?error=no_code`);
    }

    try {
      // Exchange code for token
      const tokenData = await exchangeCodeForToken(code);

      // Get GitHub user info
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: tokenData.access_token });
      const { data: ghUser } = await octokit.rest.users.getAuthenticated();

      // Upsert user in MongoDB
      let user = await User.findOne({ githubId: String(ghUser.id) });
      if (!user) {
        user = await User.create({
          githubId: String(ghUser.id),
          login: ghUser.login,
          name: ghUser.name,
          email: ghUser.email,
          avatarUrl: ghUser.avatar_url,
        });
      } else {
        user.login = ghUser.login;
        user.name = ghUser.name;
        user.email = ghUser.email;
        user.avatarUrl = ghUser.avatar_url;
        await user.save();
      }

      // Upsert GitHub integration
      const integrationData = {
        userId: user._id,
        githubUserId: String(ghUser.id),
        accessToken: encryptToken(tokenData.access_token),
        scope: tokenData.scope,
      };

      if (tokenData.refresh_token) {
        integrationData.refreshToken = encryptToken(tokenData.refresh_token);
      }
      if (tokenData.expires_in) {
        integrationData.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      }
      if (tokenData.refresh_token_expires_in) {
        integrationData.refreshTokenExpiresAt = new Date(Date.now() + tokenData.refresh_token_expires_in * 1000);
      }

      await GitHubIntegration.findOneAndUpdate(
        { userId: user._id },
        integrationData,
        { upsert: true, new: true }
      );

      // Issue a JWT for the extension
      const jwtToken = jwt.sign({ userId: user._id }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      });

      // Redirect back to extension with token.
      // The background service worker intercepts this URL.
      // Prefer the store CRX ID (first entry) so reviewers/published users land
      // in their build; falls back to the legacy single ID, then localhost.
      const callbackExtensionId =
        config.cors.extensionIds[0] || config.cors.extensionId;
      const extensionCallbackUrl = callbackExtensionId
        ? `chrome-extension://${callbackExtensionId}/popup.html?token=${jwtToken}`
        : `http://localhost:3001/auth-success?token=${jwtToken}`;

      res.redirect(extensionCallbackUrl);
    } catch (err) {
      console.error('[GitLee] OAuth callback error:', err.message);
      res.redirect(`${config.cors.clientUrl}?error=${encodeURIComponent(err.message)}`);
    }
  },

  /**
   * GET /api/auth/me
   * Returns the current authenticated user.
   */
  getMe(req, res) {
    const { user } = req;
    res.json({
      id: user._id,
      githubId: user.githubId,
      login: user.login,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    });
  },

  /**
   * POST /api/auth/logout
   * Removes the GitHub integration for the user.
   */
  async logout(req, res) {
    await GitHubIntegration.deleteOne({ userId: req.user._id });
    res.json({ success: true });
  },
};
