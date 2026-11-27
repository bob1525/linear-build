export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type Mailbox = {
  name: string | null;
  address: string;
};

export type MailConfig =
  | { mode: "disabled"; reason: string }
  | { mode: "smtp"; url: string; from: Mailbox }
  | { mode: "outbox"; path: string; from: Mailbox };

export type MailEnv = {
  NODE_ENV?: string;
  SMTP_URL?: string;
  MAIL_FROM?: string;
  MAIL_OUTBOX?: string;
  MAIL_TRANSPORT?: string;
};

const DEFAULT_OUTBOX = ".mail/outbox.jsonl";
const DEFAULT_FROM = "Northstar <northstar@localhost>";

export function parseMailbox(value: string): Mailbox | null {
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;
  const named = trimmed.match(/^(.*)<([^<>]+)>$/);
  const address = (named ? named[2] : trimmed).trim();
  const name = named ? named[1].trim().replace(/^"|"$/g, "") : null;
  if (!/^[^\s@]+@[^\s@]+$/.test(address)) return null;
  if (name && /[<>]/.test(name)) return null;
  return { name: name || null, address };
}

export function formatMailbox(mailbox: Mailbox): string {
  if (!mailbox.name) return mailbox.address;
  return `"${mailbox.name.replace(/"/g, "")}" <${mailbox.address}>`;
}

function smtpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "smtp:" && url.protocol !== "smtps:") return null;
    if (!url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function resolveMail(env: MailEnv = process.env): MailConfig {
  const transport = env.MAIL_TRANSPORT?.trim().toLowerCase() ?? "";
  const production = env.NODE_ENV === "production";
  const rawUrl = env.SMTP_URL?.trim() ?? "";
  const url = rawUrl ? smtpUrl(rawUrl) : null;
  const from = parseMailbox(env.MAIL_FROM?.trim() || (!production ? DEFAULT_FROM : ""));
  const path = env.MAIL_OUTBOX?.trim() || DEFAULT_OUTBOX;

  if (transport === "off" || transport === "disabled") {
    return { mode: "disabled", reason: "Mail is turned off." };
  }
  if (transport && transport !== "smtp" && transport !== "outbox") {
    return { mode: "disabled", reason: "MAIL_TRANSPORT must be smtp, outbox, or off." };
  }
  if (transport === "outbox") {
    if (production) {
      return { mode: "disabled", reason: "Production does not use the development outbox." };
    }
    if (!from) return { mode: "disabled", reason: "MAIL_FROM must be an email address." };
    return { mode: "outbox", path, from };
  }
  if (rawUrl && !url) {
    return { mode: "disabled", reason: "SMTP_URL must be smtp:// or smtps://." };
  }
  if (transport === "smtp" || url) {
    if (!url || !env.MAIL_FROM?.trim()) {
      return { mode: "disabled", reason: "SMTP_URL and MAIL_FROM are required to send mail." };
    }
    const smtpFrom = parseMailbox(env.MAIL_FROM.trim());
    if (!url || !smtpFrom) {
      return { mode: "disabled", reason: "SMTP_URL must be smtp:// or smtps:// and MAIL_FROM must be an email address." };
    }
    return { mode: "smtp", url, from: smtpFrom };
  }
  if (production) {
    return { mode: "disabled", reason: "SMTP_URL and MAIL_FROM are not set, so mail stays off." };
  }
  if (!from) return { mode: "disabled", reason: "MAIL_FROM must be an email address." };
  return { mode: "outbox", path, from };
}

export function mailStatusCopy(config: MailConfig): string {
  if (config.mode === "disabled") {
    return "Email delivery is not configured, so features that send mail stay off.";
  }
  if (config.mode === "outbox") {
    return "Email is saved on this server for development and is not delivered to an inbox.";
  }
  return "Email delivery is configured.";
}

export function validateMailMessage(message: MailMessage): string | null {
  if (!parseMailbox(message.to)) return "That recipient is not an email address.";
  const subject = message.subject.trim();
  if (!subject || /[\r\n]/.test(message.subject) || /[\r\n]/.test(message.to)) {
    return "The message subject cannot include a line break.";
  }
  if (typeof message.text !== "string" || !message.text.trim()) return "The message has no body.";
  return null;
}
