import { PrismaClient } from "@prisma/client";
import { DEFAULT_LABELS } from "../src/lib/constants";
import { DEMO_PASSWORD, DEMO_USERS, DRAG_LAB, FIXTURES } from "../src/lib/demo-accounts";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

type Status = "backlog" | "todo" | "in_progress" | "done";
type Priority = "none" | "low" | "medium" | "high" | "urgent";

type SeedComment = { author: string; body: string; daysAgo: number };
type SeedIssue = {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignee: string | null;
  dueInDays: number | null;
  labels: string[];
  createdDaysAgo: number;
  comments?: SeedComment[];
};

const ava = DEMO_USERS[0].email;
const marcus = DEMO_USERS[1].email;
const priya = DEMO_USERS[2].email;
const leo = DEMO_USERS[3].email;

function atNoon(offsetDays: number) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

function text(summary: string, extra?: string) {
  return extra ? `${summary}\n\n${extra}` : summary;
}

const orbitIssues: SeedIssue[] = [
  {
    title: "Board drag drops the card in the wrong column",
    description: `Dragging a card onto **Done** while the board is scrolled lands it in **In Progress** instead.

## Steps
1. Open the Orbit board
2. Scroll the In Progress column halfway down
3. Drag a card toward Done

## Expected
The card status becomes Done and the activity log records who moved it.

## Notes
- Reproduces in Chromium and Firefox
- Keyboard status changes are unaffected

| Browser | Result |
| --- | --- |
| Chromium | Drops one column short |
| Firefox | Same |
| Safari | Not reproduced |`,
    status: "in_progress",
    priority: "urgent",
    assignee: ava,
    dueInDays: 2,
    labels: ["Bug"],
    createdDaysAgo: 12,
    comments: [
      { author: marcus, daysAgo: 6, body: "I can reproduce this when the column has more than eight cards." },
      {
        author: ava,
        daysAgo: 4,
        body: "The drop target is using the column's pre-scroll box.\n\nI'll attach a failing test before changing the hit area.",
      },
      { author: priya, daysAgo: 2, body: "Let's keep the status menu as a fallback so nobody is blocked while this is open." },
    ],
  },
  {
    title: FIXTURES.statusTitle,
    description: text(
      "On a 1280px window the active filter chips wrap under the view switcher and cover the first board column.",
      "The chips should stay on their own row and the board should begin below them.",
    ),
    status: "todo",
    priority: "medium",
    assignee: marcus,
    dueInDays: 5,
    labels: ["Design"],
    createdDaysAgo: 9,
  },
  {
    title: FIXTURES.zephyrTitle,
    description: text(
      "The Zephyr cache keeps serving yesterday's counts after an issue moves columns.",
      "Search for `zephyr-cache` in the board header still shows the old total until a full reload.",
    ),
    status: "todo",
    priority: "high",
    assignee: priya,
    dueInDays: 1,
    labels: ["Bug", "Performance"],
    createdDaysAgo: 8,
    comments: [{ author: leo, daysAgo: 3, body: "Invalidating the cache on status change fixes it locally. I have not measured the extra query yet." }],
  },
  {
    title: FIXTURES.commentTitle,
    description: text(
      "Wide markdown tables force the issue page to scroll sideways and hide the properties panel.",
      "Tables should stay inside the description column.",
    ),
    status: "todo",
    priority: "low",
    assignee: leo,
    dueInDays: 9,
    labels: ["Bug"],
    createdDaysAgo: 7,
  },
  {
    title: "Keyboard shortcuts ignore the filter bar",
    description: text(
      "Pressing `/` does nothing after a filter menu has been opened and closed.",
      "Focus should return to the page so the search shortcut works again.",
    ),
    status: "in_progress",
    priority: "high",
    assignee: ava,
    dueInDays: 3,
    labels: ["Bug"],
    createdDaysAgo: 11,
    comments: [{ author: ava, daysAgo: 1, body: "The menu restores focus to `body`, but the shortcut listener is still attached. I'll check the capture phase next." }],
  },
  {
    title: FIXTURES.hiddenTitle,
    description: text(
      "People keep recreating the same status and assignee combination.",
      "A saved view would pin those filters to the sidebar.",
    ),
    status: "backlog",
    priority: "medium",
    assignee: null,
    dueInDays: 20,
    labels: ["Feature"],
    createdDaysAgo: 15,
  },
  {
    title: "Due dates shift a day for UTC- users",
    description: text(
      "A due date of May 2 renders as May 1 for anyone west of UTC.",
      "Store the calendar day and format it in UTC so the board matches the date picker.",
    ),
    status: "todo",
    priority: "high",
    assignee: marcus,
    dueInDays: -2,
    labels: ["Bug"],
    createdDaysAgo: 6,
  },
  {
    title: "Empty board states look unfinished",
    description: text("A brand new project shows four blank columns with no explanation.", "The empty state should invite the first issue and mention the `C` shortcut."),
    status: "done",
    priority: "medium",
    assignee: priya,
    dueInDays: -8,
    labels: ["Improvement"],
    createdDaysAgo: 18,
    comments: [{ author: priya, daysAgo: 10, body: "Shipped the empty state with a create button. Leaving this closed unless design wants another pass." }],
  },
  {
    title: "Comment composer should submit with ⌘Enter",
    description: text("People expect the comment field to submit with Command+Enter, same as the new-issue dialog."),
    status: "done",
    priority: "low",
    assignee: ava,
    dueInDays: -12,
    labels: ["Improvement"],
    createdDaysAgo: 20,
  },
  {
    title: "Project switcher forgets the last view",
    description: text("Switching from Pulse back to Orbit always opens the board, even if you were reading the list."),
    status: "todo",
    priority: "medium",
    assignee: leo,
    dueInDays: 6,
    labels: ["Improvement"],
    createdDaysAgo: 5,
  },
  {
    title: "Activity log should group burst edits",
    description: text("Renaming a title three times in a minute creates three identical activity rows.", "Group edits from the same person inside a five-minute window."),
    status: "backlog",
    priority: "low",
    assignee: null,
    dueInDays: null,
    labels: ["Feature"],
    createdDaysAgo: 4,
  },
  {
    title: "Label colors fail contrast on dark cards",
    description: text("The Docs label is hard to read against the card background.", "Bump the dot contrast and keep the text on the muted ink color."),
    status: "done",
    priority: "medium",
    assignee: priya,
    dueInDays: -4,
    labels: ["Design"],
    createdDaysAgo: 14,
  },
  {
    title: FIXTURES.listStatusTitle,
    description: text(
      "The list sorts urgent items first, while a board column is still using creation order.",
      "Both views should use priority, then issue number.",
    ),
    status: "todo",
    priority: "high",
    assignee: marcus,
    dueInDays: 4,
    labels: ["Bug"],
    createdDaysAgo: 3,
  },
  {
    title: "Invite teammates into a project",
    description: text("Owners can create projects but cannot add the coworkers who already have accounts.", "An invite field by email is enough for the first version."),
    status: "backlog",
    priority: "medium",
    assignee: null,
    dueInDays: 30,
    labels: ["Feature"],
    createdDaysAgo: 2,
  },
  {
    title: FIXTURES.dragTitle,
    description: text(
      "Editing a description without a network connection shows a saved state and then discards the draft.",
      "Keep the draft in the form and surface an error if the request fails.",
    ),
    status: "backlog",
    priority: "urgent",
    assignee: leo,
    dueInDays: -1,
    labels: ["Bug"],
    createdDaysAgo: 1,
  },
  {
    title: "Document issue webhook payloads",
    description: text("The public docs never show the JSON shape for status changes or comments.", "Add a short example for each activity type."),
    status: "backlog",
    priority: "low",
    assignee: ava,
    dueInDays: 14,
    labels: ["Docs"],
    createdDaysAgo: 13,
  },
  {
    title: "Reduce layout shift when the sidebar collapses",
    description: text("Closing the mobile menu jumps the board by a few pixels because the scrollbar appears late."),
    status: "in_progress",
    priority: "medium",
    assignee: marcus,
    dueInDays: 7,
    labels: ["Performance"],
    createdDaysAgo: 10,
    comments: [{ author: marcus, daysAgo: 2, body: "Reserving the scrollbar gutter removes most of the shift. I'll check Safari next." }],
  },
  {
    title: "Cycle time for the last six weeks",
    description: text("Leads keep asking how long issues sit in progress.", "A small chart on the project, not a full analytics suite."),
    status: "backlog",
    priority: "medium",
    assignee: null,
    dueInDays: null,
    labels: ["Feature"],
    createdDaysAgo: 16,
  },
  {
    title: "Search ranking prefers titles over comments",
    description: text("A keyword match in a comment currently ranks the same as a match in the title."),
    status: "done",
    priority: "low",
    assignee: priya,
    dueInDays: -6,
    labels: ["Improvement"],
    createdDaysAgo: 17,
  },
  {
    title: "Done column hides issues completed last quarter",
    description: text("Done is useful as a recent tray, not an archive of every finished issue.", "Collapse anything completed more than 30 days ago."),
    status: "backlog",
    priority: "low",
    assignee: leo,
    dueInDays: null,
    labels: ["Improvement"],
    createdDaysAgo: 19,
  },
];

