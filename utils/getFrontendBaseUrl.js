module.exports = function getFrontendBaseUrl(req) {
  const origin = req.headers.origin || req.headers.referer || '';

  console.log(`Determining frontend base URL from origin: ${origin}`);
  if (origin.includes('localhost')) {
    return 'http://localhost:3000';
  }

  console.log(`Using FRONTEND_URL from environment: ${process.env.FRONTEND_URL}`);
  return process.env.FRONTEND_URL;
};
