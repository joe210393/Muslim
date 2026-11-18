export type TrainingPolicyInput = {
  requireBasicBeforeApply: boolean;
  quizDrawCount: number;
  quizPassCount: number;
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
  quizDrawCount: 5,
  quizPassCount: 4,
  privateRequestMinHeadcount: 20,
};

export function validateTrainingPolicy(input: TrainingPolicyInput): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (!Number.isInteger(input.quizDrawCount) || input.quizDrawCount < 1 || input.quizDrawCount > 100) {
    issues.push({ path: "quizDrawCount", message: "抽題數須為 1 到 100 的整數" });
  }
  if (!Number.isInteger(input.quizPassCount) || input.quizPassCount < 1 || input.quizPassCount > 100) {
    issues.push({ path: "quizPassCount", message: "及格題數須為 1 到 100 的整數" });
  } else if (Number.isInteger(input.quizDrawCount) && input.quizPassCount > input.quizDrawCount) {
    issues.push({ path: "quizPassCount", message: "及格題數不可大於抽題數" });
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

export function quizPassedByCount(correct: number, passCount: number): boolean {
  return correct >= passCount;
}

/** @deprecated 舊百分比規則，測試相容用 */
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

export function drawRandomQuestions<T>(items: T[], count: number, random: () => number = Math.random): T[] {
  if (count <= 0 || items.length === 0) return [];
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = pool[index]!;
    pool[index] = pool[swap]!;
    pool[swap] = current;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export type QuestionBankRow = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export function parseQuestionBankUpload(raw: string): { rows: QuestionBankRow[]; error?: string } {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { rows: [], error: "檔案是空的" };
  try {
    if (text.startsWith("[") || text.startsWith("{")) {
      const parsed = JSON.parse(text) as unknown;
      const list = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown }).questions;
      if (!Array.isArray(list) || list.length === 0) return { rows: [], error: "JSON 須為題目陣列" };
      const rows: QuestionBankRow[] = [];
      for (const [index, item] of list.entries()) {
        const row = item as Partial<QuestionBankRow>;
        if (!row.prompt?.trim() || !Array.isArray(row.options) || row.options.length < 2) {
          return { rows: [], error: `第 ${index + 1} 題格式不完整` };
        }
        if (!Number.isInteger(row.correctIndex) || (row.correctIndex as number) < 0 || (row.correctIndex as number) >= row.options.length) {
          return { rows: [], error: `第 ${index + 1} 題正解索引無效` };
        }
        rows.push({
          prompt: String(row.prompt).trim(),
          options: row.options.map((option) => String(option).trim()).filter(Boolean),
          correctIndex: row.correctIndex as number,
        });
      }
      return { rows };
    }
  } catch {
    return { rows: [], error: "JSON 無法解析" };
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: QuestionBankRow[] = [];
  for (const [index, line] of lines.entries()) {
    if (index === 0 && /prompt|題目/i.test(line)) continue;
    const parts = line.includes("\t") ? line.split("\t") : line.split(",");
    if (parts.length < 3) return { rows: [], error: `第 ${index + 1} 行欄位不足（題目,選項以|分隔,正解索引）` };
    const prompt = parts[0]!.trim();
    const options = parts[1]!.split("|").map((item) => item.trim()).filter(Boolean);
    const correctIndex = Number(parts[2]!.trim());
    if (!prompt || options.length < 2) return { rows: [], error: `第 ${index + 1} 行題目或選項不足` };
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return { rows: [], error: `第 ${index + 1} 行正解索引無效` };
    }
    rows.push({ prompt, options, correctIndex });
  }
  if (rows.length === 0) return { rows: [], error: "沒有讀到任何題目" };
  return { rows };
}