const pulseIssues: SeedIssue[] = [
  {
    title: FIXTURES.pulseTitle,
    description: text("If the phone is offline when a comment is posted, the queue sends it twice after reconnect."),
    status: "in_progress",
    priority: "urgent",
    assignee: leo,
    dueInDays: 1,
    labels: ["Bug"],
    createdDaysAgo: 6,
    comments: [{ author: priya, daysAgo: 1, body: "I can reproduce on Android 14. iOS only duplicates when the app was force-quit." }],
  },
  {
    title: "Biometric unlock fails after reinstall",
    description: text("Face ID reports success and then returns the user to the login screen."),
    status: "todo",
    priority: "high",
    assignee: priya,
    dueInDays: 3,
    labels: ["Bug"],
    createdDaysAgo: 5,
  },
  {
    title: "Push notifications deep-link to the wrong issue",
    description: text("Tapping a comment notification opens the previous issue the user had viewed."),
    status: "todo",
    priority: "high",
    assignee: marcus,
    dueInDays: -3,
    labels: ["Bug"],
    createdDaysAgo: 8,
  },
  {
    title: "iPad board columns don't snap",
    description: text("The horizontal board scrolls freely and leaves columns half off-screen."),
    status: "in_progress",
    priority: "medium",
    assignee: ava,
    dueInDays: 6,
    labels: ["Design"],
    createdDaysAgo: 9,
  },
  {
    title: "Share sheet drops the issue key",
    description: text("Sharing an issue to Slack includes the title but not the ORB-123 identifier."),
    status: "todo",
    priority: "medium",
    assignee: leo,
    dueInDays: 8,
    labels: ["Bug"],
    createdDaysAgo: 4,
  },
  {
    title: "Dark mode icons look washed out",
    description: text("Status icons on the phone use the light-theme gray and disappear on the dark board."),
    status: "done",
    priority: "low",
    assignee: priya,
    dueInDays: -9,
    labels: ["Design"],
    createdDaysAgo: 15,
  },
  {
    title: "Add a home screen widget for due issues",
    description: text("A small widget listing issues due today would save a launch for people on the go."),
    status: "backlog",
    priority: "medium",
    assignee: null,
    dueInDays: 21,
    labels: ["Feature"],
    createdDaysAgo: 3,
  },
  {
    title: "Image paste in comments fails on Android",
    description: text("Pasting a screenshot into a comment shows a broken attachment and never uploads."),
    status: "in_progress",
    priority: "high",
    assignee: marcus,
    dueInDays: 2,
    labels: ["Bug"],
    createdDaysAgo: 7,
    comments: [{ author: marcus, daysAgo: 1, body: "The content URI is revoked before the upload starts. I'll copy the bytes first." }],
  },
  {
    title: "Reduce cold start on mid-range Android",
    description: text("Pulse takes almost four seconds to reach the board on a Pixel 6a."),
    status: "in_progress",
    priority: "medium",
    assignee: leo,
    dueInDays: 10,
    labels: ["Performance"],
    createdDaysAgo: 11,
  },
  {
    title: "Haptic feedback on status change",
    description: text("A light haptic when a card changes column would make the board feel less silent."),
    status: "backlog",
    priority: "low",
    assignee: null,
    dueInDays: null,
    labels: ["Improvement"],
    createdDaysAgo: 2,
  },
  {
    title: "VoiceOver skips the priority icon",
    description: text("Priority is only drawn as bars, so VoiceOver never announces urgent or high."),
    status: "todo",
    priority: "medium",
    assignee: ava,
    dueInDays: 5,
    labels: ["Bug"],
    createdDaysAgo: 12,
  },
  {
    title: "Release notes for 2.4",
    description: text("Write the store listing notes for offline comments, the widget exploration, and the icon fix."),
    status: "done",
    priority: "low",
    assignee: priya,
    dueInDays: -2,
    labels: ["Docs"],
    createdDaysAgo: 13,
  },
  {
    title: "Background refresh drains battery",
    description: text("The 15-minute sync keeps the radio awake even when nothing changed."),
    status: "todo",
    priority: "urgent",
    assignee: marcus,
    dueInDays: 1,
    labels: ["Performance"],
    createdDaysAgo: 4,
  },
  {
    title: "Tablet split view for issue detail",
    description: text("On iPad, opening an issue should keep the list visible beside the detail."),
    status: "backlog",
    priority: "medium",
    assignee: null,
    dueInDays: 25,
    labels: ["Feature"],
    createdDaysAgo: 14,
  },
];

