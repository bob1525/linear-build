export const DEMO_PASSWORD = "demo1234";

export const DEMO_USERS = [
  { name: "Ava Chen", email: "ava@northstar.dev" },
  { name: "Marcus Hale", email: "marcus@northstar.dev" },
  { name: "Priya Nair", email: "priya@northstar.dev" },
  { name: "Leo Park", email: "leo@northstar.dev" },
] as const;

export const PRIMARY_DEMO = DEMO_USERS[0];

export const DRAG_LAB = {
  key: "RLY",
  name: "Relay",
  backlog: (index: number) => `Relay backlog ${String(index).padStart(2, "0")}`,
  short: "Relay short todo",
  done: (index: number) => `Relay done ${String(index).padStart(2, "0")}`,
  backlogCount: 12,
  doneCount: 8,
} as const;

export const FIXTURES = {
  projectKey: "ORB",
  zephyrTitle: "Zephyr cache returns stale issue counts",
  dragTitle: "Offline edits to the description are lost",
  commentTitle: "Markdown tables overflow the issue pane",
  statusTitle: "Filter chips wrap under the view header",
  hiddenTitle: "Add saved views for personal filters",
  listStatusTitle: "Priority sort disagrees between list and board",
  pulseTitle: "Offline queue replays comments twice",
} as const;
