import { resolveMail, validateMailMessage, type MailEnv, type MailMessage } from "@/lib/mail-config";
import { appendOutbox, outboxRecord } from "@/lib/mail-outbox";
import { sendSmtp } from "@/lib/mail-smtp";

export type MailResult =
  | { ok: true; mode: "smtp" | "outbox" }
  | { ok: false; mode: "disabled" | "smtp" | "outbox"; reason: string };

export async function sendMail(message: MailMessage, env: MailEnv = process.env): Promise<MailResult> {
  const config = resolveMail(env);
  if (config.mode === "disabled") return { ok: false, mode: "disabled", reason: config.reason };
  const invalid = validateMailMessage(message);
  if (invalid) return { ok: false, mode: config.mode, reason: invalid };
  if (config.mode === "outbox") {
    await appendOutbox(config.path, outboxRecord(config.from, message));
    return { ok: true, mode: "outbox" };
  }
  try {
    await sendSmtp({ url: config.url, from: config.from, message });
    return { ok: true, mode: "smtp" };
  } catch (error) {
    return {
      ok: false,
      mode: "smtp",
      reason: error instanceof Error ? error.message : "SMTP send failed",
    };
  }
}
