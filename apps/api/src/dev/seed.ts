import { getEnv, repoRoot } from "../config/env";
import { DEMO_PASSWORD, DEMO_SOURCE_SYSTEM, buildDemoDataset, sha256Hex } from "@mf/contracts";
import { prisma, type Prisma } from "@mf/db/server";
import bcrypt from "bcryptjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createStorage } from "../storage/storage";

const env = getEnv();
const boot = process.argv.includes("--boot");
if (env.APP_ENV === "production") {
  if (boot) {
    console.info("正式環境略過展示帳號。");
    process.exit(0);
  }
  console.error("拒絕執行：正式環境不寫入展示帳號。");
  process.exit(1);
}
if (!env.DEMO_MODE && !boot) {
  console.error("拒絕執行：請先設 DEMO_MODE=true。一般指令不會寫入展示帳號。");
  process.exit(1);
}

const data = buildDemoDataset();
const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
const storage = createStorage(path.resolve(repoRoot(), env.UPLOAD_ROOT));

for (const org of data.organizations) {
  const current = await prisma.organization.findUnique({ where: { taxId: org.taxId } });
  if (current && !current.organizationName.includes("示範")) {
    console.warn(`略過統編 ${org.taxId}，既有資料不是示範業者`);
    continue;
  }
  await prisma.organization.upsert({
    where: { taxId: org.taxId },
    create: { ...org },
    update: {
      organizationName: org.organizationName,
      contactName: org.contactName,
      contactPhone: org.contactPhone,
      contactEmail: org.contactEmail,
      address: org.address,
    },
  });
}

for (const user of data.users) {
  await prisma.user.upsert({
    where: { email: user.email },
    create: { ...user, passwordHash },
    update: { displayName: user.displayName, role: user.role, organizationId: user.organizationId, isActive: user.isActive },
  });
}

for (const category of data.categories) {
  await prisma.applicationCategory.upsert({
    where: { code: category.code },
    create: category,
    update: { name: category.name, description: category.description, isActive: category.isActive, displayOrder: category.displayOrder },
  });
}

for (const version of data.formVersions) {
  const referenced = await prisma.application.count({ where: { categoryFormVersionId: version.id } });
  await prisma.categoryFormVersion.upsert({
    where: { categoryId_version: { categoryId: version.categoryId, version: version.version } },
    create: version,
    update: referenced === 0 ? { definition: version.definition, configurationStatus: version.configurationStatus } : {},
  });
}

for (const application of data.applications) {
  if (!application.sourceSystem || !application.sourceRecordKey) continue;
  const exists = await prisma.application.findUnique({
    where: { sourceSystem_sourceRecordKey: { sourceSystem: application.sourceSystem, sourceRecordKey: application.sourceRecordKey } },
  });
  if (exists) continue;
  await prisma.application.create({ data: application });
}

for (const file of data.files) {
  const exists = await prisma.fileObject.findUnique({ where: { id: file.id } });
  if (exists) continue;
  const bytes = Buffer.from(file.contentBase64, "base64");
  await storage.save(file.storageKey, bytes);
  const { contentBase64: _ignored, ...record } = file;
  await prisma.fileObject.create({ data: { ...record, sha256: await sha256Hex(bytes) } });
}

for (const attachment of data.attachments) {
  await prisma.applicationAttachment.upsert({
    where: { id: attachment.id },
    create: attachment,
    update: {},
  });
}

for (const submission of data.submissions) {
  await prisma.applicationSubmission.upsert({
    where: { applicationId_revision: { applicationId: submission.applicationId, revision: submission.revision } },
    create: { ...submission, payloadSnapshot: submission.payloadSnapshot as Prisma.InputJsonValue },
    update: {},
  });
}

for (const event of data.events) {
  await prisma.applicationEvent.upsert({
    where: { applicationId_requestId: { applicationId: event.applicationId, requestId: event.requestId } },
    create: event,
    update: {},
  });
}

for (const course of data.courses) {
  await prisma.course.upsert({
    where: { id: course.id },
    create: course,
    update: {},
  });
}

for (const enrollment of data.enrollments) {
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: enrollment.courseId, userId: enrollment.userId } },
    create: enrollment,
    update: {},
  });
}

for (const certification of data.certifications) {
  await prisma.certification.upsert({
    where: { applicationId: certification.applicationId },
    create: certification,
    update: {},
  });
}

for (const job of data.notificationJobs) {
  await prisma.notificationJob.upsert({
    where: { dedupeKey: job.dedupeKey },
    create: job,
    update: {},
  });
}

for (const log of data.auditLogs) {
  const existing = await prisma.auditLog.findUnique({ where: { id: log.id } });
  if (!existing) await prisma.auditLog.create({ data: { ...log, safeChanges: log.safeChanges as Prisma.InputJsonValue } });
}

await prisma.$executeRawUnsafe(`SELECT setval('application_no_seq', GREATEST(40, (SELECT last_value FROM application_no_seq)), true)`);
await mkdir(path.resolve(repoRoot(), env.UPLOAD_ROOT), { recursive: true });
console.info(`示範資料已寫入（不會覆寫既有案件）。登入帳號見 README，密碼僅供本地示範。來源=${DEMO_SOURCE_SYSTEM}`);
await prisma.$disconnect();
