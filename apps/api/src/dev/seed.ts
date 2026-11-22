import { getEnv, repoRoot } from "../config/env";
import { CONTRACT_TEMPLATE_CODE, DEMO_PASSWORD, DEMO_SOURCE_SYSTEM, OFFICIAL_SERVICE_PLANS_2026, buildDefaultCertificateTemplates, buildDemoDataset, formatContractNo, renderContractBody, sha256Hex, taipeiDateLabel, taipeiYear } from "@mf/contracts";
import { ContractStatus } from "@mf/db/enums";
import { prisma, type Prisma } from "@mf/db/server";
import bcrypt from "bcryptjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createStorage } from "../storage/storage";

const env = getEnv();
const boot = process.argv.includes("--boot");
const storage = createStorage(path.resolve(repoRoot(), env.UPLOAD_ROOT));
const FULL_APPLICATION_PURGE_MARKER = "APPLICATIONS_FULL_PURGE_20261120";

async function purgeApplicationIds(ids: string[], label: string) {
  if (ids.length === 0) {
    console.info(`${label}：沒有案件可清。`);
    return;
  }
  const attachments = await prisma.applicationAttachment.findMany({
    where: { applicationId: { in: ids } },
    select: { fileId: true },
  });
  const fileIds = [...new Set(attachments.map((item) => item.fileId))];
  await prisma.$transaction([
    prisma.applicationEvent.deleteMany({ where: { applicationId: { in: ids } } }),
    prisma.certification.deleteMany({ where: { applicationId: { in: ids } } }),
    prisma.notificationJob.deleteMany({ where: { applicationId: { in: ids } } }),
    prisma.applicationAttachment.deleteMany({ where: { applicationId: { in: ids } } }),
    prisma.applicationSubmission.deleteMany({ where: { applicationId: { in: ids } } }),
    prisma.auditLog.deleteMany({ where: { entityType: "Application", entityId: { in: ids } } }),
    prisma.application.deleteMany({ where: { id: { in: ids } } }),
  ]);
  if (fileIds.length > 0) {
    const files = await prisma.fileObject.findMany({ where: { id: { in: fileIds } }, select: { id: true, storageKey: true } });
    await prisma.fileObject.deleteMany({ where: { id: { in: fileIds } } });
    for (const file of files) await storage.delete(file.storageKey).catch(() => undefined);
  }
  console.info(`${label}：已清除 ${ids.length} 筆。`);
}

async function maybePurgeAllApplications() {
  const forcePurgeAll = process.env.PURGE_ALL_APPLICATIONS === "true";
  const alreadyPurged = await prisma.auditLog.findFirst({ where: { action: FULL_APPLICATION_PURGE_MARKER } });
  if (!forcePurgeAll && !(boot && !alreadyPurged)) return false;
  const allCases = await prisma.application.findMany({ select: { id: true } });
  await purgeApplicationIds(allCases.map((item) => item.id), "全部申請案件（草稿／審核中／通過／退件）");
  await prisma.$executeRawUnsafe(`SELECT setval('application_no_seq', 1, false)`);
  if (!alreadyPurged) {
    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: FULL_APPLICATION_PURGE_MARKER,
        entityType: "System",
        entityId: null,
        requestId: FULL_APPLICATION_PURGE_MARKER,
        safeChanges: {
          purgedCount: allCases.length,
          note: "一次性清空全部申請案件；之後新建的案件會保留，除非再設 PURGE_ALL_APPLICATIONS=true",
        },
      },
    });
  }
  return true;
}

const purgedAll = await maybePurgeAllApplications();

const BASIC_PROGRESS_PURGE_MARKER = "BASIC_TRAINING_PROGRESS_PURGE_20261120";
async function maybePurgeBasicTrainingProgress() {
  const force = process.env.PURGE_BASIC_TRAINING_PROGRESS === "true";
  const already = await prisma.auditLog.findFirst({ where: { action: BASIC_PROGRESS_PURGE_MARKER } });
  if (!force && !(boot && !already)) return false;
  const [progressCount, attemptCount, passCount] = await prisma.$transaction([
    prisma.basicTrainingProgress.deleteMany({}),
    prisma.basicTrainingAttempt.deleteMany({}),
    prisma.userBasicTraining.deleteMany({}),
  ]);
  console.info(
    `已清除業者基礎教育訓練進度：觀看 ${progressCount.count}、測驗 ${attemptCount.count}、通過紀錄 ${passCount.count}。`,
  );
  if (!already) {
    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: BASIC_PROGRESS_PURGE_MARKER,
        entityType: "System",
        entityId: null,
        requestId: BASIC_PROGRESS_PURGE_MARKER,
        safeChanges: {
          progress: progressCount.count,
          attempts: attemptCount.count,
          passed: passCount.count,
          note: "一次性清空業者基礎課觀看／測驗／通過狀態；課程與題庫保留",
        },
      },
    });
  }
  return true;
}

