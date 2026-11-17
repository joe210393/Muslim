import { companyTrainingRequestStatusLabels, courseDeliveryLabels } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useServices } from "../../app/session";
import { CourseListPage } from "./AdminPages";
import { Button, Card, Empty, ErrorText, Field, PageHeader, SectionNav, SelectInput, TextArea, TextInput } from "../../components/ui";
import { ClientError } from "../../services/types";

const sections = [
  { id: "courses", label: "課程梯次" },
  { id: "basic", label: "基礎課與題庫" },
  { id: "policy", label: "門檻設定" },
  { id: "company", label: "專班申請" },
  { id: "certificates", label: "一般課證書" },
] as const;

export function TrainingAdminHub() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = sections.some((item) => item.id === requested) ? requested as (typeof sections)[number]["id"] : "courses";
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="教育訓練管理" title="教育訓練" lede="課程梯次、基礎課、門檻、專班與一般課證書。" />
      <SectionNav items={sections.map((item) => ({ id: item.id, label: item.label }))} value={tab} onChange={(id) => setParams(id === "courses" ? {} : { tab: id })} />
      {tab === "courses" ? <CourseListPage /> : null}
      {tab === "basic" ? <BasicModulesTab /> : null}
      {tab === "policy" ? <PolicyTab /> : null}
      {tab === "company" ? <CompanyTab /> : null}
      {tab === "certificates" ? <CertificatesTab /> : null}
    </div>
  );
}

function PolicyTab() {
  const services = useServices();
  const client = useQueryClient();
  const policy = useQuery({ queryKey: ["training-policy"], queryFn: () => services.trainingPolicy() });
  const [form, setForm] = useState<{ requireBasicBeforeApply: boolean; quizPassPercent: number; privateRequestMinHeadcount: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = form ?? (policy.data ? { requireBasicBeforeApply: policy.data.requireBasicBeforeApply, quizPassPercent: policy.data.quizPassPercent, privateRequestMinHeadcount: policy.data.privateRequestMinHeadcount } : null);
  if (policy.isLoading || !policy.data || !current) return <p>載入中…</p>;
  return (
    <Card className="space-y-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={current.requireBasicBeforeApply} onChange={(event) => setForm({ ...current, requireBasicBeforeApply: event.target.checked })} />未完成基礎課不可建立／送出驗證申請</label>
      <Field label="基礎課及格分數（%）"><TextInput type="number" value={current.quizPassPercent} onChange={(event) => setForm({ ...current, quizPassPercent: Number(event.target.value) })} /></Field>
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

function BasicModulesTab() {
  const services = useServices();
  const client = useQueryClient();
  const modules = useQuery({ queryKey: ["admin-basic-modules"], queryFn: () => services.adminBasicModules() });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<Array<{ prompt: string; options: string; correctIndex: number }>>([{ prompt: "", options: "A\nB", correctIndex: 0 }]);
  const [error, setError] = useState<string | null>(null);
  function startNew() {
    setEditing("new");
    setTitle("");
    setBody("");
    setIsRequired(true);
    setIsActive(true);
    setQuestions([{ prompt: "", options: "選項一\n選項二", correctIndex: 0 }]);
  }
  function startEdit(id: string) {
    const module = modules.data?.find((item) => item.id === id);
    if (!module) return;
    setEditing(id);
    setTitle(module.title);
    setBody(module.body);
    setIsRequired(module.isRequired);
    setIsActive(module.isActive);
    setQuestions(module.questions.map((question) => ({ prompt: question.prompt, options: question.options.join("\n"), correctIndex: question.correctIndex ?? 0 })));
  }
  return (
    <div className="space-y-4">
      <Button onClick={startNew}>新增模組</Button>
      {(modules.data ?? []).map((module) => (
        <Card key={module.id} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{module.title} · {module.isActive ? "啟用" : "停用"} · {module.isRequired ? "必做" : "選做"} · {module.questions.length} 題</p>
            <Button variant="secondary" onClick={() => startEdit(module.id)}>編輯</Button>
          </div>
          <p className="line-clamp-2 text-sm text-[var(--muted)]">{module.body}</p>
        </Card>
      ))}
      {editing ? (
        <Card className="space-y-3">
          <h2 className="font-medium">{editing === "new" ? "新增基礎模組" : "編輯基礎模組"}</h2>
          <Field label="標題"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="內容"><TextArea value={body} onChange={(event) => setBody(event.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isRequired} onChange={(event) => setIsRequired(event.target.checked)} />必做</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />啟用</label>
          {questions.map((question, index) => (
            <div key={index} className="space-y-2 border-t border-[var(--line)] pt-3">
              <Field label={`題目 ${index + 1}`}><TextInput value={question.prompt} onChange={(event) => setQuestions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, prompt: event.target.value } : row))} /></Field>
              <Field label="選項（每行一個）"><TextArea value={question.options} onChange={(event) => setQuestions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, options: event.target.value } : row))} /></Field>
              <Field label="正解索引（從 0 起）"><TextInput type="number" value={question.correctIndex} onChange={(event) => setQuestions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, correctIndex: Number(event.target.value) } : row))} /></Field>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setQuestions((rows) => [...rows, { prompt: "", options: "選項一\n選項二", correctIndex: 0 }])}>加一題</Button>
          <div className="flex gap-2">
            <Button onClick={async () => {
              try {
                const current = editing === "new" ? undefined : modules.data?.find((item) => item.id === editing);
                await services.saveBasicModule({
                  title,
                  body,
                  sortOrder: current?.sortOrder ?? ((modules.data?.length ?? 0) + 1),
                  isRequired,
                  isActive,
                  questions: questions.map((question, index) => ({
                    prompt: question.prompt,
                    options: question.options.split("\n").map((item) => item.trim()).filter(Boolean),
                    correctIndex: question.correctIndex,
                    sortOrder: index + 1,
                  })),
                  expectedVersion: current?.version,
                }, editing === "new" ? undefined : editing);
                setEditing(null);
                setError(null);
                await client.invalidateQueries({ queryKey: ["admin-basic-modules"] });
              } catch (reason) {
                setError(reason instanceof ClientError ? reason.message : "儲存失敗");
              }
            }}>儲存模組</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>取消</Button>
          </div>
          {error ? <ErrorText message={error} /> : null}
        </Card>
      ) : null}
    </div>
  );
}

function CompanyTab() {
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

function CertificatesTab() {
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
