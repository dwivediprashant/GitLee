import mongoose from 'mongoose';

const syncRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  problemTitle: { type: String, required: true },
  problemSlug: String,
  submissionId: String,
  language: { type: String, required: true },
  repositoryOwner: { type: String, required: true },
  repositoryName: { type: String, required: true },
  solutionPath: String,
  descriptionPath: String,
  commitSha: String,
  commitUrl: String,
  status: {
    type: String,
    enum: ['success', 'failed', 'partial'],
    required: true,
  },
  errorMessage: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

syncRecordSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

syncRecordSchema.index({ userId: 1, submissionId: 1 });
syncRecordSchema.index({ userId: 1, problemSlug: 1, language: 1 });

export const SyncRecord = mongoose.model('SyncRecord', syncRecordSchema);