const purgedBasicProgress = await maybePurgeBasicTrainingProgress();

const ACCOUNT_DATA_PURGE_EMAIL = "joe210393@gmail.com";
const ACCOUNT_DATA_PURGE_MARKER = "ACCOUNT_DATA_PURGE_JOE210393_20261122";

async function maybePurgeAccountPlansContractsApplications() {
  if (!boot) return null;
  const already = await prisma.auditLog.findFirst({ where: { action: ACCOUNT_DATA_PURGE_MARKER } });
  if (already) return null;
  const user = await prisma.user.findFirst({
    where: { email: { equals: ACCOUNT_DATA_PURGE_EMAIL, mode: "insensitive" } },
  });
  if (!user) {
    console.info(`找不到 ${ACCOUNT_DATA_PURGE_EMAIL}，這次不清除方案、合約、申請。`);
    return null;
  }
  const orgId = user.organizationId;
  const applications = await prisma.application.findMany({
    where: orgId
      ? { OR: [{ organizationId: orgId }, { createdById: user.id }] }
      : { createdById: user.id },
    select: { id: true },
  });
  const applicationIds = applications.map((item) => item.id);
  const contractWhere = [
    ...(orgId ? [{ organizationId: orgId }] : []),
    ...(applicationIds.length > 0 ? [{ applicationId: { in: applicationIds } }] : []),
  ];
  const contracts = contractWhere.length === 0
    ? []
    : await prisma.contractRecord.findMany({
      where: { OR: contractWhere },
      select: { id: true, faceFileId: true, signatureFileId: true, pdfFileId: true },
    });
  const contractIds = contracts.map((item) => item.id);
  const contractFileIds = [...new Set(contracts.flatMap((item) => [item.faceFileId, item.signatureFileId, item.pdfFileId].filter((id): id is string => Boolean(id))))];
  if (contractIds.length > 0) {
    await prisma.contractRecord.deleteMany({ where: { id: { in: contractIds } } });
    if (contractFileIds.length > 0) {
      const files = await prisma.fileObject.findMany({ where: { id: { in: contractFileIds } }, select: { id: true, storageKey: true } }).catch(() => []);
      await prisma.fileObject.deleteMany({ where: { id: { in: contractFileIds } } }).catch(() => undefined);
      for (const file of files) await storage.delete(file.storageKey).catch(() => undefined);
    }
  }
  const payments = orgId
    ? await prisma.paymentRecord.deleteMany({ where: { organizationId: orgId } })
    : { count: 0 };
  const viewers = await prisma.servicePlanViewer.deleteMany({ where: { userId: user.id } });
  await purgeApplicationIds(applicationIds, `${ACCOUNT_DATA_PURGE_EMAIL} 的申請`);
  await prisma.auditLog.create({
    data: {
      actorId: null,
      action: ACCOUNT_DATA_PURGE_MARKER,
      entityType: "User",
      entityId: user.id,
      requestId: ACCOUNT_DATA_PURGE_MARKER,
      safeChanges: {
        email: ACCOUNT_DATA_PURGE_EMAIL,
        payments: payments.count,
        planViewers: viewers.count,
        contracts: contractIds.length,
        applications: applicationIds.length,
        note: "一次性清除此帳號的方案付款、合約與申請。帳號保留。共用方案目錄不刪。",
      },
    },
  });
  console.info(
    `${ACCOUNT_DATA_PURGE_EMAIL}：已刪方案付款 ${payments.count}、方案可見名單 ${viewers.count}、合約 ${contractIds.length}、申請 ${applicationIds.length}。帳號保留。`,
  );
  return { payments: payments.count, contracts: contractIds.length, applications: applicationIds.length };
}

const purgedAccount = await maybePurgeAccountPlansContractsApplications();

