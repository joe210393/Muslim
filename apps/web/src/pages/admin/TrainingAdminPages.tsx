import { companyTrainingRequestStatusLabels, courseDeliveryLabels } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useServices } from "../../app/session";
import { CourseListPage } from "./AdminPages";
import { Button, Card, Empty, ErrorText, Field, PageHeader, SelectInput, TextArea, TextInput } from "../../components/ui";
import { ClientError } from "../../services/types";

const legacyTabRedirects: Record<string, string> = {
  basic: "/admin/training/basic",
  bank: "/admin/training/question-bank",
  policy: "/admin/training/policy",
  company: "/admin/training/company-requests",
  certificates: "/admin/training/certificates",
};

export function CourseTrainingPage() {
  const [params] = useSearchParams();
  const tab = params.get("tab");
  if (tab && legacyTabRedirects[tab]) return <Navigate to={legacyTabRedirects[tab]} replace />;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="教育訓練管理" title="課程梯次" lede="管理公開線上／線下課程梯次與報名。" />
      <CourseListPage />
    </div>
  );
}

export function BasicCoursesAdminPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="教育訓練管理" title="基礎課" lede="可新增多門基礎課，設定標題、說明、影片網址與教材。" />
      <BasicCoursesPanel />
    </div>
  );
}

export function QuestionBankAdminPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="教育訓練管理" title="題庫" lede="下載範本後編輯，再上傳更新；測驗會依門檻設定從題庫抽題。" />
      <QuestionBankPanel />
    </div>
  );
}

export function TrainingPolicyAdminPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="教育訓練管理" title="門檻設定" lede="設定是否擋驗證申請、抽題數、及格題數與專班最低人數。" />
      <PolicyPanel />
    </div>
  );
}

export function CompanyTrainingAdminPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="教育訓練管理" title="專班申請" lede="審核業者單獨開班申請。" />
      <CompanyPanel />
    </div>
  );
}

export function TrainingCertificatesAdminPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="教育訓練管理" title="一般課證書" lede="對已完課報名人工登錄訓練證書編號。" />
      <CertificatesPanel />
    </div>
  );
}

function PolicyPanel() {
  const services = useServices();
  const client = useQueryClient();
  const policy = useQuery({ queryKey: ["training-policy"], queryFn: () => services.trainingPolicy() });
  const bank = useQuery({ queryKey: ["admin-question-bank"], queryFn: () => services.adminQuestionBank() });
  const [form, setForm] = useState<{ requireBasicBeforeApply: boolean; quizDrawCount: number; quizPassCount: number; privateRequestMinHeadcount: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = form ?? (policy.data ? {
    requireBasicBeforeApply: policy.data.requireBasicBeforeApply,
    quizDrawCount: policy.data.quizDrawCount,
    quizPassCount: policy.data.quizPassCount,
    privateRequestMinHeadcount: policy.data.privateRequestMinHeadcount,
  } : null);
  if (policy.isLoading || !policy.data || !current) return <p>載入中…</p>;
  return (
    <Card className="space-y-3">
      <p className="text-sm text-[var(--muted)]">目前題庫 {bank.data?.length ?? "…"} 題。測驗會從題庫隨機抽出設定題數，答對達及格題數即通過。</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={current.requireBasicBeforeApply} onChange={(event) => setForm({ ...current, requireBasicBeforeApply: event.target.checked })} />未完成基礎課不可建立／送出驗證申請</label>
      <Field label="隨機抽題數"><TextInput type="number" value={current.quizDrawCount} onChange={(event) => setForm({ ...current, quizDrawCount: Number(event.target.value) })} /></Field>
      <Field label="及格需答對題數"><TextInput type="number" value={current.quizPassCount} onChange={(event) => setForm({ ...current, quizPassCount: Number(event.target.value) })} /></Field>
      <Field label="專班最低人數"><TextInput type="number" value={current.privateRequestMinHeadcount} onChange={(event) => setForm({ ...current, privateRequestMinHeadcount: Number(event.target.value) })} /></Field>
      <Button onClick={async () => {
        try {
          await services.saveTrainingPolicy({ ...current, expectedVersion: policy.data.version });
          setError(null);
          setMessage("已儲存門檻");
          setForm(null);
          await client.invalidateQueries({ queryKey: ["training-policy"] });
        } catch (reason) {
          setError(reason instanceof ClientError ? reason.message : "儲存失敗");
        }
      }}>儲存</Button>
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <ErrorText message={error} /> : null}
    </Card>
  );
}

