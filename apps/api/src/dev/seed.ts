import { getEnv, repoRoot } from "../config/env";
import { CONTRACT_TEMPLATE_CODE, DEMO_PASSWORD, DEMO_SOURCE_SYSTEM, buildDemoDataset, formatContractNo, renderContractBody, sha256Hex, taipeiDateLabel, taipeiYear } from "@mf/contracts";
import { ContractStatus } from "@mf/db/enums";
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

const seededCases = await prisma.application.findMany({
  where: { sourceSystem: DEMO_SOURCE_SYSTEM },
  select: { id: true },
});
const seededIds = seededCases.map((item) => item.id);
if (seededIds.length > 0) {
  const attachments = await prisma.applicationAttachment.findMany({
    where: { applicationId: { in: seededIds } },
    select: { fileId: true },
  });
  const fileIds = attachments.map((item) => item.fileId);
  await prisma.$transaction([
    prisma.applicationEvent.deleteMany({ where: { applicationId: { in: seededIds } } }),
    prisma.certification.deleteMany({ where: { applicationId: { in: seededIds } } }),
    prisma.notificationJob.deleteMany({ where: { applicationId: { in: seededIds } } }),
    prisma.applicationAttachment.deleteMany({ where: { applicationId: { in: seededIds } } }),
    prisma.applicationSubmission.deleteMany({ where: { applicationId: { in: seededIds } } }),
    prisma.auditLog.deleteMany({ where: { entityType: "Application", entityId: { in: seededIds } } }),
    prisma.application.deleteMany({ where: { id: { in: seededIds } } }),
  ]);
  if (fileIds.length > 0) {
    const files = await prisma.fileObject.findMany({ where: { id: { in: fileIds } }, select: { id: true, storageKey: true } });
    await prisma.fileObject.deleteMany({ where: { id: { in: fileIds } } });
    for (const file of files) await storage.delete(file.storageKey).catch(() => undefined);
  }
  console.info(`已清除 ${seededIds.length} 筆示範案件。之後新建的案件會保留。`);
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

const remaining = await prisma.application.findMany({ select: { applicationNo: true } });
const maxApplicationNo = remaining.reduce((max, item) => {
  const sequence = Number(item.applicationNo.split("-").at(-1));
  return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
}, 0);
if (maxApplicationNo === 0) {
  await prisma.$executeRawUnsafe(`SELECT setval('application_no_seq', 1, false)`);
} else {
  await prisma.$executeRawUnsafe(`SELECT setval('application_no_seq', ${maxApplicationNo}, true)`);
}

const { ensureContent } = await import("../modules/platform/content");
await ensureContent();
const demoOrg = data.organizations[0];
const template = await prisma.contractTemplate.findFirst({ where: { code: CONTRACT_TEMPLATE_CODE }, orderBy: { revision: "asc" } });
const adminUser = await prisma.user.findUnique({ where: { email: "admin@example.test" } });
if (demoOrg && template && adminUser) {
  const organization = await prisma.organization.findUnique({ where: { taxId: demoOrg.taxId } });
  const existing = organization
    ? await prisma.contractRecord.findFirst({ where: { organizationId: organization.id, status: { in: [ContractStatus.ISSUED, ContractStatus.SIGNED] } } })
    : null;
  if (organization && organization.id === demoOrg.id && !existing) {
    const year = taipeiYear();
    let sequence = 1;
    let contractNo = formatContractNo(year, sequence);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const taken = await prisma.contractRecord.findUnique({ where: { contractNo } });
      if (!taken) break;
      const rows = await prisma.$queryRawUnsafe<Array<{ nextval: number }>>(`SELECT nextval('contract_no_seq')::int AS nextval`);
      sequence = Math.max(sequence + 1, rows[0]?.nextval ?? sequence + 1);
      contractNo = formatContractNo(year, sequence);
    }
    try {
      await prisma.contractRecord.create({
        data: {
          contractNo,
          organizationId: organization.id,
          templateId: template.id,
          title: template.title,
          bodySnapshot: renderContractBody(template.body, {
            organizationName: organization.organizationName,
            taxId: organization.taxId ?? "",
            contractNo,
            issuedOn: taipeiDateLabel(),
          }),
          status: ContractStatus.ISSUED,
          issuedById: adminUser.id,
        },
      });
      await prisma.$executeRawUnsafe(`SELECT setval('contract_no_seq', GREATEST(${sequence}, (SELECT last_value FROM contract_no_seq)), true)`);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code !== "P2002") throw error;
      console.info(`合約編號 ${contractNo} 已存在，略過示範合約。`);
    }
  }
}
await mkdir(path.resolve(repoRoot(), env.UPLOAD_ROOT), { recursive: true });
console.info(`示範帳號已寫入。案件審查的測試案件不會再建立。登入帳號見 README，密碼僅供本地示範。來源=${DEMO_SOURCE_SYSTEM}`);
await prisma.$disconnect();