const atlasIssues: SeedIssue[] = [
  {
    title: "Session store grows without expiry cleanup",
    description: text("Expired sessions stay in SQLite forever.", "Delete them when a new session is created and on a nightly sweep."),
    status: "in_progress",
    priority: "high",
    assignee: leo,
    dueInDays: 4,
    labels: ["Performance"],
    createdDaysAgo: 8,
  },
  {
    title: "SQLite backup window blocks writes",
    description: text("The nightly backup locks the database long enough for comment posts to fail."),
    status: "todo",
    priority: "urgent",
    assignee: marcus,
    dueInDays: 0,
    labels: ["Bug"],
    createdDaysAgo: 5,
    comments: [{ author: ava, daysAgo: 2, body: "Can we use the online backup API so readers and writers keep going?" }],
  },
  {
    title: "Audit log omits assignee changes",
    description: text("Status changes are recorded, but assigning or unassigning an issue leaves no activity row."),
    status: "todo",
    priority: "high",
    assignee: ava,
    dueInDays: 3,
    labels: ["Bug"],
    createdDaysAgo: 6,
  },
  {
    title: "Billing webhooks retry without backoff",
    description: text("A failing webhook retries every second and drowns the worker."),
    status: "in_progress",
    priority: "medium",
    assignee: priya,
    dueInDays: 2,
    labels: ["Bug"],
    createdDaysAgo: 9,
  },
  {
    title: "Provision preview databases per pull request",
    description: text("Review apps currently share one SQLite file.", "Give each preview its own database and seed."),
    status: "backlog",
    priority: "medium",
    assignee: null,
    dueInDays: 18,
    labels: ["Feature"],
    createdDaysAgo: 7,
  },
  {
    title: "Rotate demo credentials in staging",
    description: text("Staging still documents the old shared password.", "Point the README and the login hint at the current demo account."),
    status: "done",
    priority: "low",
    assignee: ava,
    dueInDays: -5,
    labels: ["Docs"],
    createdDaysAgo: 12,
  },
  {
    title: "Add read replicas for issue search",
    description: text("Keyword search is fine on one node and will not be once every project is in one database."),
    status: "backlog",
    priority: "medium",
    assignee: leo,
    dueInDays: null,
    labels: ["Feature"],
    createdDaysAgo: 11,
  },
  {
    title: "Grafana board for comment latency",
    description: text("We can see error rate but not how long a comment takes to appear for someone else."),
    status: "backlog",
    priority: "low",
    assignee: leo,
    dueInDays: 16,
    labels: ["Docs"],
    createdDaysAgo: 10,
  },
  {
    title: "Password hashing should stay on the Node runtime",
    description: text("The session lookup was accidentally considered for the edge runtime, which cannot run the password hasher."),
    status: "done",
    priority: "medium",
    assignee: marcus,
    dueInDays: -7,
    labels: ["Improvement"],
    createdDaysAgo: 15,
  },
  {
    title: "Alert when migration time exceeds five seconds",
    description: text("A slow migration currently pages nobody until the app is already down."),
    status: "todo",
    priority: "medium",
    assignee: priya,
    dueInDays: 6,
    labels: ["Improvement"],
    createdDaysAgo: 3,
  },
  {
    title: "Region failover runbook is stale",
    description: text("The runbook still mentions the hosted Postgres instance we left last spring."),
    status: "backlog",
    priority: "high",
    assignee: priya,
    dueInDays: -1,
    labels: ["Docs"],
    createdDaysAgo: 13,
  },
  {
    title: "Compress activity payloads at rest",
    description: text("Activity rows store small JSON documents that compress well and are rarely read in bulk."),
    status: "backlog",
    priority: "low",
    assignee: null,
    dueInDays: null,
    labels: ["Performance"],
    createdDaysAgo: 2,
  },
];

