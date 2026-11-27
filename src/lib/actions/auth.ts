"use server";

import { cookies, headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/cookies";
import { getLandingPath } from "@/lib/data";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { RATE_LIMIT_MESSAGE, readClientAddress } from "@/lib/rate-limit";
import { consumeSignup, loginIsLimited, passwordChangeIsLimited, recordLoginFailure, recordLoginSuccess, recordPasswordFailure } from "@/lib/rate-limit-store";
import { fail, ok, type ActionResult } from "@/lib/types";
import { changePasswordSchema, firstIssue, loginSchema, signupSchema } from "@/lib/validators";

async function clientAddress() {
  const headerStore = await headers();
  return readClientAddress((name) => headerStore.get(name));
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const address = await clientAddress();
  const email = parsed.data.email;
  if (await loginIsLimited(prisma, email, address)) return fail(RATE_LIMIT_MESSAGE);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    if (!(await recordLoginFailure(prisma, email, address))) return fail(RATE_LIMIT_MESSAGE);
    return fail("Invalid email or password");
  }

  if (!(await recordLoginSuccess(prisma, email, address))) return fail(RATE_LIMIT_MESSAGE);
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

  const address = await clientAddress();
  const limited = await consumeSignup(prisma, parsed.data.email, address);
  if (limited) return fail(limited);

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

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult<{ updated: true }>> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in to change your password");

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const address = await clientAddress();
  if (await passwordChangeIsLimited(prisma, user.email, address)) return fail(RATE_LIMIT_MESSAGE);

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) {
    if (!(await recordPasswordFailure(prisma, user.email, address))) return fail(RATE_LIMIT_MESSAGE);
    return fail("Current password is incorrect");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await prisma.session.deleteMany({
    where: { userId: user.id, ...(token ? { NOT: { token } } : {}) },
  });
  return ok({ updated: true });
}

export async function logoutAction(): Promise<ActionResult<{ redirectTo: string }>> {
  await destroySession();
  return ok({ redirectTo: "/login" });
}
