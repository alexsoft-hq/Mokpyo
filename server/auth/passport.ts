import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../lib/prisma';


export function setupPassport() {
  // Only setup Google OAuth if credentials are provided
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            // Find or create user
            let user = await prisma.user.findUnique({
              where: { googleId: profile.id },
            });

            if (!user) {
              // Create new user
              user = await prisma.user.create({
                data: {
                  googleId: profile.id,
                  email: profile.emails?.[0]?.value || '',
                  name: profile.displayName,
                  picture: profile.photos?.[0]?.value,
                },
              });
              // Auto-create default workspace for new OAuth users
              await prisma.organization.create({
                data: {
                  name: `${user.name}의 워크스페이스`,
                  slug: `ws-${user.id.slice(0, 8)}`,
                  members: { create: { userId: user.id, role: 'OWNER' } },
                },
              });
            } else {
              // Update user info (in case name or picture changed)
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  name: profile.displayName,
                  picture: profile.photos?.[0]?.value,
                },
              });
            }

            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  } else {
    console.log('⚠️  Google OAuth not configured - skipping authentication setup');
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}