function BasicCoursesPanel() {
  const services = useServices();
  const client = useQueryClient();
  const modules = useQuery({ queryKey: ["admin-basic-modules"], queryFn: () => services.adminBasicModules() });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [pendingMaterial, setPendingMaterial] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const materialRef = useRef<HTMLInputElement | null>(null);
  function startNew() {
    setEditing("new");
    setTitle("");
    setDescription("");
    setYoutubeUrl("");
    setIsRequired(true);
    setIsActive(true);
    setPendingMaterial(null);
  }
  function startEdit(id: string) {
    const module = modules.data?.find((item) => item.id === id);
    if (!module) return;
    setEditing(id);
    setTitle(module.title);
    setDescription(module.description);
    setYoutubeUrl(module.youtubeUrl);
    setIsRequired(module.isRequired);
    setIsActive(module.isActive);
    setPendingMaterial(null);
  }
  return (
    <div className="space-y-4">
      <Button onClick={startNew}>新增基礎課</Button>
      {(modules.data ?? []).map((module) => (
        <Card key={module.id} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{module.title} · {module.isActive ? "啟用" : "停用"} · {module.isRequired ? "必做" : "選做"}</p>
            <Button variant="secondary" onClick={() => startEdit(module.id)}>編輯</Button>
          </div>
          <p className="line-clamp-2 text-sm text-[var(--muted)]">{module.description || "（尚無說明）"}</p>
          <p className="text-sm text-[var(--muted)]">{module.youtubeUrl ? `網址：${module.youtubeUrl}` : "尚未設定網址"}{module.hasMaterial ? ` · 教材：${module.materialName ?? "已上傳"}` : " · 尚無教材"}</p>
        </Card>
      ))}
      {editing ? (
        <Card className="space-y-3">
          <h2 className="font-medium">{editing === "new" ? "新增基礎課" : "編輯基礎課"}</h2>
          <Field label="標題"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：基礎課1" /></Field>
          <Field label="說明"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Field label="影片／教材網址" hint="可貼 YouTube 連結；留白表示不放影片。"><TextInput value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=" /></Field>
          <Field label="上傳教材檔">
            <input ref={materialRef} type="file" onChange={(event) => setPendingMaterial(event.target.files?.[0] ?? null)} />
            {editing !== "new" && modules.data?.find((item) => item.id === editing)?.hasMaterial ? (
              <p className="mt-1 text-sm text-[var(--muted)]">目前：{modules.data.find((item) => item.id === editing)?.materialName}</p>
            ) : null}
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isRequired} onChange={(event) => setIsRequired(event.target.checked)} />必做</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />啟用</label>
          <div className="flex gap-2">
            <Button onClick={async () => {
              try {
                const current = editing === "new" ? undefined : modules.data?.find((item) => item.id === editing);
                const saved = await services.saveBasicModule({
                  title,
                  description,
                  youtubeUrl,
                  sortOrder: current?.sortOrder ?? ((modules.data?.length ?? 0) + 1),
                  isRequired,
                  isActive,
                  expectedVersion: current?.version,
                }, editing === "new" ? undefined : editing);
                if (pendingMaterial) await services.uploadBasicModuleMaterial(saved.id, pendingMaterial);
                setEditing(null);
                setPendingMaterial(null);
                setError(null);
                await client.invalidateQueries({ queryKey: ["admin-basic-modules"] });
              } catch (reason) {
                setError(reason instanceof ClientError ? reason.message : "儲存失敗");
              }
            }}>儲存基礎課</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>取消</Button>
          </div>
          {error ? <ErrorText message={error} /> : null}
        </Card>
      ) : null}
    </div>
  );
}

