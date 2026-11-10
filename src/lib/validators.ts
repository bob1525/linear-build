import { z } from "zod";

export const statusSchema = z.enum(["backlog", "todo", "in_progress", "done"]);
export const prioritySchema = z.enum(["none", "low", "medium", "high", "urgent"]);

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email")
  .transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
    email: emailSchema,
    password: z.string().min(8, "Use at least 8 characters").max(200, "Password is too long"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createIssueSchema = z.object({
  projectKey: z.string().trim().min(1),
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().max(20_000, "Description is too long").optional().default(""),
  status: statusSchema,
  priority: prioritySchema,
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labelIds: z.array(z.string()).max(20).optional(),
});

export const updateIssueSchema = z.object({
  issueId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long").optional(),
  description: z.string().max(20_000, "Description is too long").optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labelIds: z.array(z.string()).max(20).optional(),
});

export const commentSchema = z.object({
  issueId: z.string().min(1),
  body: z.string().trim().min(1, "Write a comment before posting").max(10_000, "Comment is too long"),
});

export const viewTypeSchema = z.enum(["board", "list"]);
export const issueSortSchema = z.enum(["priority", "newest", "title", "due"]);

export const issueFiltersSchema = z.object({
  statuses: z.array(statusSchema).max(4),
  priorities: z.array(prioritySchema).max(5),
  assignees: z.array(z.string()).max(30),
  labels: z.array(z.string()).max(30),
  query: z.string().max(200),
});

export const createViewSchema = z.object({
  projectKey: z.string().trim().min(1),
  name: z.string().trim().min(1, "Name the view").max(40, "That name is too long"),
  viewType: viewTypeSchema,
  sort: issueSortSchema,
  filters: issueFiltersSchema,
});

export const renameViewSchema = z.object({
  viewId: z.string().min(1),
  name: z.string().trim().min(1, "Name the view").max(40, "That name is too long"),
});

export const defaultViewSchema = z.object({
  viewId: z.string().min(1),
  isDefault: z.boolean(),
});

export const batchOpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("status"), status: statusSchema }),
  z.object({ type: z.literal("assignee"), assigneeId: z.string().min(1).nullable() }),
  z.object({ type: z.literal("add_label"), labelId: z.string().min(1) }),
  z.object({ type: z.literal("remove_label"), labelId: z.string().min(1) }),
  z.object({ type: z.literal("delete") }),
]);

export const batchSchema = z.object({
  projectKey: z.string().trim().min(1),
  issueIds: z.array(z.string().min(1)).min(1, "Select at least one issue").max(100, "Select 100 issues or fewer"),
  op: batchOpSchema,
});

export const relationKindSchema = z.enum(["blocks", "blocked_by", "related", "sub_issue"]);

export const changeRelationSchema = z.object({
  issueId: z.string().min(1),
  target: z.string().trim().min(1, "Enter an issue key").max(80),
  kind: relationKindSchema,
});

export const projectKeySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z][A-Z0-9]{1,4}$/, "Use 2–5 letters or numbers"));

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
  key: projectKeySchema,
  description: z.string().trim().max(280, "Description is too long").optional().default(""),
});

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the form and try again";
}

export function suggestProjectKey(name: string) {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const raw = words.length === 1 ? (words[0] ?? "").slice(0, 3) : words.map((word) => word[0] ?? "").join("").slice(0, 4);
  const cleaned = raw.replace(/[^A-Z0-9]/g, "");
  if (cleaned.length >= 2) return cleaned;
  return `${cleaned}PR`.slice(0, 3);
}
