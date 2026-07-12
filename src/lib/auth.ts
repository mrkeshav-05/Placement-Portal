import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

const ADMIN_EMAIL = "placements@iiitl.ac.in";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "tnp-local-development-secret-change-before-production"),
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({ authorization: { params: { prompt: "select_account", hd: "iiitl.ac.in" } } }),
    Credentials({
      name: "Development credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      authorize(credentials) {
        if (process.env.NODE_ENV === "production" || process.env.TEST_LOGIN_ENABLED === "false") return null;
        const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(credentials);
        if (!parsed.success) return null;
        const testEmail = process.env.TEST_STUDENT_EMAIL ?? "student@iiitl.ac.in";
        const testPassword = process.env.TEST_STUDENT_PASSWORD ?? "student123";
        const adminEmail = process.env.TEST_ADMIN_EMAIL ?? "admin@iiitl.ac.in";
        const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? "admin123";
        if (parsed.data.email === adminEmail && parsed.data.password === adminPassword) return { id: "local-test-admin", name: "Test Administrator", email: adminEmail, role: "ADMIN" };
        if (parsed.data.email === testEmail && parsed.data.password === testPassword) return { id: "local-test-student", name: "Test Student", email: testEmail, role: "STUDENT" };
        return null;
      }
    })
  ],
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider === "credentials") return process.env.NODE_ENV !== "production";
      const email = profile?.email?.toLowerCase();
      return Boolean(email && (email.endsWith("@iiitl.ac.in") || email === ADMIN_EMAIL));
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.email?.toLowerCase() === ADMIN_EMAIL || user.role === "ADMIN" ? "ADMIN" : "STUDENT";
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    }
  },
  events: {
    async createUser({ user }) {
      if (user.email?.toLowerCase() === ADMIN_EMAIL) {
        await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      }
    }
  }
});
