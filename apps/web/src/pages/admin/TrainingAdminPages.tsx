import { companyTrainingRequestStatusLabels, courseDeliveryLabels } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useServices } from "../../app/session";
import { CourseListPage } from "./AdminPages";
import { AdminPageHeader, Badge, Button, Card, DataTable, Empty, ErrorText, Field, Modal, SectionHeader, SelectInput, TextArea, TextInput, tableRowClass, NoticeText, confirmDelete, type Notice } from "../../components/ui";
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
      <AdminPageHeader title="課程梯次" description="管理公開線上／線下課程梯次與報名。" />
      <CourseListPage />
    </div>
  );
}

export function BasicCoursesAdminPage() {
  return (
    <div className="space-y-4">
      <AdminPageHeader title="基礎課" description="可新增多門基礎課，設定標題、說明、YouTube 連結、需觀看百分比與教材。達標後由系統標示完成。" />
      <BasicCoursesPanel />
    </div>
  );
}

export function QuestionBankAdminPage() {
  return (
    <div className="space-y-4">
      <AdminPageHeader title="題庫" description="新增題目後填寫選項 A～D，再選擇正確答案；測驗會依門檻設定從題庫抽題。" />
      <QuestionBankPanel />
    </div>
  );
}

export function TrainingPolicyAdminPage() {
  return (
    <div className="space-y-4">
      <AdminPageHeader title="門檻設定" description="設定是否擋驗證申請、抽題數、及格題數與專班最低人數。" />
      <PolicyPanel />
    </div>
  );
}

export function CompanyTrainingAdminPage() {
  return (
    <div className="space-y-4">
      <AdminPageHeader title="專班申請" description="審核業者單獨開班申請。" />
      <CompanyPanel />
    </div>
  );
}

