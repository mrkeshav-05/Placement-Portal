import { PrismaClient } from "@prisma/client";
import { configuredAdminEmails } from "../src/lib/auth-access";

const db = new PrismaClient();

async function main() {
  const emails = [...configuredAdminEmails()];
  const externalEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const result = await db.user.updateMany({
    where: { email: { in: emails } },
    data: { role: "ADMIN" },
  });

  console.log(`Synchronized ${result.count} existing administrator account(s).`);
  const externalMatches = await db.user.count({
    where: { email: { in: externalEmails }, role: "ADMIN" },
  });
  console.log(`Matched ${externalMatches} configured external administrator account(s).`);
}

main().finally(() => db.$disconnect());
