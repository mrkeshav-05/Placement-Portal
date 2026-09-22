import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";
import { canUsePasswordAccount, isAdminEmail, resolveRole } from "@/lib/auth-access";
import { passwordLoginSchema } from "@/lib/credentials-schema";
import { clearFailedAttempts, isLockedOut, recordFailedAttempt } from "@/lib/login-throttle";
import { verifyPassword } from "@/lib/password";
import { computeEffectivePermissions } from "@/lib/permissions";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

const DEVELOPMENT_SECRET = "tnp-local-development-secret-change-before-production";

// Resolved lazily rather than at module load: `next build` evaluates this
// module with NODE_ENV=production and no secret available, so throwing here
// would break the production image build.
function authSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  return process.env.NODE_ENV === "production" ? undefined : DEVELOPMENT_SECRET;
}

export function requireAuthSecret() {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET must be set in production.");
  return secret;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret(),
  trustHost: true,
  // No adapter: the only provider is Credentials, which Auth.js never
  // persists, and sessions are JWTs. The Prisma `Account`, `Session`, and
  // `VerificationToken` tables are left in place but are no longer written.
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      name: "Institute email",
      credentials: {
        email: { label: "Institute email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // This is the only place a password is checked. Every rule that limits
      // password sign-in lives here rather than in the signIn callback,
      // because returning null is what keeps the failure indistinguishable
      // from a wrong password.
      async authorize(raw) {
        const parsed = passwordLoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Institute domain, or an address the operator put in ADMIN_EMAILS.
        if (!canUsePasswordAccount(email)) return null;
        if (await isLockedOut(email)) return null;

        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, isActive: true, passwordHash: true },
        });

        // A missing hash means the account exists but has no password yet:
        // a seeded administrator, or a row left over from the Google era.
        // Those are given a password by an administrator or by the
        // set-password script, never by guessing one here.
        if (!user?.passwordHash || user.isActive === false) {
          await recordFailedAttempt(email);
          return null;
        }

        if (!(await verifyPassword(password, user.passwordHash))) {
          await recordFailedAttempt(email);
          return null;
        }

        await clearFailedAttempts(email);
        // The jwt callback re-reads the role and permissions from the
        // database, so this only has to satisfy the augmented User type.
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // authorize() is the gate: it has already checked the domain, the
      // stored password, and the active flag. All that is left is keeping
      // the stored role in step with ADMIN_EMAILS, which is recomputed per
      // request anyway but is also written back so admin pages that read the
      // row agree with the session.
      const email = user.email?.toLowerCase();
      if (isAdminEmail(email)) {
        await db.user.updateMany({
          where: { email, NOT: { role: "SUPER_ADMIN" } },
          data: { role: "SUPER_ADMIN" },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.email = user.email ?? token.email;
      }

      if (token.email && isAdminEmail(token.email)) {
        token.role = "SUPER_ADMIN";
        token.isActive = true;
      } else if (token.id) {
        // Query user's current role, title, active status, and permissions from DB
        const dbUser = await db.user.findUnique({
          where: { id: token.id },
          select: { role: true, title: true, customPermissions: true, isActive: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.title = dbUser.title;
          token.isActive = dbUser.isActive;
          token.customPermissions = dbUser.customPermissions;
        } else {
          token.role = resolveRole(token.email);
          token.isActive = true;
        }
      } else {
        token.role = resolveRole(token.email);
        token.isActive = true;
      }

      const effective = computeEffectivePermissions(
        token.role,
        token.customPermissions ?? [],
        token.email,
      );
      token.effectivePermissions = effective;

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role as Role;
      session.user.title = token.title;
      session.user.isActive = token.isActive !== false;
      session.user.customPermissions = token.customPermissions ?? [];
      session.user.effectivePermissions = token.effectivePermissions ?? [];

      session.accessToken = await new SignJWT({
        sub: token.id,
        email: token.email,
        role: token.role,
        title: token.title,
        isActive: token.isActive !== false,
        customPermissions: token.customPermissions ?? [],
        permissions: token.effectivePermissions ?? [],
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1d")
        .sign(new TextEncoder().encode(requireAuthSecret()));
      return session;
    },
  },
  // There is no createUser event: nothing creates a user through Auth.js any
  // more. Registration creates student rows directly, and staff accounts,
  // including the permissions a placement team member starts with, are
  // provisioned from /admin/users.
});
