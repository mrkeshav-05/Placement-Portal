import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "placements@iiitl.ac.in" },
    update: { role: Role.ADMIN },
    create: {
      name: "Placement Office",
      email: "placements@iiitl.ac.in",
      role: Role.ADMIN,
      semGPAs: [],
    },
  });
}

main().finally(() => prisma.$disconnect());
