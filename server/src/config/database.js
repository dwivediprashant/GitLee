import mongoose from 'mongoose';
import { config } from './index.js';

export async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('[GitLee] MongoDB connected');
  } catch (err) {
    console.error('[GitLee] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}
