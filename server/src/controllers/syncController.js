import { performSync } from '../services/sync/syncService.js';
import { SyncRecord } from '../models/SyncRecord.js';

export const syncController = {
  async sync(req, res) {
    const result = await performSync(req.user._id, req.body || {});
    res.status(201).json(result);
  },
  async history(req, res) {
    const records = await SyncRecord.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30).lean();
    res.json({ records });
  },
};