async function seedCertificateTemplates() {
  const defaults = buildDefaultCertificateTemplates();
  let created = 0;
  let repaired = 0;
  for (const item of defaults) {
    const row = await prisma.certificateTemplate.findUnique({ where: { key: item.key } });
    if (!row) {
      await prisma.certificateTemplate.create({
        data: {
          key: item.key,
          titleZh: item.titleZh,
          titleEn: item.titleEn,
          categoryCode: item.categoryCode,
          matchNote: item.matchNote,
          body: item.body,
          version: 1,
        },
      });
      created += 1;
      continue;
    }
    if (row.body.trim().length < 200 || !row.body.includes("data-certificate-logo")) {
      await prisma.certificateTemplate.update({
        where: { key: row.key },
        data: { body: item.body, titleZh: item.titleZh, titleEn: item.titleEn, matchNote: item.matchNote },
      });
      repaired += 1;
    }
  }
  console.info(`證書範本：新建 ${created}、補回官方內文 ${repaired}、共 ${defaults.length} 份。`);
}

if (boot) await seedCertificateTemplates();

if (env.APP_ENV === "production") {
  if (boot) {
    const notes = [
      purgedAll ? "案件已清空" : null,
      purgedBasicProgress ? "基礎課進度已清空" : null,
      purgedAccount ? `已刪 ${ACCOUNT_DATA_PURGE_EMAIL} 的方案、合約、申請` : null,
      "略過展示帳號",
    ].filter(Boolean);
    console.info(`正式環境：${notes.join("；")}。`);
    await prisma.$disconnect();
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

{
  const existingPlans = await prisma.servicePlan.findMany({ select: { name: true } });
  const names = new Set(existingPlans.map((item) => item.name));
  let created = 0;
  for (const plan of OFFICIAL_SERVICE_PLANS_2026) {
    if (names.has(plan.name)) continue;
    await prisma.servicePlan.create({
      data: {
        name: plan.name,
        amount: plan.amount,
        description: plan.description,
        paymentUrl: "",
        isActive: true,
      },
    });
    created += 1;
  }
  if (created > 0) console.info(`已補上 ${created} 筆 2026 官方方案目錄。`);
}

for (const version of data.formVersions) {
  const referenced = await prisma.application.count({ where: { categoryFormVersionId: version.id } });
  await prisma.categoryFormVersion.upsert({
    where: { categoryId_version: { categoryId: version.categoryId, version: version.version } },
    create: version,
    update: referenced === 0 ? { definition: version.definition, configurationStatus: version.configurationStatus } : {},
  });
}

if (!purgedAll) {
  const seededCases = await prisma.application.findMany({
    where: { sourceSystem: DEMO_SOURCE_SYSTEM },
    select: { id: true },
  });
  await purgeApplicationIds(seededCases.map((item) => item.id), "示範案件");
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

if (data.trainingPolicy) {
  const existingPolicy = await prisma.trainingPolicy.findFirst({ orderBy: { createdAt: "asc" } });
  if (!existingPolicy) {
    await prisma.trainingPolicy.create({
      data: {
        id: data.trainingPolicy.id,
        requireBasicBeforeApply: data.trainingPolicy.requireBasicBeforeApply,
        quizDrawCount: data.trainingPolicy.quizDrawCount,
        quizPassCount: data.trainingPolicy.quizPassCount,
        privateRequestMinHeadcount: data.trainingPolicy.privateRequestMinHeadcount,
        updatedById: data.trainingPolicy.updatedById,
        version: data.trainingPolicy.version,
      },
    });
  }
}

for (const module of data.basicModules) {
  await prisma.basicTrainingModule.upsert({
    where: { id: module.id },
    create: {
      id: module.id,
      title: module.title,
      description: module.description,
      youtubeUrl: module.youtubeUrl,
      requiredWatchPercent: module.requiredWatchPercent,
      sortOrder: module.sortOrder,
      isRequired: module.isRequired,
      isActive: module.isActive,
      materialFileId: module.materialFileId,
      updatedById: module.updatedById,
      version: module.version,
    },
    update: {
      title: module.title,
      description: module.description,
      youtubeUrl: module.youtubeUrl,
      requiredWatchPercent: module.requiredWatchPercent,
      sortOrder: module.sortOrder,
      isRequired: module.isRequired,
      isActive: module.isActive,
    },
  });
}

for (const question of data.basicQuestions) {
  await prisma.basicTrainingQuestion.upsert({
    where: { id: question.id },
    create: {
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correctIndex,
      sortOrder: question.sortOrder,
      isActive: question.isActive,
    },
    update: {
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correctIndex,
      sortOrder: question.sortOrder,
      isActive: question.isActive,
    },
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
