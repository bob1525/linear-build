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
