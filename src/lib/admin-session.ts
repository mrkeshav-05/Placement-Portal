import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const requireAdmin = cache(async () => {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const isDevelopmentUser = session.user.id.startsWith("local-test-");
  const user = isDevelopmentUser
    ? null
    : await db.user.findUnique({ where: { id: session.user.id } });

  return { session, user, isDevelopmentUser };
});
