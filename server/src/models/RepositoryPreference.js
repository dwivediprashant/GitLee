import mongoose from 'mongoose';

const repositoryPreferenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  owner: { type: String, required: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  defaultBranch: { type: String, default: 'main' },
  private: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

repositoryPreferenceSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const RepositoryPreference = mongoose.model('RepositoryPreference', repositoryPreferenceSchema);
