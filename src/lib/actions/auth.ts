"use server";

import { Prisma } from "@prisma/client";
import { createSession, destroySession } from "@/lib/auth";
import { getLandingPath } from "@/lib/data";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { fail, ok, type ActionResult } from "@/lib/types";
import { firstIssue, loginSchema, signupSchema } from "@/lib/validators";

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return fail("Invalid email or password");
  }

  await createSession(user.id);
  return ok({ redirectTo: await getLandingPath(user.id) });
}

export async function signupAction(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
    await createSession(user.id);
    return ok({ redirectTo: "/welcome" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("An account with this email already exists");
    }
    console.error(error);
    return fail("Could not create your account. Please try again.");
  }
}

export async function logoutAction(): Promise<ActionResult<{ redirectTo: string }>> {
  await destroySession();
  return ok({ redirectTo: "/login" });
}
