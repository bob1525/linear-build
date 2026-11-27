import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { sendMail } from "@/lib/mail";
import { resolveMail, type MailEnv } from "@/lib/mail-config";
import { hashPassword } from "@/lib/password";
import { consumeResetRequest } from "@/lib/rate-limit-store";
import { firstIssue, requestPasswordResetSchema, resetPasswordSchema } from "@/lib/validators";

export const RESET_TTL_MS = 30 * 60 * 1000;
export const RESET_UNAVAILABLE = "Password reset email is unavailable until mail delivery is configured.";
export const RESET_REQUEST_MESSAGE =
  "If an account exists for that email, a reset link is ready. It expires in 30 minutes and works once.";
export const RESET_INVALID = "This reset link is invalid or has expired.";

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function resetRequestOrigin(
  get: (name: string) => string | null,
  env: { TRUST_PROXY?: string } = { TRUST_PROXY: process.env.TRUST_PROXY },
) {
  const host = get("host")?.trim() ?? "";
  if (!host || /[\s/\\]/.test(host)) return null;
  const forwarded = env.TRUST_PROXY === "1" ? get("x-forwarded-proto")?.split(",")[0]?.trim() : "";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  const proto = forwarded === "http" || forwarded === "https" ? forwarded : local ? "http" : "https";
  return `${proto}://${host}`;
}

export async function requestPasswordReset(
  db: PrismaClient,
  input: { email: string; address: string; origin: string; env?: MailEnv; now?: number },
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = requestPasswordResetSchema.safeParse({ email: input.email });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!input.origin.startsWith("http://") && !input.origin.startsWith("https://")) {
    return { ok: false, error: RESET_UNAVAILABLE };
  }

  const env = input.env ?? process.env;
  if (resolveMail(env).mode === "disabled") return { ok: false, error: RESET_UNAVAILABLE };

  const now = input.now ?? Date.now();
  const limited = await consumeResetRequest(db, parsed.data.email, input.address, now);
  if (limited) return { ok: false, error: limited };

  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (!user) return { ok: true, message: RESET_REQUEST_MESSAGE };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  await db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    db.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(now + RESET_TTL_MS) },
    }),
  ]);

  const link = `${input.origin.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendMail(
    {
      to: parsed.data.email,
      subject: "Reset your Northstar password",
      text: `Reset your Northstar password.\n\nThis link expires in 30 minutes and works once:\n${link}\n\nIf you did not ask for this, you can ignore it.`,
    },
    env,
  );
  if (!sent.ok) {
    await db.passwordResetToken.deleteMany({ where: { tokenHash } });
    console.error(sent.reason);
    return { ok: true, message: RESET_REQUEST_MESSAGE };
  }
  return { ok: true, message: RESET_REQUEST_MESSAGE };
}

export async function resetPassword(
  db: PrismaClient,
  input: { token: string; newPassword: string; confirmPassword: string; now?: number },
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const now = input.now ?? Date.now();
  const tokenHash = hashResetToken(parsed.data.token);
  const passwordHash = await hashPassword(parsed.data.newPassword);

  const userId = await db.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row || row.expiresAt.getTime() <= now) return null;
    const removed = await tx.passwordResetToken.deleteMany({
      where: { id: row.id, expiresAt: { gt: new Date(now) } },
    });
    if (removed.count !== 1) return null;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    return row.userId;
  });
  if (!userId) return { ok: false, error: RESET_INVALID };
  return { ok: true, userId };
}
