import { reviewTargets, type ApplicationDetail, type FieldReview } from "@mf/contracts";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServices, useSession } from "../../app/session";
import { Button, Card, ErrorText, Field, SelectInput, TextArea } from "../../components/ui";
import { ClientError } from "../../services/types";

type Mark = { needsSupplement: boolean; publicComment: string; internalNote: string };

function displayValue(item: ApplicationDetail, key: string) {
  if (key === "category") return item.categoryName;
  if (key === "declarationAccepted") return item.declarationAccepted ? "已確認以上資料可作為本次送件內容" : "未勾選";
  if (key.startsWith("attachment:")) {
    const file = item.attachments.find((attachment) => attachment.requirementKey === key.slice("attachment:".length));
    return file ? file.originalName : "尚未上傳";
  }
  const extra = item.definition.fields.find((field) => field.key === key);
  if (extra) {
    const raw = item.formData[key];
    if (raw === undefined || raw === null || raw === "") return "未填";
    if (extra.inputType === "select") return extra.options?.find((option) => option.value === String(raw))?.label ?? String(raw);
    if (extra.inputType === "checkbox") return raw ? "是" : "否";
    return String(raw);
  }
  const value = item[key as keyof ApplicationDetail];
  return typeof value === "string" && value ? value : "未填";
}

function marksFrom(item: ApplicationDetail): Record<string, Mark> {
  const marks: Record<string, Mark> = {};
  for (const row of item.fieldReviews) marks[row.key] = { needsSupplement: row.needsSupplement, publicComment: row.publicComment, internalNote: row.internalNote };
  return marks;
}

