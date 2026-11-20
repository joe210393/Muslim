import { companyTrainingRequestStatusLabels, courseDeliveryLabels, studyStatusLabel, type LearningRecord } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useServices } from "../../app/session";
import { YoutubeWatchPlayer } from "../../components/YoutubeWatchPlayer";
import { Button, Card, Empty, ErrorText, Field, Modal, SelectInput, TextArea, TextInput } from "../../components/ui";
import { ClientError } from "../../services/types";

const filters = [
  ["ALL", "不限"],
  ["ENROLLED", "已報名"],
  ["COMPLETED", "已完成"],
  ["CANCELLED", "已取消"],
] as const;

type FilterId = (typeof filters)[number][0];
type Tab = "basic" | "general" | "company";

function matches(row: LearningRecord, filter: FilterId) {
  if (filter === "ENROLLED") return row.status === "CONFIRMED" && row.completion !== "COMPLETED";
  if (filter === "COMPLETED") return row.completion === "COMPLETED";
  if (filter === "CANCELLED") return row.status === "CANCELLED" || row.completion === "CANCELLED";
  return true;
}

function taipeiDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function creditHours(minutes: number) {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function clock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function TrainingPage() {
  const [tab, setTab] = useState<Tab>("basic");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">教育訓練</h1>
      <div className="flex flex-wrap gap-2">
        {([["basic", "基礎教育訓練"], ["general", "線上／線下課程"], ["company", "申請專班"]] as const).map(([id, label]) => (
          <button key={id} type="button" className={`btn rounded-full px-3 py-1 text-sm ${tab === id ? "is-selected" : ""}`} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === "basic" ? <BasicTrainingPanel /> : null}
      {tab === "general" ? <GeneralTrainingPanel /> : null}
      {tab === "company" ? <CompanyTrainingPanel /> : null}
    </div>
  );
}

function BasicTrainingPanel() {
  const services = useServices();
  const client = useQueryClient();
  const status = useQuery({ queryKey: ["basic-training"], queryFn: () => services.basicTrainingStatus() });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quiz, setQuiz] = useState<NonNullable<Awaited<ReturnType<typeof services.startBasicQuiz>>> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = status.data;
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["basic-training"] });
  }
  useEffect(() => {
    if (data?.activeAttempt) {
      setQuiz(data.activeAttempt);
      setAnswers({});
    }
  }, [data?.activeAttempt?.attemptId]);
  if (status.isLoading) return <p>載入中…</p>;
  if (!data) return <ErrorText message="無法載入基礎教育訓練" />;
  const activeQuiz = quiz ?? data.activeAttempt;
  return (
    <div className="space-y-4">
      <Card className="space-y-2 text-sm">
        <p>{data.policy.requireBasicBeforeApply ? "完成基礎課內容與測驗後，才能建立驗證申請。" : "目前後台未強制基礎課才可申請；仍建議先完成。"}</p>
        <p>抽 {data.policy.quizDrawCount} 題，答對 {data.policy.quizPassCount} 題及格。狀態：{data.passed ? "已完成" : data.requiredComplete ? (data.canTakeQuiz || activeQuiz ? "可參加測驗" : "題庫不足，請聯絡管理員") : "請先觀看必做基礎課影片至系統標示完成"}。</p>
        {data.lastCorrectCount != null && data.lastDrawCount != null ? <p>最近一次測驗：答對 {data.lastCorrectCount}/{data.lastDrawCount}</p> : null}
        {data.passed ? <p className="text-emerald-800">基礎教育訓練已完成。此區塊不發放證書；證書僅線上／線下課程與專班完課後由承辦登錄。</p> : null}
      </Card>
      {data.modules.map((module) => {
        const watchedSeconds = module.watchedSeconds ?? 0;
        const durationSeconds = module.videoDurationSeconds ?? 0;
        const watchedPercent = durationSeconds > 0 ? Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100)) : 0;
        const passPercent = module.requiredWatchPercent;
        return (
          <Card key={module.id} className="space-y-2">
            <h2 className="font-medium">{module.title}{module.isRequired ? "（必做）" : ""}</h2>
            {module.description ? <p className="whitespace-pre-wrap text-sm">{module.description}</p> : null}
            {module.youtubeUrl ? (
              <YoutubeWatchPlayer
                youtubeUrl={module.youtubeUrl}
                title={module.title}
                enabled={!module.completed && !data.passed}
                onProgress={(seconds, videoDurationSeconds) => {
                  if (module.completed || data.passed || (seconds <= watchedSeconds && videoDurationSeconds === durationSeconds)) return;
                  void services.recordBasicModuleWatch(module.id, { watchedSeconds: seconds, videoDurationSeconds }).then((next) => {
                    const updated = next.modules.find((item) => item.id === module.id);
                    if (updated?.completed && !module.completed) {
                      setMessage(`系統已標示完成：${module.title}`);
                      setError(null);
                    }
                    client.setQueryData(["basic-training"], next);
                  }).catch((reason) => setError(reason instanceof ClientError ? reason.message : "觀看進度沒有寫入"));
                }}
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">此課尚未設定影片，請聯絡管理員。</p>
            )}
            <p className="text-sm text-[var(--muted)]">
              需觀看至少 {passPercent}%；目前 {watchedPercent}%（{clock(watchedSeconds)}{durationSeconds ? `／${clock(durationSeconds)}` : ""}）。
              {module.completed ? " 系統已標示完成。" : " 達標後由系統自動標示，無需自行點選。"}
            </p>
            {module.hasMaterial ? (
              <Button variant="secondary" onClick={async () => {
                const file = await services.downloadBasicModuleMaterial(module.id);
                const url = URL.createObjectURL(file.blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = file.name;
                link.click();
              }}>下載教材{module.materialName ? `（${module.materialName}）` : ""}</Button>
            ) : null}
            {module.completed ? <p className="text-sm text-emerald-800">系統已標示完成</p> : null}
          </Card>
        );
      })}
      {!data.passed && data.canTakeQuiz && !activeQuiz ? (
        <Card className="space-y-3">
          <h2 className="font-medium">基礎測驗</h2>
          <p className="text-sm text-[var(--muted)]">系統會從題庫隨機抽出 {data.policy.quizDrawCount} 題，答對 {data.policy.quizPassCount} 題即通過。</p>
          <Button onClick={async () => {
            try {
              const session = await services.startBasicQuiz();
              setQuiz(session);
              setAnswers({});
              setError(null);
              await refresh();
            } catch (reason) {
              setError(reason instanceof ClientError ? reason.message : "無法開始測驗");
            }
          }}>開始測驗</Button>
        </Card>
      ) : null}
      {activeQuiz ? (
        <Card className="space-y-3">
          <h2 className="font-medium">基礎測驗（抽 {activeQuiz.drawCount} 題，答對 {activeQuiz.passCount} 題及格）</h2>
          {activeQuiz.questions.map((question) => (
            <div key={question.id} className="space-y-2 border-t border-[var(--line)] pt-3">
              <p className="text-sm">{question.prompt}</p>
              {question.options.map((option, index) => (
                <label key={`${question.id}-${index}`} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={question.id} checked={answers[question.id] === index} onChange={() => setAnswers((current) => ({ ...current, [question.id]: index }))} />
                  {option}
                </label>
              ))}
            </div>
          ))}
          <Button onClick={async () => {
            try {
              const payload = activeQuiz.questions.map((question) => ({ questionId: question.id, selectedIndex: answers[question.id] ?? -1 }));
              if (payload.some((item) => item.selectedIndex < 0)) {
                setError("請答完所有題目");
                return;
              }
              const result = await services.submitBasicQuiz({ attemptId: activeQuiz.attemptId, answers: payload });
              setQuiz(null);
              setAnswers({});
              setError(null);
              setMessage(result.justPassed
                ? `測驗通過（答對 ${result.correctCount}/${result.drawCount}），基礎教育訓練已完成。`
                : `尚未及格（答對 ${result.correctCount}/${result.drawCount}），可再考一次。`);
              await refresh();
            } catch (reason) {
              setError(reason instanceof ClientError ? reason.message : "交卷失敗");
            }
          }}>交卷</Button>
        </Card>
      ) : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <ErrorText message={error} /> : null}
      <p className="text-sm"><Link className="text-[var(--link)]" to="/portal/applications">前往驗證申請</Link></p>
    </div>
  );
}

