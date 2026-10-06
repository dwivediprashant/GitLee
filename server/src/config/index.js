import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/leetgit',

  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    privateKey: process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/auth/github/callback',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '30d',
  },

  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,

  cors: {
    extensionId: process.env.EXTENSION_ID,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  },
};

export function validateConfig() {
  const required = [
    ['GITHUB_CLIENT_ID', config.github.clientId],
    ['GITHUB_CLIENT_SECRET', config.github.clientSecret],
    ['JWT_SECRET', process.env.JWT_SECRET],
    ['TOKEN_ENCRYPTION_KEY', config.tokenEncryptionKey],
  ];

  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.warn(`[LeetGit] Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('[LeetGit] Some features may not work until these are configured.');
  }
}