function relayIssue(title: string, status: Status): SeedIssue {
  return {
    title,
    description: text("Drag-lab fixture for scroll, empty-column, and repeated moves."),
    status,
    priority: "medium",
    assignee: ava,
    dueInDays: 4,
    labels: ["Bug"],
    createdDaysAgo: 6,
  };
}

const relayIssues: SeedIssue[] = [
  ...Array.from({ length: DRAG_LAB.backlogCount }, (_, index) => relayIssue(DRAG_LAB.backlog(index + 1), "backlog")),
  relayIssue(DRAG_LAB.short, "todo"),
  ...Array.from({ length: DRAG_LAB.doneCount }, (_, index) => relayIssue(DRAG_LAB.done(index + 1), "done")),
];

const projects = [
  {
    key: "ORB",
    name: "Orbit",
    description: "Core product workspace for the Northstar web app.",
    color: "#5e6ad2",
    sortOrder: 0,
    issues: orbitIssues,
  },
  {
    key: "PLS",
    name: "Pulse",
    description: "iOS and Android client.",
    color: "#26b5ce",
    sortOrder: 1,
    issues: pulseIssues,
  },
  {
    key: "ATL",
    name: "Atlas",
    description: "Platform, billing, and infrastructure.",
    color: "#f2c94c",
    sortOrder: 2,
    issues: atlasIssues,
  },
  {
    key: DRAG_LAB.key,
    name: DRAG_LAB.name,
    description: "Drag lab: a long backlog, a short todo column, an empty in-progress column, and a scrollable done column.",
    color: "#bb87fc",
    sortOrder: 3,
    issues: relayIssues,
  },
];

