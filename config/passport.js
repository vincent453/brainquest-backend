const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,

        // ✅ MUST be absolute & match Google Console
        callbackURL:
          'https://brainquest-app.onrender.com/auth/google/callback',
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
