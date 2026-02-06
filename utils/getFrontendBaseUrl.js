module.exports = function getFrontendBaseUrl(req) {
  const origin = req.headers.origin || req.headers.referer || '';

  if (origin.includes('localhost')) {
    return 'http://localhost:3000';
  }

  return process.env.FRONTEND_URL;
};
