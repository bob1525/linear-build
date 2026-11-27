"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  VIEW_ERRORS,
  createView,
  deleteView,
  renameView,
  setDefaultView,
  viewNameKey,
  type SavedView,
} from "@/lib/saved-views";
import { fail, ok, type ActionResult, type SavedViewDTO } from "@/lib/types";
import { parseStoredFilters } from "@/lib/view-state";
import { createViewSchema, defaultViewSchema, firstIssue, renameViewSchema } from "@/lib/validators";

function toDTO(view: SavedView): SavedViewDTO {
  return {
    id: view.id,
    name: view.name,
    viewType: view.viewType,
    sort: view.sort,
    filters: view.filters,
    isDefault: view.isDefault,
  };
}

function revalidateProject(projectKey: string) {
  revalidatePath(`/p/${projectKey}`);
  revalidatePath(`/p/${projectKey}/list`);
}

async function memberProject(userId: string, projectKey: string) {
  const project = await prisma.project.findUnique({
    where: { key: projectKey.toUpperCase() },
    select: { id: true, key: true, members: { select: { userId: true } } },
  });
  if (!project || !project.members.some((member) => member.userId === userId)) return null;
  return project;
}

async function loadViews(userId: string, projectId: string): Promise<SavedView[]> {
  const rows = await prisma.savedView.findMany({ where: { projectId } });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    name: row.name,
    viewType: row.viewType === "list" ? "list" : "board",
    sort: row.sort === "newest" || row.sort === "title" || row.sort === "due" ? row.sort : "priority",
    filters: parseStoredFilters(row.filters),
    isDefault: row.isDefault,
  }));
}

export async function createSavedViewAction(input: unknown): Promise<ActionResult<SavedViewDTO>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");
  const parsed = createViewSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const project = await memberProject(user.id, parsed.data.projectKey);
  if (!project) return fail("Project not found");

  const existing = await loadViews(user.id, project.id);
  const draftId = "pending";
  const planned = createView(existing, { ...parsed.data, id: draftId, userId: user.id, projectId: project.id });
  if (!planned.ok) return fail(planned.error);

  try {
    const created = await prisma.savedView.create({
      data: {
        userId: user.id,
        projectId: project.id,
        name: planned.view.name,
        nameKey: viewNameKey(planned.view.name),
        viewType: planned.view.viewType,
        sort: planned.view.sort,
        filters: JSON.stringify(planned.view.filters),
        isDefault: false,
      },
    });
    revalidateProject(project.key);
    return ok(toDTO({ ...planned.view, id: created.id }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail(VIEW_ERRORS.duplicate);
    console.error(error);
    return fail("Could not save the view. Please try again.");
  }
}

export async function renameSavedViewAction(input: unknown): Promise<ActionResult<SavedViewDTO>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");
  const parsed = renameViewSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const row = await prisma.savedView.findUnique({ where: { id: parsed.data.viewId }, include: { project: { select: { id: true, key: true } } } });
  if (!row || row.userId !== user.id) return fail(VIEW_ERRORS.missing);
  const existing = await loadViews(user.id, row.projectId);
  const planned = renameView(existing, user.id, row.id, parsed.data.name);
  if (!planned.ok) return fail(planned.error);

  try {
    await prisma.savedView.update({
      where: { id: row.id },
      data: { name: planned.view.name, nameKey: viewNameKey(planned.view.name) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail(VIEW_ERRORS.duplicate);
    console.error(error);
    return fail("Could not rename the view. Please try again.");
  }
  revalidateProject(row.project.key);
  return ok(toDTO(planned.view));
}

export async function deleteSavedViewAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");
  const viewId = typeof input === "object" && input && "viewId" in input && typeof input.viewId === "string" ? input.viewId : "";
  if (!viewId) return fail(VIEW_ERRORS.missing);

  const row = await prisma.savedView.findUnique({ where: { id: viewId }, include: { project: { select: { key: true } } } });
  if (!row || row.userId !== user.id) return fail(VIEW_ERRORS.missing);
  const existing = await loadViews(user.id, row.projectId);
  const planned = deleteView(existing, user.id, viewId);
  if (!planned.ok) return fail(planned.error);
  await prisma.savedView.delete({ where: { id: viewId } });
  revalidateProject(row.project.key);
  return ok({ id: viewId });
}

export async function setDefaultSavedViewAction(input: unknown): Promise<ActionResult<SavedViewDTO>> {
  const user = await getCurrentUser();
  if (!user) return fail("You need to sign in again");
  const parsed = defaultViewSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const row = await prisma.savedView.findUnique({ where: { id: parsed.data.viewId }, include: { project: { select: { key: true } } } });
  if (!row || row.userId !== user.id) return fail(VIEW_ERRORS.missing);
  const existing = await loadViews(user.id, row.projectId);
  const planned = setDefaultView(existing, user.id, row.id, parsed.data.isDefault);
  if (!planned.ok) return fail(planned.error);

  await prisma.$transaction([
    ...(parsed.data.isDefault
      ? [
          prisma.savedView.updateMany({
            where: { userId: user.id, projectId: row.projectId, id: { not: row.id } },
            data: { isDefault: false },
          }),
        ]
      : []),
    prisma.savedView.update({ where: { id: row.id }, data: { isDefault: parsed.data.isDefault } }),
  ]);
  revalidateProject(row.project.key);
  return ok(toDTO(planned.view));
}
