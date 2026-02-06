const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,

        // ✅ Dynamic callback URL
        callbackURL:
          process.env.NODE_ENV === 'production'
            ? 'https://brainquest-backend.onrender.com/api/auth/google/callback'
            : 'http://localhost:5000/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const userData = {
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            displayName: profile.displayName,
            firstName: profile.name?.givenName,
            lastName: profile.name?.familyName,
            photo: profile.photos?.[0]?.value,
          };

          return done(null, userData);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
};