export function ApplicationReview({ item, onChanged }: { item: ApplicationDetail; onChanged: () => Promise<void> }) {
  const services = useServices();
  const session = useSession();
  const client = useQueryClient();
  const canDecide = session.user?.featureKeys?.includes("applications.decide") ?? false;
  const users = useQuery({ queryKey: ["staff-options"], queryFn: () => services.users(), enabled: canDecide });
  const [marks, setMarks] = useState<Record<string, Mark>>(() => marksFrom(item));
  const [note, setNote] = useState("");
  const [decisionComment, setDecisionComment] = useState("");
  const [assignee, setAssignee] = useState("");
  const [reassign, setReassign] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { setMarks(marksFrom(item)); }, [item.id, item.version]);
  const targets = reviewTargets(item.definition);
  const isAssignee = item.assignedToId === session.user?.id;
  const canMark = (session.user?.role === "ADMIN" || isAssignee)
    && (item.status === "INITIAL_REVIEW" || item.status === "SECOND_REVIEW" || (item.status === "FINAL_REVIEW" && canDecide));
  const sections = [...new Set(targets.map((target) => target.section))];
  function currentReviews(): FieldReview[] {
    return targets.map((target) => ({
      key: target.key,
      needsSupplement: marks[target.key]?.needsSupplement ?? false,
      publicComment: marks[target.key]?.publicComment ?? "",
      internalNote: marks[target.key]?.internalNote ?? "",
    }));
  }
  function update(key: string, patch: Partial<Mark>) {
    setMarks((current) => ({ ...current, [key]: { needsSupplement: false, publicComment: "", internalNote: "", ...current[key], ...patch } }));
  }
  async function assignTo(userId: string) {
    if (!userId) {
      setError("請選擇承辦");
      return;
    }
    try {
      await services.assign(item.id, userId, item.version, crypto.randomUUID());
      setReassign(false);
      setError(null);
      setMessage(item.assignedToId ? "已改派，之後仍由這位承辦續審" : "已指派承辦");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : "派案失敗");
    }
  }
  async function saveMarks() {
    try {
      await services.saveFieldReviews(item.id, item.version, currentReviews());
      setError(null);
      setMessage("已儲存補件勾選與意見");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : "儲存失敗");
    }
  }
  async function run(action: string) {
    try {
      await services.review(item.id, {
        action,
        expectedVersion: item.version,
        requestId: crypto.randomUUID(),
        publicComment: action === "APPROVE" || action === "REJECT" ? decisionComment : undefined,
        internalNote: note,
        fieldReviews: currentReviews(),
      });
      setError(null);
      setMessage("已完成審查動作");
      await client.invalidateQueries({ queryKey: ["events", item.id] });
      await onChanged();
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : "動作失敗");
    }
  }
  const actions = availableActions(item.status, canDecide).filter(() => session.user?.role === "ADMIN" || isAssignee);
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-xl">承辦</h2>
        {item.assignedToId ? <p>目前承辦：{item.assignedToName}。初審、複審與補件都由這位承辦繼續處理。</p> : <p>這件還沒有承辦。請管理員先指派，指派後就維持同一人。</p>}
        {!item.assignedToId && session.user?.role === "CASE_OFFICER" ? <p className="text-sm text-[var(--muted)]">承辦不能自己接案。請管理員指派後再開始審查。</p> : null}
        {canDecide && !item.assignedToId ? <AssignFields users={users.data ?? []} value={assignee} onChange={setAssignee} onSubmit={() => void assignTo(assignee)} label="指派承辦" /> : null}
        {canDecide && item.assignedToId ? (
          <div>
            <Button variant="secondary" onClick={() => setReassign((current) => !current)}>{reassign ? "取消改派" : "其他狀況才改派"}</Button>
            {reassign ? <div className="mt-3"><AssignFields users={users.data ?? []} value={assignee} onChange={setAssignee} onSubmit={() => void assignTo(assignee)} label="確認改派" /></div> : null}
          </div>
        ) : null}
      </Card>
      {sections.map((section) => (
        <Card key={section} className="space-y-4">
          <h2 className="text-xl">{section}</h2>
          {targets.filter((target) => target.section === section).map((target) => {
            const mark = marks[target.key] ?? { needsSupplement: false, publicComment: "", internalNote: "" };
            const file = target.key.startsWith("attachment:") ? item.attachments.find((attachment) => attachment.requirementKey === target.key.slice("attachment:".length)) : undefined;
            return (
              <div key={target.key} className="space-y-2 border-t border-[var(--line)] pt-3">
                <p className="text-sm text-[var(--muted)]">{target.label}</p>
                <p>{displayValue(item, target.key)}</p>
                {file ? <button className="text-sm text-[var(--link)]" type="button" onClick={async () => { const downloaded = await services.download(file.fileId); const url = URL.createObjectURL(downloaded.blob); const link = document.createElement("a"); link.href = url; link.download = downloaded.name; link.click(); }}>下載附件</button> : null}
                {canMark ? (
                  <>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mark.needsSupplement} onChange={(event) => update(target.key, { needsSupplement: event.target.checked })} />要求補件</label>
                    <Field label="公開意見"><TextArea value={mark.publicComment} onChange={(event) => update(target.key, { publicComment: event.target.value })} /></Field>
                    <Field label="內部註記" hint="只有員工看得到"><TextArea value={mark.internalNote} onChange={(event) => update(target.key, { internalNote: event.target.value })} /></Field>
                  </>
                ) : mark.needsSupplement || mark.publicComment || mark.internalNote ? (
                  <div className="text-sm">
                    {mark.needsSupplement ? <p>已勾選補件</p> : null}
                    {mark.publicComment ? <p>公開意見：{mark.publicComment}</p> : null}
                    {mark.internalNote ? <p>內部註記：{mark.internalNote}</p> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </Card>
      ))}
      {canMark ? (
        <Card className="space-y-3">
          <Button variant="secondary" onClick={() => void saveMarks()}>儲存補件勾選</Button>
          <Field label="這次動作的內部註記" hint="業者看不到。初審或複審通過時，至少要有公開意見或內部註記。"><TextArea value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          {actions.some((action) => action.code === "APPROVE" || action.code === "REJECT") ? <Field label="核定或退件的公開意見"><TextArea value={decisionComment} onChange={(event) => setDecisionComment(event.target.value)} /></Field> : null}
          <div className="flex flex-wrap gap-2">{actions.map((action) => <Button key={action.code} onClick={() => void run(action.code)}>{action.label}</Button>)}</div>
        </Card>
      ) : null}
      {item.status === "SUBMITTED" && item.assignedToId && (session.user?.role === "ADMIN" || isAssignee) ? <Button onClick={() => void run("START_REVIEW")}>開始初審</Button> : null}
      {message ? <p className="text-sm">{message}</p> : null}
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

function AssignFields({ users, value, onChange, onSubmit, label }: { users: Array<{ id: string; displayName: string; role: string; isActive: boolean }>; value: string; onChange: (value: string) => void; onSubmit: () => void; label: string }) {
  return (
    <div className="space-y-2">
      <Field label="承辦"><SelectInput value={value} onChange={(event) => onChange(event.target.value)}><option value="">選擇</option>{users.filter((user) => user.role !== "APPLICANT" && user.isActive).map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</SelectInput></Field>
      <Button variant="secondary" onClick={onSubmit}>{label}</Button>
    </div>
  );
}

function availableActions(status: string, canDecide: boolean) {
  const decideOnly = new Set(["APPROVE", "REJECT"]);
  const actions = status === "INITIAL_REVIEW" ? [{ code: "PASS_INITIAL", label: "初審通過" }, { code: "REQUEST_SUPPLEMENT", label: "要求補件" }, { code: "REJECT", label: "退件" }]
    : status === "SECOND_REVIEW" ? [{ code: "PASS_SECOND", label: "複審通過" }, { code: "REQUEST_SUPPLEMENT", label: "要求補件" }, { code: "REJECT", label: "退件" }]
    : status === "FINAL_REVIEW" ? [{ code: "APPROVE", label: "核定" }, { code: "REQUEST_SUPPLEMENT", label: "要求補件" }, { code: "REJECT", label: "退件" }]
    : [];
  return canDecide ? actions : actions.filter((action) => !decideOnly.has(action.code) && status !== "FINAL_REVIEW");
}
