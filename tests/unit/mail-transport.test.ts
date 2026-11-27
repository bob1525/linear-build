import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import tls from "node:tls";
import { afterAll, describe, expect, it } from "vitest";
import { mailStatusCopy, resolveMail, type MailMessage } from "@/lib/mail-config";
import { readOutbox } from "@/lib/mail-outbox";
import { sendSmtp } from "@/lib/mail-smtp";
import { sendMail } from "@/lib/mail";

const message: MailMessage = {
  to: "person@example.com",
  subject: "Reset your password",
  text: "Open the link.\n.not-the-end\n.",
};

type Captured = { auth: string | null; data: string };

function certificate() {
  const dir = mkdtempSync(path.join(tmpdir(), "northstar-smtp-"));
  const key = path.join(dir, "key.pem");
  const cert = path.join(dir, "cert.pem");
  execFileSync(
    "openssl",
    ["req", "-x509", "-newkey", "rsa:2048", "-keyout", key, "-out", cert, "-days", "1", "-nodes", "-subj", "/CN=localhost"],
    { stdio: "ignore" },
  );
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

class Lines {
  private buffer = Buffer.alloc(0);
  private wake: (() => void) | null = null;
  private failed: Error | null = null;

  constructor(private socket: net.Socket | tls.TLSSocket) {
    socket.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.wake?.();
      this.wake = null;
    });
    socket.on("error", (error) => this.fail(error));
    socket.on("close", () => this.fail(new Error("SMTP test connection closed")));
  }

  private fail(error: Error) {
    if (this.failed) return;
    this.failed = error;
    this.wake?.();
    this.wake = null;
  }

  detach() {
    this.socket.removeAllListeners("data");
    this.socket.removeAllListeners("error");
    this.socket.removeAllListeners("close");
  }

  async read(): Promise<string> {
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
}

async function readData(lines: Lines): Promise<string> {
  const body: string[] = [];
  while (true) {
    const line = await lines.read();
    if (line === ".") break;
    body.push(line.startsWith("..") ? line.slice(1) : line);
  }
  return body.join("\r\n");
}

async function speak(
  socket: net.Socket | tls.TLSSocket,
  captured: Captured,
  options: { greet?: boolean; starttls?: boolean },
) {
  const lines = new Lines(socket);
  const write = (line: string) => socket.write(`${line}\r\n`);
  if (options.greet !== false) write("220 localhost ESMTP");
  let authed = false;
  while (true) {
    const line = await lines.read();
    const [verb = "", ...rest] = line.split(" ");
    const command = verb.toUpperCase();
    const argument = rest.join(" ");
    if (command === "EHLO" || command === "HELO") {
      write(options.starttls ? "250-localhost\r\n250-STARTTLS\r\n250 AUTH PLAIN" : "250-localhost\r\n250 AUTH PLAIN");
    } else if (command === "STARTTLS") {
      if (!options.starttls) {
        write("500 No TLS");
        continue;
      }
      lines.detach();
      write("220 Ready");
      const upgraded = new tls.TLSSocket(socket, {
        isServer: true,
        secureContext: tls.createSecureContext(certificate()),
      });
      await speak(upgraded, captured, { greet: false });
      return;
    } else if (command === "AUTH") {
      const token = argument.replace(/^PLAIN\s+/i, "").trim();
      const decoded = Buffer.from(token, "base64").toString("utf8");
      const [, user, pass] = decoded.split("\0");
      if (user === "mailer" && pass === "secret") {
        authed = true;
        captured.auth = user;
        write("235 Authenticated");
      } else {
        write("535 Denied");
      }
    } else if (command === "MAIL" || command === "RCPT") {
      write("250 OK");
    } else if (command === "DATA") {
      write("354 Continue");
      captured.data = await readData(lines);
      captured.auth = authed ? captured.auth : null;
      write("250 Queued");
    } else if (command === "QUIT") {
      write("221 Bye");
      socket.end();
      return;
    } else {
      write("500 Unknown");
    }
  }
}

