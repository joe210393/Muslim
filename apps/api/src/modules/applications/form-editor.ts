import { ErrorCodes, parseCategoryDefinition, type CategoryDefinition } from "@mf/contracts";
import { Prisma, prisma } from "@mf/db/server";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import { assertFeature } from "../platform/access";

function readDefinition(raw: unknown): CategoryDefinition {
  try {
    return parseCategoryDefinition(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, error.issues[0]?.message ?? "表單內容不正確");
    }
    throw error;
  }
}

function sameDefinition(left: CategoryDefinition, right: CategoryDefinition) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function getCategoryForm(actor: SessionActor, categoryId: string) {
  await assertFeature(actor, "applications.decide");
  const category = await prisma.applicationCategory.findUnique({
    where: { id: categoryId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  const version = category?.versions[0];
  if (!category || !version) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到申請類別");
  return {
    categoryId: category.id,
    code: category.code,
    name: category.name,
    publishedVersion: version.version,
    publishedDefinition: readDefinition(version.definition),
    draftDefinition: category.draftDefinition == null ? null : readDefinition(category.draftDefinition),
  };
}

export async function saveCategoryFormDraft(actor: SessionActor, categoryId: string, raw: unknown) {
  await assertFeature(actor, "applications.decide");
  const definition = readDefinition(raw);
  const category = await prisma.applicationCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到申請類別");
  await prisma.applicationCategory.update({
    where: { id: categoryId },
    data: { draftDefinition: definition },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "FORM_DRAFT_SAVE",
      entityType: "ApplicationCategory",
      entityId: categoryId,
      requestId: randomUUID(),
      safeChanges: { code: category.code, fieldCount: definition.fields.length, attachmentCount: definition.attachmentRequirements.length },
    },
  });
  return getCategoryForm(actor, categoryId);
}

export async function publishCategoryForm(actor: SessionActor, categoryId: string, raw: unknown) {
  await assertFeature(actor, "applications.decide");
  const definition = readDefinition(raw);
  const category = await prisma.applicationCategory.findUnique({
    where: { id: categoryId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  const latest = category?.versions[0];
  if (!category || !latest) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到申請類別");
  if (sameDefinition(readDefinition(latest.definition), definition)) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "內容和目前正式版本相同，不用再完成一次");
  }
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.categoryFormVersion.create({
      data: {
        categoryId,
        version: latest.version + 1,
        configurationStatus: latest.configurationStatus,
        definition,
      },
    });
    await tx.applicationCategory.update({
      where: { id: categoryId },
      data: { draftDefinition: Prisma.DbNull },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "FORM_PUBLISH",
        entityType: "ApplicationCategory",
        entityId: categoryId,
        requestId: randomUUID(),
        safeChanges: { code: category.code, version: row.version, fieldCount: definition.fields.length },
      },
    });
    return row;
  });
  return { version: created.version, definition };
}
