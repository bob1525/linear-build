import net from "node:net";
import tls from "node:tls";
import { formatMailbox, parseMailbox, type Mailbox, type MailMessage } from "@/lib/mail-config";

type MailSocket = net.Socket | tls.TLSSocket;

const SMTP_TIMEOUT_MS = 8_000;

class SmtpSession {
  private buffer = Buffer.alloc(0);
  private wake: (() => void) | null = null;
  private failed: Error | null = null;

  constructor(private socket: MailSocket) {
    this.watch(socket);
  }

  private watch(socket: MailSocket) {
    socket.setTimeout(SMTP_TIMEOUT_MS);
    socket.on("data", (chunk: Buffer | string) => {
      const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      this.buffer = Buffer.concat([this.buffer, next]);
      this.wake?.();
      this.wake = null;
    });
    socket.on("timeout", () => {
      this.fail(new Error("SMTP connection timed out"));
      socket.destroy();
    });
    socket.on("error", (error) => this.fail(error));
    socket.on("close", () => {
      if (!this.failed) this.fail(new Error("SMTP connection closed"));
    });
  }

  private fail(error: Error) {
    if (this.failed) return;
    this.failed = error;
    this.wake?.();
    this.wake = null;
  }

  private async nextLine(): Promise<string> {
    while (true) {
      const end = this.buffer.indexOf("\r\n");
      if (end >= 0) {
        const line = this.buffer.subarray(0, end).toString("utf8");
        this.buffer = this.buffer.subarray(end + 2);
        return line;
      }
      if (this.failed) throw this.failed;
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    }
  }

  async readReply(): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    while (true) {
      const line = await this.nextLine();
      const match = line.match(/^(\d{3})([ -])(.*)$/);
      if (!match) throw new Error(`SMTP reply was not understood: ${line}`);
      lines.push(line);
      if (match[2] === " ") return { code: Number(match[1]), lines };
    }
  }

  async command(line: string, codes: number[]): Promise<{ code: number; lines: string[] }> {
    this.socket.write(`${line}\r\n`);
    const reply = await this.readReply();
    if (!codes.includes(reply.code)) {
      throw new Error(`SMTP ${reply.code}: ${reply.lines.join(" | ")}`);
    }
    return reply;
  }

  write(data: string) {
    this.socket.write(data);
  }

  async startTls(host: string, rejectUnauthorized: boolean) {
    const plain = this.socket;
    plain.removeAllListeners("data");
    plain.removeAllListeners("timeout");
    plain.removeAllListeners("error");
    plain.removeAllListeners("close");
    this.failed = null;
    const secure = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const socket = tls.connect(
        { socket: plain, servername: serverName(host), rejectUnauthorized },
        () => resolve(socket),
      );
      socket.once("error", reject);
    });
    this.socket = secure;
    this.watch(secure);
  }

  end() {
    this.socket.end();
  }
}

function dotStuff(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function serverName(host: string): string | undefined {
  return net.isIP(host) ? undefined : host;
}

function connect(url: URL, rejectUnauthorized: boolean): Promise<MailSocket> {
  const port = Number(url.port || (url.protocol === "smtps:" ? 465 : 587));
  const host = url.hostname;
  if (url.protocol === "smtps:") {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({ host, port, servername: serverName(host), rejectUnauthorized }, () => resolve(socket));
      socket.once("error", reject);
    });
  }
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => resolve(socket));
    socket.once("error", reject);
  });
}

async function authenticate(session: SmtpSession, url: URL) {
  if (!url.username) return;
  const user = decodeURIComponent(url.username);
  const pass = decodeURIComponent(url.password);
  const token = Buffer.from(`\0${user}\0${pass}`).toString("base64");
  const reply = await session.command(`AUTH PLAIN ${token}`, [235, 334]);
  if (reply.code === 334) await session.command(token, [235]);
}

export async function sendSmtp(input: {
  url: string;
  from: Mailbox;
  message: MailMessage;
  rejectUnauthorized?: boolean;
}): Promise<void> {
  const url = new URL(input.url);
  if (url.protocol !== "smtp:" && url.protocol !== "smtps:") {
    throw new Error("SMTP_URL must be smtp:// or smtps://");
  }
  const recipient = parseMailbox(input.message.to);
  if (!recipient) throw new Error("That recipient is not an email address.");
  const rejectUnauthorized = input.rejectUnauthorized !== false;
  const socket = await connect(url, rejectUnauthorized);
  const session = new SmtpSession(socket);
  try {
    const greeting = await session.readReply();
    if (greeting.code !== 220) throw new Error(`SMTP ${greeting.code}: ${greeting.lines.join(" | ")}`);
    const hello = await session.command("EHLO northstar", [250]);
    const secure = url.protocol === "smtps:" || socket instanceof tls.TLSSocket;
    if (!secure && hello.lines.some((line) => /STARTTLS/i.test(line))) {
      await session.command("STARTTLS", [220]);
      await session.startTls(url.hostname, rejectUnauthorized);
      await session.command("EHLO northstar", [250]);
    }
    await authenticate(session, url);
    await session.command(`MAIL FROM:<${input.from.address}>`, [250]);
    await session.command(`RCPT TO:<${recipient.address}>`, [250, 251]);
    await session.command("DATA", [354]);
    const payload = [
      `From: ${formatMailbox(input.from)}`,
      `To: ${recipient.address}`,
      `Subject: ${input.message.subject.trim()}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.message.text,
    ].join("\r\n");
    session.write(`${dotStuff(payload)}\r\n.\r\n`);
    const accepted = await session.readReply();
    if (accepted.code !== 250) throw new Error(`SMTP ${accepted.code}: ${accepted.lines.join(" | ")}`);
    await session.command("QUIT", [221]);
  } finally {
    session.end();
  }
}