async function listen(kind: "plain" | "tls", onConnection: (socket: net.Socket | tls.TLSSocket) => void) {
  const cert = kind === "tls" ? certificate() : null;
  const server = kind === "tls" && cert ? tls.createServer(cert, (socket) => onConnection(socket)) : net.createServer((socket) => onConnection(socket));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SMTP test server has no port");
  return {
    port: address.port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("resolveMail", () => {
  it("keeps production off unless SMTP is fully configured", () => {
    expect(resolveMail({ NODE_ENV: "production" })).toMatchObject({
      mode: "disabled",
      reason: "SMTP_URL and MAIL_FROM are not set, so mail stays off.",
    });
    expect(resolveMail({ NODE_ENV: "production", SMTP_URL: "smtp://127.0.0.1:2525" })).toMatchObject({ mode: "disabled" });
    expect(resolveMail({ NODE_ENV: "production", SMTP_URL: "https://mail.example", MAIL_FROM: "Northstar <a@b.co>" })).toMatchObject({
      mode: "disabled",
      reason: "SMTP_URL must be smtp:// or smtps://.",
    });
    expect(
      resolveMail({
        NODE_ENV: "production",
        MAIL_TRANSPORT: "outbox",
        MAIL_OUTBOX: "/tmp/should-not-be-used.jsonl",
      }),
    ).toMatchObject({ mode: "disabled", reason: "Production does not use the development outbox." });
    const ready = resolveMail({
      NODE_ENV: "production",
      SMTP_URL: "smtps://mailer:secret@smtp.example:465",
      MAIL_FROM: "Northstar <mail@example.com>",
    });
    expect(ready).toMatchObject({ mode: "smtp", from: { name: "Northstar", address: "mail@example.com" } });
  });

  it("uses the outbox in development and test, and honors an explicit mode", () => {
    expect(resolveMail({ NODE_ENV: "development" })).toMatchObject({
      mode: "outbox",
      path: ".mail/outbox.jsonl",
      from: { address: "northstar@localhost" },
    });
    expect(resolveMail({ NODE_ENV: "test", MAIL_OUTBOX: "/tmp/box.jsonl" })).toMatchObject({
      mode: "outbox",
      path: "/tmp/box.jsonl",
    });
    expect(resolveMail({ NODE_ENV: "development", SMTP_URL: "smtp://127.0.0.1:2525", MAIL_FROM: "a@b.co" }).mode).toBe("smtp");
    expect(resolveMail({ NODE_ENV: "development", MAIL_TRANSPORT: "off", SMTP_URL: "smtp://127.0.0.1:2525", MAIL_FROM: "a@b.co" }).mode).toBe(
      "disabled",
    );
    expect(resolveMail({ NODE_ENV: "test", MAIL_TRANSPORT: "maybe" }).mode).toBe("disabled");
  });

  it("describes the three states without claiming a message was sent", () => {
    const disabled = resolveMail({ NODE_ENV: "production" });
    const outbox = resolveMail({ NODE_ENV: "development" });
    const smtp = resolveMail({ NODE_ENV: "production", SMTP_URL: "smtp://127.0.0.1:2525", MAIL_FROM: "a@b.co" });
    expect(mailStatusCopy(disabled)).toBe("Email delivery is not configured, so features that send mail stay off.");
    expect(mailStatusCopy(outbox)).toContain("not delivered");
    expect(mailStatusCopy(smtp)).toBe("Email delivery is configured.");
    expect(mailStatusCopy(disabled)).not.toMatch(/sent/i);
  });
});

describe("outbox transport", () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function box() {
    const dir = await mkdtemp(path.join(tmpdir(), "northstar-outbox-"));
    dirs.push(dir);
    return path.join(dir, "outbox.jsonl");
  }

  it("appends messages a test can read back", async () => {
    const file = await box();
    const env = { NODE_ENV: "test", MAIL_OUTBOX: file, MAIL_FROM: "Northstar <mail@example.com>" };
    const first = await sendMail(message, env);
    const second = await sendMail({ to: "other@example.com", subject: "Second", text: "Again" }, env);
    expect(first).toEqual({ ok: true, mode: "outbox" });
    expect(second).toEqual({ ok: true, mode: "outbox" });
    const stored = await readOutbox(file);
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({
      from: '"Northstar" <mail@example.com>',
      to: "person@example.com",
      subject: "Reset your password",
      text: message.text,
    });
    expect(stored[1]?.subject).toBe("Second");
    expect(stored[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not write a file when production mail is off or the message is rejected", async () => {
    const file = await box();
    const blocked = await sendMail(message, { NODE_ENV: "production", MAIL_TRANSPORT: "outbox", MAIL_OUTBOX: file });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.mode).toBe("disabled");
    expect(existsSync(file)).toBe(false);
    const rejected = await sendMail(
      { to: "person@example.com", subject: "Hello\r\nBcc: hidden@example.com", text: "body" },
      { NODE_ENV: "test", MAIL_OUTBOX: file },
    );
    expect(rejected).toMatchObject({ ok: false, mode: "outbox" });
    expect(await readOutbox(file)).toEqual([]);
  });
});

describe("smtp transport", () => {
  it("delivers to an in-process server with AUTH PLAIN, including a dotted line", async () => {
    const captured: Captured = { auth: null, data: "" };
    const server = await listen("plain", (socket) => {
      void speak(socket, captured, {}).catch(() => socket.destroy());
    });
    try {
      const result = await sendMail(message, {
        NODE_ENV: "production",
        SMTP_URL: `smtp://mailer:secret@127.0.0.1:${server.port}`,
        MAIL_FROM: "Northstar <mail@example.com>",
      });
      expect(result).toEqual({ ok: true, mode: "smtp" });
      expect(captured.auth).toBe("mailer");
      expect(captured.data).toContain("Subject: Reset your password");
      expect(captured.data).toContain("From: \"Northstar\" <mail@example.com>");
      expect(captured.data).toContain("To: person@example.com");
      expect(captured.data).toContain(".not-the-end");
      expect(captured.data.split("\r\n")).toContain(".");
    } finally {
      await server.close();
    }
  });

  it("does not report success when the server rejects AUTH", async () => {
    const captured: Captured = { auth: null, data: "" };
    const server = await listen("plain", (socket) => {
      void speak(socket, captured, {}).catch(() => socket.destroy());
    });
    try {
      const result = await sendMail(message, {
        NODE_ENV: "production",
        SMTP_URL: `smtp://mailer:wrong@127.0.0.1:${server.port}`,
        MAIL_FROM: "mail@example.com",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("535");
      expect(captured.data).toBe("");
    } finally {
      await server.close();
    }
  });

  it("upgrades with STARTTLS and can use implicit TLS", async () => {
    const starttls: Captured = { auth: null, data: "" };
    const plain = await listen("plain", (socket) => {
      void speak(socket, starttls, { starttls: true }).catch(() => socket.destroy());
    });
    const implicit: Captured = { auth: null, data: "" };
    const secure = await listen("tls", (socket) => {
      void speak(socket, implicit, {}).catch(() => socket.destroy());
    });
    try {
      await sendSmtp({
        url: `smtp://mailer:secret@127.0.0.1:${plain.port}`,
        from: { name: null, address: "mail@example.com" },
        message,
        rejectUnauthorized: false,
      });
      expect(starttls.data).toContain("Subject: Reset your password");
      await sendSmtp({
        url: `smtps://mailer:secret@127.0.0.1:${secure.port}`,
        from: { name: null, address: "mail@example.com" },
        message,
        rejectUnauthorized: false,
      });
      expect(implicit.auth).toBe("mailer");
      expect(implicit.data).toContain("To: person@example.com");
      const rejected = await sendSmtp({
        url: `smtps://mailer:secret@127.0.0.1:${secure.port}`,
        from: { name: null, address: "mail@example.com" },
        message,
        rejectUnauthorized: true,
      }).then(
        () => "sent",
        (error: Error) => error.message,
      );
      expect(rejected).not.toBe("sent");
    } finally {
      await plain.close();
      await secure.close();
    }
  });
});
