import mongoose from 'mongoose';

// Stores GitHub OAuth tokens for a user.
// Tokens are encrypted at rest via application-level handling.
const githubIntegrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  githubUserId: { type: String, required: true },
  accessToken: { type: String, required: true },   // GitHub user access token
  refreshToken: String,                             // GitHub refresh token (if using expiring tokens)
  tokenExpiresAt: Date,                             // null if non-expiring
  refreshTokenExpiresAt: Date,
  scope: String,
  connectedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

githubIntegrationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

githubIntegrationSchema.methods.isTokenExpired = function () {
  if (!this.tokenExpiresAt) return false;
  return new Date() >= this.tokenExpiresAt;
};

githubIntegrationSchema.methods.isRefreshTokenExpired = function () {
  if (!this.refreshTokenExpiresAt) return false;
  return new Date() >= this.refreshTokenExpiresAt;
};

export const GitHubIntegration = mongoose.model('GitHubIntegration', githubIntegrationSchema);
