import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { loadRootEnv } from "../src/load-root-env";

loadRootEnv();

const db = new PrismaClient();
const BCRYPT_COST = 10;

// Matches STUDENT_EMAIL_DOMAIN's default (frontend/backend .env), which is
// what self-registration checks against. Roll numbers in the roster already
// use this domain for every row that has an institute address.
const STUDENT_EMAIL_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || "iiitl.ac.in";

type RosterRow = {
  "Institute Email ID": string;
  "Full Name": string;
  "Roll Number": string;
  "Graduation Year": string;
  Branch: string;
  Degree: string;
  Password: string;
};

async function main() {
  const file = path.resolve(__dirname, "..", "seed-data", "students.json");
  const raw = readFileSync(file, "utf8");
  const rows: RosterRow[] = JSON.parse(raw);

  const byRollNumber = new Map<string, RosterRow>();
  let duplicates = 0;
  for (const row of rows) {
    const rollNumber = row["Roll Number"].trim().toUpperCase();
    if (byRollNumber.has(rollNumber)) {
      duplicates++;
      continue;
    }
    byRollNumber.set(rollNumber, row);
  }

  // The roster's Password column is authoritative and re-applied on every
  // run: production rotates it by editing the JSON, reseeding, and emailing
  // each student their new password, so this script cannot treat an existing
  // hash as something to preserve. Rows that happen to share a password
  // (e.g. every row during local development) only pay bcrypt's cost once.
  const passwordHashes = new Map<string, Promise<string>>();
  function hashFor(password: string) {
    let pending = passwordHashes.get(password);
    if (!pending) {
      pending = hash(password, BCRYPT_COST);
      passwordHashes.set(password, pending);
    }
    return pending;
  }

  let created = 0;
  let updated = 0;
  let derivedEmail = 0;

  for (const [rollNumber, row] of byRollNumber) {
    const givenEmail = row["Institute Email ID"].trim().toLowerCase();
    const isInstituteEmail = givenEmail.endsWith(`@${STUDENT_EMAIL_DOMAIN.toLowerCase()}`);
    const email = isInstituteEmail ? givenEmail : `${rollNumber.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
    const personalEmail = isInstituteEmail ? null : givenEmail;
    if (!isInstituteEmail) derivedEmail++;

    const data = {
      name: row["Full Name"].trim(),
      branch: row.Branch.trim(),
      degree: row.Degree.trim(),
      batch: Number.parseInt(row["Graduation Year"], 10),
      personalEmail,
      passwordHash: await hashFor(row.Password),
    };

    const existing = await db.user.findUnique({ where: { rollNumber }, select: { id: true } });

    await db.user.upsert({
      where: { rollNumber },
      update: data,
      create: {
        ...data,
        email,
        rollNumber,
        role: Role.STUDENT,
        semGPAs: [],
      },
    });

    if (existing) updated++;
    else created++;
  }

  console.log(`Roster rows: ${rows.length} (${duplicates} duplicate row(s) skipped).`);
  console.log(`Institute accounts derived from roll number: ${derivedEmail}.`);
  console.log(`Password set from the roster for all ${byRollNumber.size} account(s).`);
  console.log(`Created ${created}, updated ${updated} student account(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
