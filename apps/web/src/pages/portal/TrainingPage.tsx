import { courseDeliveryLabels, studyStatusLabel, type LearningRecord } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServices } from "../../app/session";
import { Button, Empty, ErrorText, Modal, SelectInput } from "../../components/ui";
import { ClientError } from "../../services/types";

const filters = [
  ["ALL", "不限"],
  ["ENROLLED", "已報名"],
  ["COMPLETED", "已完成"],
  ["CANCELLED", "已取消"],
] as const;

type FilterId = (typeof filters)[number][0];

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
        <h1 className="text-2xl font-semibold">教育訓練</h1>
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
                {["課程類別", "課程名稱", "認證時數", "開課期間", "學習狀態", "申請退選", "課程回饋", "學習證明", "閱讀時數"].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}
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
                    <td className="px-3 py-3"><button type="button" className="text-[var(--link)]" aria-label="查看閱讀時數" onClick={() => setReading(row)}>◎</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {cancelId ? <Modal title="申請退選" onClose={() => setCancelId(null)}><p className="text-sm">確定取消這筆報名？名額會釋放。已通過的課程不能退選。</p><Button className="mt-3" onClick={async () => { await services.cancelEnrollment(cancelId); setCancelId(null); await client.invalidateQueries({ queryKey: ["learning"] }); }}>確認退選</Button></Modal> : null}
      {reading ? <ReadingDialog row={reading} onClose={() => setReading(null)} onProgress={(next) => { setReading(next); void client.invalidateQueries({ queryKey: ["learning"] }); }} /> : null}
    </div>
  );
}

function downloadRecord(row: LearningRecord) {
  const text = [`學習紀錄`, `這不是正式證書。`, `課程：${row.courseTitle}`, `類別：${courseDeliveryLabels[row.delivery].label}`, `認證時數：${creditHours(row.durationMinutes)}`, `狀態：通過`].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${row.courseTitle}-學習紀錄.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function ReadingDialog({ row, onClose, onProgress }: { row: LearningRecord; onClose: () => void; onProgress: (row: LearningRecord) => void }) {
  const services = useServices();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const played = useRef(row.watchedSeconds);
  const last = useRef(0);
  const version = useRef(row.version);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (row.delivery !== "ONLINE") return;
    let cancelled = false;
    let url = "";
    void services.courseVideo(row.id).then((file) => {
      if (cancelled) return;
      url = URL.createObjectURL(file.blob);
      setSrc(url);
    }).catch((reason) => { if (!cancelled) setError(reason instanceof ClientError ? reason.message : "無法載入影片"); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [row.delivery, row.id, services]);
  useEffect(() => {
    if (row.delivery !== "ONLINE") return;
    const timer = window.setInterval(() => {
      void services.recordWatch(row.id, { expectedVersion: version.current, watchedSeconds: Math.floor(played.current) }).then((saved) => {
        version.current = saved.version;
        played.current = Math.max(played.current, saved.watchedSeconds);
        onProgressRef.current(saved);
      }).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [row.delivery, row.id, services]);
  return (
    <Modal title="閱讀時數" onClose={onClose}>
      <p className="text-sm">{row.courseTitle}</p>
      {row.delivery === "ONLINE" ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">已看 {clock(row.watchedSeconds)}，需看 {clock(row.passSeconds)}（影片時間的三分之二）才算通過。</p>
          {src ? <video ref={videoRef} className="w-full rounded-md bg-black" controls src={src} onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (video.seeking || video.paused) return;
            const delta = video.currentTime - last.current;
            if (delta > 0 && delta < 1.5) played.current += delta;
            last.current = video.currentTime;
          }} onSeeked={(event) => { last.current = event.currentTarget.currentTime; }} /> : <p className="text-sm text-[var(--muted)]">影片載入中…</p>}
        </div>
      ) : <p className="mt-3 text-sm">線下課程的出席時數：{row.attendedHoursLabel}。完課門檻 {row.requiredAttendanceMinutesSnapshot} 分鐘。</p>}
      {error ? <ErrorText message={error} /> : null}
    </Modal>
  );
}
