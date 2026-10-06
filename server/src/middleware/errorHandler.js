export function errorHandler(err, req, res, next) {
  console.error('[LeetGit] Unhandled error:', err.message);

  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'An unexpected error occurred';

  res.status(status).json({ message, ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) });
}
