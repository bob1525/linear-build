import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD } from "../src/lib/demo-accounts";
import { hashPassword } from "../src/lib/password";

const COUNT = 500;
const STATUSES = ["backlog", "todo", "in_progress", "done"] as const;
const PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;

const prisma = new PrismaClient();

async function main() {
  await prisma.activity.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.issueLabel.deleteMany();
  await prisma.issueRelation.deleteMany();
  await prisma.savedView.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.label.deleteMany();
  await prisma.session.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      name: "Perf Runner",
      email: "perf@northstar.dev",
      passwordHash: await hashPassword(DEMO_PASSWORD),
    },
  });
  const project = await prisma.project.create({
    data: {
      key: "PERF",
      name: "Perf Lab",
      description: "500 issues for board measurements",
      members: { create: { userId: user.id, role: "member" } },
    },
  });

  const now = Date.now();
  const rows = Array.from({ length: COUNT }, (_, index) => {
    const stamp = new Date(now - (COUNT - index) * 60_000);
    return {
      projectId: project.id,
      number: index + 1,
      title: `Perf ${String(index + 1).padStart(3, "0")}`,
      description: `Measurement issue ${index + 1} for board load, filters, and drag.`,
      status: STATUSES[index % STATUSES.length]!,
      priority: PRIORITIES[index % PRIORITIES.length]!,
      creatorId: user.id,
      assigneeId: index % 3 === 0 ? user.id : null,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });

  for (let offset = 0; offset < rows.length; offset += 100) {
    await prisma.issue.createMany({ data: rows.slice(offset, offset + 100) });
  }

  const count = await prisma.issue.count({ where: { projectId: project.id } });
  if (count !== COUNT) throw new Error(`Expected ${COUNT} issues, found ${count}`);
  const high = await prisma.issue.count({ where: { projectId: project.id, priority: "high" } });
  console.log(`Seeded ${count} issues in PERF (${high} high priority)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