function previousStatus(status: Status): Status | null {
  if (status === "todo") return "backlog";
  if (status === "in_progress") return "todo";
  if (status === "done") return "in_progress";
  return null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and try again.");
  }

  await prisma.activity.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.issueLabel.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.label.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.session.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = new Map<string, { id: string; name: string }>();
  for (const demo of DEMO_USERS) {
    const user = await prisma.user.create({
      data: { name: demo.name, email: demo.email, passwordHash },
    });
    users.set(demo.email, { id: user.id, name: user.name });
  }

  for (const project of projects) {
    const created = await prisma.project.create({
      data: {
        key: project.key,
        name: project.name,
        description: project.description,
        color: project.color,
        sortOrder: project.sortOrder,
        labels: { create: DEFAULT_LABELS.map((label) => ({ name: label.name, color: label.color })) },
        members: {
          create: DEMO_USERS.map((demo, index) => ({
            userId: users.get(demo.email)!.id,
            role: index === 0 ? "owner" : "member",
          })),
        },
      },
      include: { labels: true },
    });
    const labels = new Map(created.labels.map((label) => [label.name, label.id]));

    for (const [index, issue] of project.issues.entries()) {
      const creator = users.get(issue.assignee ?? ava)!;
      const assignee = issue.assignee ? users.get(issue.assignee)! : null;
      const createdAt = atNoon(-issue.createdDaysAgo);
      const labelIds = issue.labels.map((name) => {
        const id = labels.get(name);
        if (!id) throw new Error(`Missing label ${name}`);
        return id;
      });

      const record = await prisma.issue.create({
        data: {
          projectId: created.id,
          number: index + 1,
          title: issue.title,
          description: issue.description,
          status: issue.status,
          priority: issue.priority,
          assigneeId: assignee?.id ?? null,
          creatorId: creator.id,
          dueDate: issue.dueInDays === null ? null : atNoon(issue.dueInDays),
          createdAt,
          updatedAt: createdAt,
          labels: { create: labelIds.map((labelId) => ({ labelId })) },
        },
      });

      const activities: { type: string; payload: string; actorId: string; createdAt: Date }[] = [
        { type: "created", payload: "{}", actorId: creator.id, createdAt },
      ];
      if (assignee) {
        activities.push({
          type: "assignee_changed",
          payload: JSON.stringify({ fromId: null, fromName: null, toId: assignee.id, toName: assignee.name }),
          actorId: creator.id,
          createdAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
        });
      }
      const from = previousStatus(issue.status);
      if (from) {
        activities.push({
          type: "status_changed",
          payload: JSON.stringify({ from, to: issue.status }),
          actorId: assignee?.id ?? creator.id,
          createdAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
        });
      }

      for (const comment of issue.comments ?? []) {
        const author = users.get(comment.author)!;
        const when = atNoon(-comment.daysAgo);
        await prisma.comment.create({
          data: { issueId: record.id, authorId: author.id, body: comment.body, createdAt: when, updatedAt: when },
        });
        activities.push({
          type: "commented",
          payload: "{}",
          actorId: author.id,
          createdAt: when,
        });
      }

      await prisma.activity.createMany({
        data: activities.map((activity) => ({ ...activity, issueId: record.id })),
      });
    }
  }

  const counts = await prisma.issue.groupBy({ by: ["projectId"], _count: true });
  const total = counts.reduce((sum, row) => sum + row._count, 0);
  console.log(`Seeded ${users.size} users, ${projects.length} projects, and ${total} issues.`);
  console.log(`Demo login: ${ava} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