function GeneralTrainingPanel() {
  const services = useServices();
  const client = useQueryClient();
  const rows = useQuery({ queryKey: ["learning"], queryFn: () => services.learning() });
  const [filter, setFilter] = useState<FilterId>("ALL");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reading, setReading] = useState<LearningRecord | null>(null);
  const visible = (rows.data ?? []).filter((row) => matches(row, filter));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">公開線上／線下課程報名與學習紀錄。</p>
        <SelectInput className="w-36" value={filter} aria-label="篩選報名狀態" onChange={(event) => setFilter(event.target.value as FilterId)}>
          {filters.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </SelectInput>
      </div>
      {rows.isLoading ? <p>載入中…</p> : null}
      {!rows.isLoading && visible.length === 0 ? <Empty title="沒有符合的課程" body="可從公開課程頁報名。已報名、已取消、已完成可以在右上角篩選。" /> : null}
      {visible.length > 0 ? (
        <div className="overflow-x-auto rounded-xl bg-white">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="bg-[var(--accent-deep)] text-left text-white">
              <tr>
                {["課程類別", "課程名稱", "認證時數", "開課期間", "學習狀態", "申請退選", "課程回饋", "學習證明", "訓練證書", "閱讀時數"].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const study = studyStatusLabel(row.completion);
                return (
                  <tr key={row.id} className="border-t align-middle">
                    <td className="px-3 py-3">{courseDeliveryLabels[row.delivery].label}</td>
                    <td className="max-w-56 px-3 py-3">{row.courseTitle}</td>
                    <td className="px-3 py-3">{creditHours(row.durationMinutes)}</td>
                    <td className="px-3 py-3">從 {taipeiDate(row.startsAt)}<br />到 {taipeiDate(row.endsAt)}</td>
                    <td className="px-3 py-3"><span className={`inline-flex rounded-md px-3 py-1 text-white ${study.tone === "success" ? "bg-[#3d9a62]" : study.tone === "danger" ? "bg-[#d4657a]" : "bg-[#8aa0b3]"}`}>{study.label}</span></td>
                    <td className="px-3 py-3">
                      {row.canCancel ? <button type="button" className="rounded-md bg-[#d4657a] px-3 py-1 text-white" onClick={() => setCancelId(row.id)}>退選</button> : <span className={`inline-flex rounded-md px-3 py-1 ${row.completion === "COMPLETED" ? "bg-[#d9f2e3] text-[#1d7a45]" : "text-[var(--muted)]"}`}>{row.withdrawLabel}</span>}
                    </td>
                    <td className="px-3 py-3"><button type="button" className="text-[#d4657a]" disabled title="課程回饋尚未開放" aria-label="課程回饋尚未開放">✕</button></td>
                    <td className="px-3 py-3">{row.completion === "COMPLETED" ? <button type="button" className="text-[var(--link)]" aria-label="下載學習紀錄" onClick={() => downloadRecord(row)}>↓</button> : null}</td>
                    <td className="px-3 py-3">{row.trainingCertificateNo ? <span className="text-sm">{row.trainingCertificateNo}</span> : <span className="text-[var(--muted)]">—</span>}</td>
                    <td className="px-3 py-3"><button type="button" className="text-[var(--link)]" aria-label="查看閱讀時數" onClick={() => setReading(row)}>◎</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {cancelId ? (
        <Modal title="確認退選" onClose={() => setCancelId(null)}>
          <p className="text-sm">退選後名額會釋出。若已通過則不能退選。</p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" onClick={async () => {
              await services.cancelEnrollment(cancelId);
              setCancelId(null);
              await client.invalidateQueries({ queryKey: ["learning"] });
            }}>確認退選</Button>
            <Button variant="secondary" onClick={() => setCancelId(null)}>取消</Button>
          </div>
        </Modal>
      ) : null}
      {reading ? <ReadingModal row={reading} onClose={() => setReading(null)} onChanged={async () => { await client.invalidateQueries({ queryKey: ["learning"] }); }} /> : null}
    </div>
  );
}

function CompanyTrainingPanel() {
  const services = useServices();
  const client = useQueryClient();
  const policy = useQuery({ queryKey: ["training-policy"], queryFn: () => services.trainingPolicy() });
  const rows = useQuery({ queryKey: ["company-training"], queryFn: () => services.myCompanyTrainingRequests() });
  const [form, setForm] = useState({ headcount: 20, preferredStartsOn: "", preferredEndsOn: "", delivery: "OFFLINE" as "ONLINE" | "OFFLINE", location: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const min = policy.data?.privateRequestMinHeadcount ?? 20;
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-medium">申請單獨開班</h2>
        <p className="text-sm text-[var(--muted)]">人數至少 {min} 人才能送出，由管理員評估是否為貴公司單獨開立。初版核准後不會自動建課。</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="預計人數" required><TextInput type="number" value={form.headcount} onChange={(event) => setForm({ ...form, headcount: Number(event.target.value) })} /></Field>
          <Field label="上課方式" required>
            <SelectInput value={form.delivery} onChange={(event) => setForm({ ...form, delivery: event.target.value as "ONLINE" | "OFFLINE" })}>
              <option value="OFFLINE">線下</option>
              <option value="ONLINE">線上</option>
            </SelectInput>
          </Field>
          <Field label="希望開始日" required><TextInput type="date" value={form.preferredStartsOn} onChange={(event) => setForm({ ...form, preferredStartsOn: event.target.value })} /></Field>
          <Field label="希望結束日" required><TextInput type="date" value={form.preferredEndsOn} onChange={(event) => setForm({ ...form, preferredEndsOn: event.target.value })} /></Field>
          {form.delivery === "OFFLINE" ? <Field label="希望地點" required><TextInput value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field> : null}
          <Field label="說明"><TextArea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
        </div>
        <Button onClick={async () => {
          try {
            if (form.headcount < min) {
              setError(`專班申請至少需要 ${min} 人`);
              setMessage(null);
              return;
            }
            const saved = await services.saveCompanyTrainingRequest(form);
            await services.submitCompanyTrainingRequest(saved.id, saved.version);
            setError(null);
            setMessage("已送出專班申請");
            await client.invalidateQueries({ queryKey: ["company-training"] });
          } catch (reason) {
            setError(reason instanceof ClientError ? reason.message : "送出失敗");
          }
        }}>儲存並送出</Button>
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        {error ? <ErrorText message={error} /> : null}
      </Card>
      <div className="space-y-2">
        <h2 className="font-medium">我的專班申請</h2>
        {rows.isLoading ? <p>載入中…</p> : null}
        {(rows.data ?? []).length === 0 ? <Empty title="還沒有專班申請" body="上方填寫後即可送出。" /> : null}
        {(rows.data ?? []).map((item) => (
          <Card key={item.id} className="space-y-1 text-sm">
            <p className="font-medium">{companyTrainingRequestStatusLabels[item.status].label} · {item.headcount} 人</p>
            <p>{item.preferredStartsOn} 至 {item.preferredEndsOn} · {courseDeliveryLabels[item.delivery].label}{item.location ? ` · ${item.location}` : ""}</p>
            {item.adminNote ? <p>管理員意見：{item.adminNote}</p> : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

function downloadRecord(row: LearningRecord) {
  const content = [`課程,${row.courseTitle}`, `狀態,${studyStatusLabel(row.completion).label}`, `時數,${row.attendedHoursLabel}`].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${row.courseTitle}-learning.csv`;
  link.click();
}

function ReadingModal({ row, onClose, onChanged }: { row: LearningRecord; onClose: () => void; onChanged: () => Promise<void> }) {
  const services = useServices();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (row.delivery === "ONLINE") {
      void services.courseVideo(row.courseId).then((file) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(file.blob);
        setUrl(objectUrl);
      }).catch((reason) => setError(reason instanceof ClientError ? reason.message : "無法載入影片"));
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row.courseId, row.delivery, services]);
  return (
    <Modal title={row.courseTitle} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p>已累計 {row.attendedHoursLabel}{row.delivery === "ONLINE" ? `（通過門檻 ${clock(row.passSeconds)}）` : ""}</p>
        {row.delivery === "ONLINE" && url ? (
          <video
            ref={videoRef}
            className="w-full rounded-md bg-black"
            controls
            src={url}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video) return;
              void services.recordWatch(row.id, { expectedVersion: row.version, watchedSeconds: Math.floor(video.currentTime) }).then(onChanged).catch((reason) => setError(reason instanceof ClientError ? reason.message : "進度沒有寫入"));
            }}
          />
        ) : null}
        {error ? <ErrorText message={error} /> : null}
      </div>
    </Modal>
  );
}
