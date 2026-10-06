import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/User.js';

export async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. Please connect your GitHub account.' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found. Please reconnect your GitHub account.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired. Please reconnect your GitHub account.' });
  }
}
