export type TrainingPolicyInput = {
  requireBasicBeforeApply: boolean;
  quizPassPercent: number;
  privateRequestMinHeadcount: number;
};

export type BasicQuestion = {
  id: string;
  correctIndex: number;
  options: string[];
};

export type QuizAnswer = { questionId: string; selectedIndex: number };

export const DEFAULT_TRAINING_POLICY: TrainingPolicyInput = {
  requireBasicBeforeApply: true,
  quizPassPercent: 80,
  privateRequestMinHeadcount: 20,
};

export function validateTrainingPolicy(input: TrainingPolicyInput): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (!Number.isInteger(input.quizPassPercent) || input.quizPassPercent < 1 || input.quizPassPercent > 100) {
    issues.push({ path: "quizPassPercent", message: "及格分數須為 1 到 100 的整數" });
  }
  if (!Number.isInteger(input.privateRequestMinHeadcount) || input.privateRequestMinHeadcount < 1) {
    issues.push({ path: "privateRequestMinHeadcount", message: "專班最低人數須為正整數" });
  }
  return issues;
}

export function scoreBasicQuiz(questions: BasicQuestion[], answers: QuizAnswer[]): { scorePercent: number; correct: number; total: number } {
  const total = questions.length;
  if (total === 0) return { scorePercent: 0, correct: 0, total: 0 };
  const byId = new Map(answers.map((item) => [item.questionId, item.selectedIndex]));
  let correct = 0;
  for (const question of questions) {
    if (byId.get(question.id) === question.correctIndex) correct += 1;
  }
  return { scorePercent: Math.round((correct / total) * 100), correct, total };
}

export function quizPassed(scorePercent: number, passPercent: number): boolean {
  return scorePercent >= passPercent;
}

export function canStartVerificationApplication(input: {
  requireBasicBeforeApply: boolean;
  basicPassed: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (!input.requireBasicBeforeApply) return { ok: true };
  if (input.basicPassed) return { ok: true };
  return { ok: false, message: "請先完成基礎教育訓練（內容與測驗）後再申請驗證" };
}

export function requiredModulesComplete(input: {
  requiredModuleIds: string[];
  completedModuleIds: string[];
}): boolean {
  const done = new Set(input.completedModuleIds);
  return input.requiredModuleIds.every((id) => done.has(id));
}

export function validateCompanyTrainingRequest(input: {
  headcount: number;
  minHeadcount: number;
  preferredStartsOn: string;
  preferredEndsOn: string;
  delivery: "ONLINE" | "OFFLINE";
  location: string;
  note: string;
}): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (!Number.isInteger(input.headcount) || input.headcount < 1) {
    issues.push({ path: "headcount", message: "人數須為正整數" });
  } else if (input.headcount < input.minHeadcount) {
    issues.push({ path: "headcount", message: `專班申請至少需要 ${input.minHeadcount} 人` });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.preferredStartsOn)) issues.push({ path: "preferredStartsOn", message: "請填希望開始日" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.preferredEndsOn)) issues.push({ path: "preferredEndsOn", message: "請填希望結束日" });
  if (input.preferredStartsOn && input.preferredEndsOn && input.preferredEndsOn < input.preferredStartsOn) {
    issues.push({ path: "preferredEndsOn", message: "結束日不可早於開始日" });
  }
  if (input.delivery === "OFFLINE" && !input.location.trim()) {
    issues.push({ path: "location", message: "線下專班請填地點" });
  }
  if (input.note.length > 2000) issues.push({ path: "note", message: "說明最多 2000 字" });
  return issues;
}

export function nextBasicCertificateNo(seq: number): string {
  return `BT-${String(seq).padStart(6, "0")}`;
}