export function TrainingCertificatesAdminPage() {
  return (
    <div className="space-y-4">
      <AdminPageHeader title="一般課證書" description="對已完課報名人工登錄訓練證書編號。" />
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
  const [message, setMessage] = useState<Notice>(null);
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
      <NoticeText notice={message} />
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
  const [requiredWatchPercent, setRequiredWatchPercent] = useState(80);
  const [isRequired, setIsRequired] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [pendingMaterial, setPendingMaterial] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  function startNew() {
    setEditing("new");
    setTitle("");
    setDescription("");
    setYoutubeUrl("");
    setRequiredWatchPercent(80);
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
    setRequiredWatchPercent(module.requiredWatchPercent);
    setIsRequired(module.isRequired);
    setIsActive(module.isActive);
    setPendingMaterial(null);
  }
  return (
    <div className="space-y-4">
      <SectionHeader
        title="基礎課列表"
        hint="業者完成全部必做基礎課並通過測驗後，才能建立驗證申請。"
        actions={<Button onClick={startNew}>＋ 新增基礎課</Button>}
      />
      {modules.isLoading ? <p>載入中…</p> : null}
      {!modules.isLoading && (modules.data ?? []).length === 0 ? <Empty title="尚無基礎課" body="按右上角「＋ 新增基礎課」建立第一門。" /> : null}
      {(modules.data ?? []).length > 0 ? (
        <DataTable columns={["標題", "影片", "需觀看", "教材", "類型", "狀態", "操作"]}>
          {(modules.data ?? []).map((module) => (
            <tr key={module.id} className={tableRowClass}>
              <td className="p-3 font-medium">{module.title}</td>
              <td className="p-3">{module.youtubeUrl ? "已設定" : <span className="text-[var(--muted)]">未設定</span>}</td>
              <td className="p-3">{module.requiredWatchPercent}%</td>
              <td className="p-3">{module.hasMaterial ? module.materialName ?? "已上傳" : <span className="text-[var(--muted)]">無</span>}</td>
              <td className="p-3">{module.isRequired ? "必做" : "選做"}</td>
              <td className="p-3"><Badge tone={module.isActive ? "success" : "neutral"}>{module.isActive ? "啟用" : "停用"}</Badge></td>
              <td className="p-3"><button type="button" className="text-[var(--link)] underline" onClick={() => startEdit(module.id)}>編輯</button></td>
            </tr>
          ))}
        </DataTable>
      ) : null}
      {editing ? (
        <Modal title={editing === "new" ? "新增基礎課" : "編輯基礎課"} onClose={() => setEditing(null)}>
        <div className="max-h-[75vh] space-y-3 overflow-y-auto">
          <Field label="標題"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：基礎課1" /></Field>
          <Field label="說明"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Field label="YouTube 連結" hint="業者需播放至設定百分比後，由系統自動標示完成。"><TextInput value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=" /></Field>
          <Field label="需觀看百分比" hint="例如 80 表示看到影片 80% 後系統自動標示完成。"><TextInput type="number" value={requiredWatchPercent} onChange={(event) => setRequiredWatchPercent(Number(event.target.value))} /></Field>
          <div>
            <label className="btn inline-block cursor-pointer rounded-md px-3 py-2 text-sm">上傳教材
              <input className="sr-only" type="file" onChange={(event) => {
                setPendingMaterial(event.target.files?.[0] ?? null);
                event.target.value = "";
              }} />
            </label>
            {pendingMaterial ? <p className="mt-2 text-sm">已選擇 {pendingMaterial.name}。按下儲存基礎課就會上傳。</p> : null}
            {!pendingMaterial && editing !== "new" && modules.data?.find((item) => item.id === editing)?.hasMaterial ? (
              <p className="mt-2 text-sm text-[var(--muted)]">目前：{modules.data.find((item) => item.id === editing)?.materialName}</p>
            ) : null}
          </div>
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
                  requiredWatchPercent,
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
        </div>
        </Modal>
      ) : null}
    </div>
  );
}

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

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

function emptyOptionDraft() {
  return { A: "", B: "", C: "", D: "" };
}

function optionsToDraft(options: string[]) {
  return {
    A: options[0] ?? "",
    B: options[1] ?? "",
    C: options[2] ?? "",
    D: options[3] ?? "",
  };
}

function draftToOptions(draft: Record<(typeof OPTION_LABELS)[number], string>) {
  return OPTION_LABELS.map((label) => draft[label].trim());
}

function QuestionBankPanel() {
  const services = useServices();
  const client = useQueryClient();
  const bank = useQuery({ queryKey: ["admin-question-bank"], queryFn: () => services.adminQuestionBank() });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [prompt, setPrompt] = useState("");
  const [optionDraft, setOptionDraft] = useState(emptyOptionDraft);
  const [correctLabel, setCorrectLabel] = useState<(typeof OPTION_LABELS)[number]>("A");
  const [message, setMessage] = useState<Notice>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  function startNew() {
    setEditing("new");
    setShowImport(false);
    setPrompt("");
    setOptionDraft(emptyOptionDraft());
    setCorrectLabel("A");
    setError(null);
  }
  function startEdit(id: string) {
    const question = bank.data?.find((item) => item.id === id);
    if (!question) return;
    setEditing(id);
    setPrompt(question.prompt);
    setOptionDraft(optionsToDraft(question.options));
    setCorrectLabel(OPTION_LABELS[question.correctIndex ?? 0] ?? "A");
    setError(null);
  }
  function cancelEdit() {
    setEditing(null);
    setError(null);
  }
  async function refreshBank() {
    await client.invalidateQueries({ queryKey: ["admin-question-bank"] });
    await client.invalidateQueries({ queryKey: ["training-policy"] });
  }
  async function saveCurrent() {
    if (!prompt.trim()) {
      setError("請填寫題目");
      return;
    }
    const options = draftToOptions(optionDraft);
    if (options.some((item) => !item)) {
      setError("請把選項 A、B、C、D 都填寫完成");
      return;
    }
    try {
      await services.saveQuestion({
        prompt: prompt.trim(),
        options,
        correctIndex: OPTION_LABELS.indexOf(correctLabel),
        isActive: true,
      }, editing === "new" ? undefined : editing ?? undefined);
      setEditing(null);
      setError(null);
      setMessage(editing === "new" ? "已新增題目" : "已更新題目");
      await refreshBank();
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : "儲存失敗");
    }
  }
  function renderEditor(title: string) {
    return (
      <div className="space-y-3">
        {title ? <h2 className="font-medium">{title}</h2> : null}
        <Field label="題目"><TextInput value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="請輸入題目內容" /></Field>
        {OPTION_LABELS.map((label) => (
          <Field key={label} label={`選項 ${label}`}>
            <TextInput
              value={optionDraft[label]}
              onChange={(event) => setOptionDraft((current) => ({ ...current, [label]: event.target.value }))}
              placeholder={`請輸入選項 ${label}`}
            />
          </Field>
        ))}
        <Field label="正確答案" hint="請選擇 A、B、C 或 D。">
          <SelectInput value={correctLabel} onChange={(event) => setCorrectLabel(event.target.value as (typeof OPTION_LABELS)[number])}>
            {OPTION_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}{optionDraft[label].trim() ? `：${optionDraft[label].trim()}` : ""}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="flex gap-2">
          <Button onClick={() => void saveCurrent()}>儲存題目</Button>
          <Button variant="ghost" onClick={cancelEdit}>取消</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SectionHeader
        title="題目列表"
        hint={`共 ${bank.data?.length ?? 0} 題。測驗依門檻設定隨機抽題。`}
        actions={
          <>
            <Button variant="secondary" onClick={() => {
              setShowImport((current) => !current);
              if (!showImport) setEditing(null);
            }}>{showImport ? "收合進階匯入" : "進階：檔案匯入"}</Button>
            <Button onClick={startNew} disabled={editing === "new"}>＋ 新增題目</Button>
          </>
        }
      />
      {showImport ? (
        <Card className="space-y-3">
          <p className="text-sm font-medium text-amber-900">注意：匯入會整批覆蓋目前題庫，不是追加。例如上傳 10 題後，舊題會被換成這 10 題。</p>
          <p className="text-sm text-[var(--muted)]">請先下載範例，依格式填寫後再上傳。一般單題請用「新增題目」。</p>
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-sm leading-6">
            <p className="font-medium">CSV 欄位</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--muted)]">
              <li>題目：題幹文字</li>
              <li>選項：A～D 用 <code>|</code> 分隔，例如 <code>選項A|選項B|選項C|選項D</code></li>
              <li>正解索引：A=0、B=1、C=2、D=3</li>
            </ul>
            <p className="mt-2 font-medium">JSON 欄位</p>
            <p className="text-[var(--muted)]">陣列，每題含 <code>prompt</code>、<code>options</code>（四個字串）、<code>correctIndex</code>（0～3）。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadTextFile("題庫範例.csv", `\uFEFF${QUESTION_BANK_CSV_TEMPLATE}\n`, "text/csv;charset=utf-8")}>下載 CSV 範例</Button>
            <Button variant="secondary" onClick={() => downloadTextFile("題庫範例.json", QUESTION_BANK_JSON_TEMPLATE, "application/json")}>下載 JSON 範例</Button>
            <label className="btn inline-block cursor-pointer rounded-md px-3 py-2 text-sm">上傳題庫檔
              <input className="sr-only" type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const rows = await services.uploadQuestionBank(file);
                  setError(null);
                  setMessage(`已覆蓋題庫，目前共 ${rows.length} 題`);
                  setShowImport(false);
                  await refreshBank();
                } catch (reason) {
                  setError(reason instanceof ClientError ? reason.message : "上傳失敗");
                }
              }} />
            </label>
          </div>
        </Card>
      ) : null}
      {(bank.data ?? []).length > 0 ? (
        <DataTable columns={["#", "題目", "選項", "正確答案", "操作"]}>
          {(bank.data ?? []).map((question, index) => (
            <tr key={question.id} className={`${tableRowClass} align-top`}>
              <td className="p-3">{index + 1}</td>
              <td className="p-3 font-medium">{question.prompt}</td>
              <td className="p-3 text-[var(--muted)]">
                {question.options.map((option, optionIndex) => <div key={`${question.id}-${optionIndex}`}>{OPTION_LABELS[optionIndex] ?? optionIndex + 1}. {option}</div>)}
              </td>
              <td className="p-3">{OPTION_LABELS[question.correctIndex ?? 0]}</td>
              <td className="p-3 whitespace-nowrap">
                <button type="button" className="text-[var(--link)] underline disabled:opacity-50" disabled={editing != null} onClick={() => startEdit(question.id)}>編輯</button>
                <button type="button" className="ml-3 text-[var(--danger)] underline disabled:opacity-50" disabled={editing != null} onClick={async () => {
                  if (!confirmDelete(question.prompt)) return;
                  try {
                    await services.deleteQuestion(question.id);
                    setError(null);
                    setMessage("已刪除題目");
                    await refreshBank();
                  } catch (reason) {
                    setError(reason instanceof ClientError ? reason.message : "刪除失敗");
                  }
                }}>刪除</button>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : null}
      {editing ? (
        <Modal title={editing === "new" ? "新增題目" : `編輯第 ${(bank.data ?? []).findIndex((item) => item.id === editing) + 1} 題`} onClose={cancelEdit}>
          <div className="max-h-[75vh] overflow-y-auto">{renderEditor("")}</div>
          {error ? <div className="mt-3"><ErrorText message={error} /></div> : null}
        </Modal>
      ) : null}
      {(bank.data ?? []).length === 0 && editing !== "new" ? <Empty title="尚無題目" body="按「新增題目」，填寫題目與選項 A～D，再選正確答案即可。" /> : null}
      <NoticeText notice={message} />
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

function CompanyPanel() {
  const services = useServices();
  const client = useQueryClient();
  const rows = useQuery({ queryKey: ["admin-company-training"], queryFn: () => services.adminCompanyTrainingRequests() });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = rows.data ?? [];
  const open = list.find((item) => item.id === openId) ?? null;
  const pending = list.filter((item) => item.status === "SUBMITTED").length;
  const review = async (action: "APPROVE" | "REJECT") => {
    if (!open) return;
    try {
      await services.reviewCompanyTrainingRequest(open.id, { action, adminNote: note, expectedVersion: open.version });
      setError(null);
      setOpenId(null);
      setNote("");
      await client.invalidateQueries({ queryKey: ["admin-company-training"] });
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : action === "APPROVE" ? "核准失敗" : "退回失敗");
    }
  };
  return (
    <div className="space-y-4">
      <SectionHeader title="申請列表" hint={list.length ? `共 ${list.length} 筆，待審 ${pending} 筆。` : undefined} />
      {rows.isLoading ? <p>載入中…</p> : null}
      {!rows.isLoading && list.length === 0 ? <Empty title="沒有專班申請" body="業者送出後會出現在這裡。" /> : null}
      {list.length > 0 ? (
        <DataTable columns={["業者", "人數", "希望期間", "方式", "申請人", "狀態", "操作"]}>
          {list.map((item) => (
            <tr key={item.id} className={tableRowClass}>
              <td className="p-3 font-medium">{item.organizationName}</td>
              <td className="p-3">{item.headcount} 人</td>
              <td className="p-3 whitespace-nowrap">{item.preferredStartsOn} 至 {item.preferredEndsOn}</td>
              <td className="p-3">{courseDeliveryLabels[item.delivery].label}{item.location ? ` · ${item.location}` : ""}</td>
              <td className="p-3">{item.requestedByName}</td>
              <td className="p-3"><Badge tone={companyTrainingRequestStatusLabels[item.status].tone}>{companyTrainingRequestStatusLabels[item.status].label}</Badge></td>
              <td className="p-3"><button type="button" className="text-[var(--link)] underline" onClick={() => { setOpenId(item.id); setNote(""); setError(null); }}>{item.status === "SUBMITTED" ? "審核" : "查看"}</button></td>
            </tr>
          ))}
        </DataTable>
      ) : null}
      {open ? (
        <Modal title={`專班申請 · ${open.organizationName}`} onClose={() => setOpenId(null)}>
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[var(--muted)]">人數</dt><dd>{open.headcount} 人</dd>
            <dt className="text-[var(--muted)]">希望期間</dt><dd>{open.preferredStartsOn} 至 {open.preferredEndsOn}</dd>
            <dt className="text-[var(--muted)]">方式</dt><dd>{courseDeliveryLabels[open.delivery].label}{open.location ? ` · ${open.location}` : ""}</dd>
            <dt className="text-[var(--muted)]">申請人</dt><dd>{open.requestedByName}</dd>
            <dt className="text-[var(--muted)]">說明</dt><dd>{open.note || "—"}</dd>
            {open.status !== "SUBMITTED" ? <><dt className="text-[var(--muted)]">管理員意見</dt><dd>{open.adminNote || "—"}</dd></> : null}
          </dl>
          {open.status === "SUBMITTED" ? (
            <div className="mt-4 space-y-3">
              <Field label="管理員意見"><TextArea value={note} onChange={(event) => setNote(event.target.value)} /></Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="danger" onClick={() => review("REJECT")}>退回</Button>
                <Button onClick={() => review("APPROVE")}>核准</Button>
              </div>
            </div>
          ) : null}
          {error ? <div className="mt-3"><ErrorText message={error} /></div> : null}
        </Modal>
      ) : null}
    </div>
  );
}

function CertificatesPanel() {
  const services = useServices();
  const courses = useQuery({ queryKey: ["admin-courses"], queryFn: () => services.courses("manage") });
  const [courseId, setCourseId] = useState("");
  const enrollments = useQuery({ queryKey: ["admin-course-enrollments", courseId], queryFn: () => services.courseEnrollments(courseId), enabled: Boolean(courseId) });
  const [form, setForm] = useState({ enrollmentId: "", certificateNo: "", issuedOnDate: "", validUntilDate: "" });
  const [message, setMessage] = useState<Notice>(null);
  const [error, setError] = useState<string | null>(null);
  const completed = (enrollments.data ?? []).filter((item) => item.completion === "COMPLETED");
  const editing = completed.find((item) => item.id === form.enrollmentId) ?? null;
  return (
    <div className="space-y-3">
      <SectionHeader
        title="完課學員"
        hint="只對已完課的報名登錄一般課訓練證書（人工編號）。"
        actions={
          <SelectInput className="w-64" aria-label="課程" value={courseId} onChange={(event) => { setCourseId(event.target.value); setForm((current) => ({ ...current, enrollmentId: "" })); }}>
            <option value="">選擇課程</option>
            {(courses.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </SelectInput>
        }
      />
      <NoticeText notice={editing ? null : message} />
      {!courseId ? <Empty title="先選課程" body="選擇課程後會列出完課學員與已登錄的證書編號。" /> : null}
      {courseId && enrollments.isLoading ? <p>載入中…</p> : null}
      {courseId && !enrollments.isLoading && completed.length === 0 ? <Empty title="這門課還沒有完課學員" body="出席登錄達到完課門檻後，學員會出現在這裡。" /> : null}
      {completed.length > 0 ? (
        <DataTable columns={["學員", "證書編號", "操作"]}>
          {completed.map((item) => (
            <tr key={item.id} className={tableRowClass}>
              <td className="p-3 font-medium">{item.userName}</td>
              <td className="p-3">{item.trainingCertificateNo ?? <span className="text-[var(--muted)]">尚未登錄</span>}</td>
              <td className="p-3">
                <button type="button" className="table-action" onClick={() => { setMessage(null); setError(null); setForm({ enrollmentId: item.id, certificateNo: item.trainingCertificateNo ?? "", issuedOnDate: "", validUntilDate: "" }); }}>
                  {item.trainingCertificateNo ? "更新" : "登錄證書"}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : null}
      {editing ? (
        <Modal title={`${editing.userName} 的訓練證書`} onClose={() => setForm({ ...form, enrollmentId: "" })}>
          <div className="space-y-3">
            <Field label="證書編號"><TextInput value={form.certificateNo} onChange={(event) => setForm({ ...form, certificateNo: event.target.value })} /></Field>
            <Field label="核發日"><TextInput type="date" value={form.issuedOnDate} onChange={(event) => setForm({ ...form, issuedOnDate: event.target.value })} /></Field>
            <Field label="到期日"><TextInput type="date" value={form.validUntilDate} onChange={(event) => setForm({ ...form, validUntilDate: event.target.value })} /></Field>
            <Button onClick={async () => {
              try {
                await services.registerTrainingCertificate(form);
                setError(null);
                setMessage(`已登錄 ${editing.userName} 的訓練證書`);
                setForm({ ...form, enrollmentId: "" });
                await enrollments.refetch();
              } catch (reason) {
                setError(reason instanceof ClientError ? reason.message : "登錄失敗");
              }
            }}>儲存證書</Button>
            {error ? <ErrorText message={error} /> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