const QUESTION_BANK_CSV_TEMPLATE = [
  "題目,選項,正解索引",
  "穆斯林友善服務中，酒精類飲料應如何處理？,可與 Halal 餐點並陳|應避免提供或以明確方式與 Halal 區隔|只可在大廳販售|沒有限制,1",
  "肉品若要符合 Halal，通常需要什麼？,只要新鮮即可|Halal 證書與可追溯採購證明|進口即可|廚師口頭保證即可,1",
  "現場複審主要核對什麼？,只看合約金額|業者送件附件，必要時可加拍現場存證|只看社群貼文|只看統編,1",
].join("\n");

const QUESTION_BANK_JSON_TEMPLATE = `${JSON.stringify([
  {
    prompt: "穆斯林友善服務中，酒精類飲料應如何處理？",
    options: ["可與 Halal 餐點並陳", "應避免提供或以明確方式與 Halal 區隔", "只可在大廳販售", "沒有限制"],
    correctIndex: 1,
  },
  {
    prompt: "肉品若要符合 Halal，通常需要什麼？",
    options: ["只要新鮮即可", "Halal 證書與可追溯採購證明", "進口即可", "廚師口頭保證即可"],
    correctIndex: 1,
  },
], null, 2)}\n`;

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function QuestionBankPanel() {
  const services = useServices();
  const client = useQueryClient();
  const bank = useQuery({ queryKey: ["admin-question-bank"], queryFn: () => services.adminQuestionBank() });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-sm text-[var(--muted)]">建議先下載範本，依格式填寫後再上傳。上傳會整批更新題庫（覆蓋現有題目）。</p>
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-sm leading-6">
          <p className="font-medium">CSV 欄位說明</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--muted)]">
            <li>題目：題幹文字</li>
            <li>選項：用 <code>|</code> 分隔，至少兩個</li>
            <li>正解索引：從 0 起算（第一個選項是 0）</li>
          </ul>
          <p className="mt-2 font-medium">JSON 說明</p>
          <p className="text-[var(--muted)]">陣列，每題含 <code>prompt</code>、<code>options</code>、<code>correctIndex</code>。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadTextFile("題庫範本.csv", `\uFEFF${QUESTION_BANK_CSV_TEMPLATE}\n`, "text/csv;charset=utf-8")}>下載 CSV 範本</Button>
          <Button variant="secondary" onClick={() => downloadTextFile("題庫範本.json", QUESTION_BANK_JSON_TEMPLATE, "application/json")}>下載 JSON 範本</Button>
          <Button onClick={() => fileRef.current?.click()}>選擇題庫檔並上傳更新</Button>
        </div>
        <input ref={fileRef} className="hidden" type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const rows = await services.uploadQuestionBank(file);
            setError(null);
            setMessage(`已更新題庫，共 ${rows.length} 題`);
            await client.invalidateQueries({ queryKey: ["admin-question-bank"] });
            await client.invalidateQueries({ queryKey: ["training-policy"] });
          } catch (reason) {
            setError(reason instanceof ClientError ? reason.message : "上傳失敗");
          } finally {
            event.target.value = "";
          }
        }} />
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        {error ? <ErrorText message={error} /> : null}
      </Card>
      <Card className="space-y-2">
        <p className="font-medium">目前題庫（{(bank.data ?? []).length} 題）</p>
        {(bank.data ?? []).length === 0 ? <Empty title="尚無題目" body="請先下載範本，填寫後上傳。" /> : null}
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          {(bank.data ?? []).map((question) => (
            <li key={question.id}>
              <p>{question.prompt}</p>
              <p className="text-[var(--muted)]">{question.options.map((option, index) => `${index === question.correctIndex ? "✓ " : ""}${option}`).join(" ／ ")}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function CompanyPanel() {
  const services = useServices();
  const client = useQueryClient();
  const rows = useQuery({ queryKey: ["admin-company-training"], queryFn: () => services.adminCompanyTrainingRequests() });
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {rows.isLoading ? <p>載入中…</p> : null}
      {(rows.data ?? []).length === 0 ? <Empty title="沒有專班申請" body="業者送出後會出現在這裡。" /> : null}
      {(rows.data ?? []).map((item) => (
        <Card key={item.id} className="space-y-2 text-sm">
          <p className="font-medium">{item.organizationName} · {companyTrainingRequestStatusLabels[item.status].label}</p>
          <p>{item.headcount} 人 · {item.preferredStartsOn} 至 {item.preferredEndsOn} · {courseDeliveryLabels[item.delivery].label}{item.location ? ` · ${item.location}` : ""}</p>
          <p>申請人：{item.requestedByName}</p>
          {item.note ? <p>說明：{item.note}</p> : null}
          {item.status === "SUBMITTED" ? (
            <>
              <Field label="管理員意見"><TextArea value={note[item.id] ?? ""} onChange={(event) => setNote((current) => ({ ...current, [item.id]: event.target.value }))} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={async () => {
                  try {
                    await services.reviewCompanyTrainingRequest(item.id, { action: "APPROVE", adminNote: note[item.id] ?? "", expectedVersion: item.version });
                    setError(null);
                    await client.invalidateQueries({ queryKey: ["admin-company-training"] });
                  } catch (reason) {
                    setError(reason instanceof ClientError ? reason.message : "核准失敗");
                  }
                }}>核准</Button>
                <Button variant="danger" onClick={async () => {
                  try {
                    await services.reviewCompanyTrainingRequest(item.id, { action: "REJECT", adminNote: note[item.id] ?? "", expectedVersion: item.version });
                    setError(null);
                    await client.invalidateQueries({ queryKey: ["admin-company-training"] });
                  } catch (reason) {
                    setError(reason instanceof ClientError ? reason.message : "退回失敗");
                  }
                }}>退回</Button>
              </div>
            </>
          ) : item.adminNote ? <p>意見：{item.adminNote}</p> : null}
        </Card>
      ))}
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

function CertificatesPanel() {
  const services = useServices();
  const courses = useQuery({ queryKey: ["admin-courses"], queryFn: () => services.courses("manage") });
  const [courseId, setCourseId] = useState("");
  const enrollments = useQuery({ queryKey: ["admin-course-enrollments", courseId], queryFn: () => services.courseEnrollments(courseId), enabled: Boolean(courseId) });
  const [form, setForm] = useState({ enrollmentId: "", certificateNo: "", issuedOnDate: "", validUntilDate: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completed = (enrollments.data ?? []).filter((item) => item.completion === "COMPLETED");
  return (
    <Card className="space-y-3">
      <p className="text-sm text-[var(--muted)]">只對已完課的報名登錄一般課訓練證書（人工編號）。</p>
      <Field label="課程">
        <SelectInput value={courseId} onChange={(event) => { setCourseId(event.target.value); setForm((current) => ({ ...current, enrollmentId: "" })); }}>
          <option value="">選擇課程</option>
          {(courses.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </SelectInput>
      </Field>
      <Field label="完課學員">
        <SelectInput value={form.enrollmentId} onChange={(event) => setForm({ ...form, enrollmentId: event.target.value })}>
          <option value="">選擇</option>
          {completed.map((item) => <option key={item.id} value={item.id}>{item.userName}{item.trainingCertificateNo ? `（已有 ${item.trainingCertificateNo}）` : ""}</option>)}
        </SelectInput>
      </Field>
      <Field label="證書編號"><TextInput value={form.certificateNo} onChange={(event) => setForm({ ...form, certificateNo: event.target.value })} /></Field>
      <Field label="核發日"><TextInput type="date" value={form.issuedOnDate} onChange={(event) => setForm({ ...form, issuedOnDate: event.target.value })} /></Field>
      <Field label="到期日"><TextInput type="date" value={form.validUntilDate} onChange={(event) => setForm({ ...form, validUntilDate: event.target.value })} /></Field>
      <Button onClick={async () => {
        try {
          await services.registerTrainingCertificate(form);
          setError(null);
          setMessage("已登錄訓練證書");
          await enrollments.refetch();
        } catch (reason) {
          setError(reason instanceof ClientError ? reason.message : "登錄失敗");
        }
      }}>登錄證書</Button>
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <ErrorText message={error} /> : null}
    </Card>
  );
}
