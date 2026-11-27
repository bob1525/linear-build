import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { formatMailbox, type Mailbox, type MailMessage } from "@/lib/mail-config";

export type OutboxMessage = MailMessage & {
  from: string;
  createdAt: string;
};

export async function appendOutbox(file: string, message: OutboxMessage): Promise<void> {
  const target = path.resolve(file);
  await mkdir(path.dirname(target), { recursive: true });
  await appendFile(target, `${JSON.stringify(message)}\n`, "utf8");
}

export async function readOutbox(file: string): Promise<OutboxMessage[]> {
  try {
    const text = await readFile(path.resolve(file), "utf8");
    return text
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as OutboxMessage);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export function outboxRecord(from: Mailbox, message: MailMessage, createdAt = new Date().toISOString()): OutboxMessage {
  return {
    from: formatMailbox(from),
    to: message.to.trim(),
    subject: message.subject.trim(),
    text: message.text,
    createdAt,
  };
}
