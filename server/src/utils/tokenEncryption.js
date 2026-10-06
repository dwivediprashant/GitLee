import crypto from 'crypto';
import { config } from '../config/index.js';

function key() {
  if (!/^[a-f0-9]{64}$/i.test(config.tokenEncryptionKey || '')) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal key.');
  }
  return Buffer.from(config.tokenEncryptionKey, 'hex');
}

export function encryptToken(value) {
  if (!value) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptToken(value) {
  if (!value) return value;
  const [version, ivValue, tagValue, ciphertextValue] = value.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Stored GitHub token is not encrypted in a supported format. Reconnect GitHub.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
}
