"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getCurrentUser, rememberProject } from "@/lib/auth";
import { DEFAULT_LABELS, PROJECT_COLORS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/types";
import { createProjectSchema, firstIssue } from "@/lib/validators";

export async function createProjectAction(input: unknown): Promise<ActionResult<{ key: string; redirectTo: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  try {
    const aggregate = await prisma.project.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (aggregate._max.sortOrder ?? -1) + 1;
    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        key: parsed.data.key,
        description: parsed.data.description,
        color: PROJECT_COLORS[sortOrder % PROJECT_COLORS.length] ?? PROJECT_COLORS[0],
        sortOrder,
        members: { create: { userId: user.id, role: "owner" } },
        labels: { create: DEFAULT_LABELS.map((label) => ({ ...label })) },
      },
    });
    await rememberProject(project.key);
    revalidatePath("/");
    revalidatePath("/welcome");
    return ok({ key: project.key, redirectTo: `/p/${project.key}` });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("That project key is already in use");
    }
    console.error(error);
    return fail("Could not create the project. Please try again.");
  }
}
