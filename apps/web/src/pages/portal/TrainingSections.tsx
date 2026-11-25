import { courseDeliveryLabels, minutesToHourLabel, type Course, type LearningRecord } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useServices, useSession } from "../../app/session";
import { Button, Card, Empty, ErrorText } from "../../components/ui";
import { ClientError } from "../../services/types";
import { brand } from "../../content/site-content";
import { BasicTrainingPanel, CompanyTrainingPanel } from "./TrainingPanels";

function taipeiDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function hourText(minutes: number) {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function TrainingSectionPage() {
  const { section } = useParams();
  if (section === "offline") return <CourseSplit delivery="OFFLINE" />;
  if (section === "quiz") return <CourseQuizPage />;
  if (section === "hours") return <HoursProofPage />;
  if (section === "materials") return <CourseMaterialsPage />;
  if (section === "company") return <CompanyTrainingPanel />;
  return <CourseSplit delivery="ONLINE" />;
}

function CourseSplit({ delivery }: { delivery: "ONLINE" | "OFFLINE" }) {
  const services = useServices();
  const client = useQueryClient();
  const courses = useQuery({ queryKey: ["courses", "public"], queryFn: () => services.courses("public") });
  const learning = useQuery({ queryKey: ["learning"], queryFn: () => services.learning() });
  const [error, setError] = useState<string | null>(null);
  const visible = (courses.data ?? []).filter((course) => course.delivery === delivery && course.status === "PUBLISHED");
  const mine = new Map((learning.data ?? []).filter((row) => row.status === "CONFIRMED").map((row) => [row.courseId, row]));
  const title = delivery === "ONLINE" ? "線上學習" : "實體課程報名";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{delivery === "ONLINE" ? "線上" : "線下"}課程 {visible.length} 門。看完以後到線上測驗，通過才計入時數。</p>
      </div>
      {delivery === "ONLINE" ? <BasicTrainingPanel /> : <p className="text-sm"><Link className="text-[var(--link)]" to="/portal/training/company">需要單獨開班</Link></p>}
      {courses.isLoading ? <p>載入中…</p> : null}
      {!courses.isLoading && visible.length === 0 ? <Empty title={delivery === "ONLINE" ? "目前沒有線上課程" : "目前沒有線下課程"} body="公開後會出現在這裡。" /> : null}
      {error ? <ErrorText message={error} /> : null}
      <div className="grid gap-3">
        {visible.map((course) => {
          const row = mine.get(course.id);
          return (
            <Card key={course.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{course.title}</p>
                  <p className="text-sm text-[var(--muted)]">{courseDeliveryLabels[course.delivery].label} · {hourText(course.durationMinutes)} 小時 · {taipeiDate(course.startsAt)} 至 {taipeiDate(course.endsAt)}</p>
                </div>
                {row ? <span className="text-sm">{row.quizPassed ? "測驗已通過" : row.quizReady ? "可以測驗" : "已報名"}</span> : (
                  <Button onClick={async () => {
                    try {
                      await services.enroll(course.id);
                      setError(null);
                      await client.invalidateQueries({ queryKey: ["learning"] });
                      await client.invalidateQueries({ queryKey: ["courses", "public"] });
                    } catch (reason) {
                      setError(reason instanceof ClientError ? reason.message : "報名失敗");
                    }
                  }}>報名</Button>
                )}
              </div>
              {course.description ? <p className="whitespace-pre-wrap text-sm">{course.description}</p> : null}
              {course.location ? <p className="text-sm">地點：{course.location}</p> : null}
              {row && !row.quizPassed ? <p className="text-sm">{row.quizBlockedReason || "可以到線上測驗開始作答。"} <Link className="text-[var(--link)]" to="/portal/training/quiz">前往線上測驗</Link></p> : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CourseQuizPage() {
  const services = useServices();
  const client = useQueryClient();
  const learning = useQuery({ queryKey: ["learning"], queryFn: () => services.learning() });
  const [quiz, setQuiz] = useState<{ enrollmentId: string; title: string; attemptId: string; passCount: number; questions: Array<{ id: string; prompt: string; options: string[] }> } | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = (learning.data ?? []).filter((row) => row.status === "CONFIRMED");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">線上測驗</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">每一門課看完以後在這裡測驗。通過後，把該課程的時數計入時數證明。題目來自現有題庫。</p>
      </div>
      {learning.isLoading ? <p>載入中…</p> : null}
      {!learning.isLoading && rows.length === 0 ? <Empty title="還沒有已報名的課程" body="先到線上學習或實體課程報名。" /> : null}
      {rows.map((row) => (
        <Card key={row.id} className="space-y-2">
          <p className="font-medium">{row.courseTitle}</p>
          <p className="text-sm text-[var(--muted)]">{courseDeliveryLabels[row.delivery].label} · 通過後計入 {hourText(row.durationMinutes)} 小時</p>
          {row.quizPassed ? <p className="text-sm text-emerald-800">已通過，{minutesToHourLabel(row.recognizedMinutes)}已計入。<Link className="ml-2 text-[var(--link)]" to="/portal/training/hours">看時數證明</Link></p> : <p className="text-sm">{row.quizBlockedReason || "可以開始測驗。"}</p>}
          {row.quizReady ? <Button onClick={async () => {
            try {
              const session = await services.startCourseQuiz(row.id);
              setQuiz({ enrollmentId: row.id, title: row.courseTitle, attemptId: session.attemptId, passCount: session.passCount, questions: session.questions });
              setAnswers({});
              setError(null);
              setMessage(null);
            } catch (reason) {
              setError(reason instanceof ClientError ? reason.message : "無法開始測驗");
            }
          }}>開始測驗</Button> : null}
        </Card>
      ))}
      {quiz ? (
        <Card className="space-y-4">
          <h2 className="font-medium">{quiz.title}（答對 {quiz.passCount} 題及格）</h2>
          {quiz.questions.map((question, index) => (
            <fieldset key={question.id} className="space-y-1">
              <legend className="text-sm font-medium">{index + 1}. {question.prompt}</legend>
              {question.options.map((option, optionIndex) => (
                <label key={option} className="flex gap-2 text-sm">
                  <input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })} />
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          <Button onClick={async () => {
            if (quiz.questions.some((question) => answers[question.id] == null)) {
              setError("請答完全部題目");
              setMessage(null);
              return;
            }
            try {
              const result = await services.submitCourseQuiz(quiz.enrollmentId, {
                attemptId: quiz.attemptId,
                answers: quiz.questions.map((question) => ({ questionId: question.id, selectedIndex: answers[question.id] ?? -1 })),
              });
              setQuiz(null);
              setMessage(result.passed ? `測驗通過，已計入 ${minutesToHourLabel(result.recognizedMinutes)}。` : `未通過（答對 ${result.correctCount}/${result.drawCount}）。可以再考一次。`);
              setError(null);
              await client.invalidateQueries({ queryKey: ["learning"] });
            } catch (reason) {
              setError(reason instanceof ClientError ? reason.message : "送出失敗");
            }
          }}>送出答案</Button>
        </Card>
      ) : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

function HoursProofPage() {
  const services = useServices();
  const session = useSession();
  const organization = useQuery({ queryKey: ["organization"], queryFn: () => services.organization() });
  const learning = useQuery({ queryKey: ["learning"], queryFn: () => services.learning() });
  const courses = useQuery({ queryKey: ["courses", "public"], queryFn: () => services.courses("public") });
  const passed = (learning.data ?? []).filter((row) => row.quizPassed && row.recognizedMinutes > 0);
  const total = passed.reduce((sum, row) => sum + row.recognizedMinutes, 0);
  const byId = new Map((courses.data ?? []).map((course) => [course.id, course]));
  const name = session.user?.displayName ?? "學員";
  const today = taipeiDate(new Date().toISOString());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">時數證明</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">第一段是通過課程的總時數。下面列出每一門通過的內容、課程與時間。</p>
        </div>
        <Button variant="secondary" onClick={() => window.print()}>列印</Button>
      </div>
      {learning.isLoading ? <p>載入中…</p> : null}
      {!learning.isLoading && passed.length === 0 ? <Empty title="還沒有可列入的時數" body="課程看完並通過線上測驗後，才會出現在這裡。基礎教育訓練不計入這份時數。" /> : null}
      {passed.length > 0 ? (
        <article className="mx-auto max-w-3xl space-y-8 border border-[var(--line)] bg-white p-8">
          <header className="space-y-3 text-center">
            <p className="text-sm tracking-widest">{brand.name}</p>
            <h2 className="text-2xl font-semibold">學習時數證明</h2>
            <p className="text-xl">{name}</p>
            <p className="text-sm text-[var(--muted)]">{organization.data?.organizationName ?? ""}</p>
          </header>
          <p className="text-center text-lg leading-8">{name} 於 {brand.name} 完成課程，時數達 {hourText(total)} 小時。</p>
          <p className="text-center">特頒此證，以資證明</p>
          <p className="text-center text-sm">{today}</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y text-left">
                {["序號", "類別", "課程", "通過的內容", "通過時間", "認可時數"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {passed.map((row, index) => <HoursRow key={row.id} index={index} row={row} course={byId.get(row.courseId)} />)}
            </tbody>
          </table>
        </article>
      ) : null}
    </div>
  );
}

function HoursRow({ index, row, course }: { index: number; row: LearningRecord; course?: Course }) {
  return (
    <tr className="border-b align-top">
      <td className="px-2 py-2">{String(index + 1).padStart(2, "0")}</td>
      <td className="px-2 py-2">{courseDeliveryLabels[row.delivery].label}</td>
      <td className="px-2 py-2">{row.courseTitle}</td>
      <td className="px-2 py-2">{course?.description || "—"}</td>
      <td className="px-2 py-2 whitespace-nowrap">{row.quizPassedAt ? taipeiDate(row.quizPassedAt) : "—"}</td>
      <td className="px-2 py-2 whitespace-nowrap">{row.recognizedMinutes} 分鐘</td>
    </tr>
  );
}

function CourseMaterialsPage() {
  const services = useServices();
  const courses = useQuery({ queryKey: ["courses", "public"], queryFn: () => services.courses("public") });
  const learning = useQuery({ queryKey: ["learning"], queryFn: () => services.learning() });
  const basic = useQuery({ queryKey: ["basic-training"], queryFn: () => services.basicTrainingStatus() });
  const [error, setError] = useState<string | null>(null);
  const enrolled = new Set((learning.data ?? []).filter((row) => row.status === "CONFIRMED").map((row) => row.courseId));
  const visible = (courses.data ?? []).filter((course) => course.status === "PUBLISHED");
  async function download(courseId: string, name: string) {
    try {
      const file = await services.downloadCourseMaterial(courseId);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name || name;
      link.click();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : "無法下載");
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">資源下載</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">每一門課有自己的上課資料。報名後才能下載。</p>
      </div>
      {error ? <ErrorText message={error} /> : null}
      <section className="space-y-2">
        <h2 className="font-medium">基礎教育訓練</h2>
        {(basic.data?.modules ?? []).map((module) => (
          <Card key={module.id} className="flex flex-wrap items-center justify-between gap-3">
            <p>{module.title}</p>
            {module.hasMaterial ? <Button variant="secondary" onClick={async () => {
              try {
                const file = await services.downloadBasicModuleMaterial(module.id);
                const url = URL.createObjectURL(file.blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = file.name || module.materialName || module.title;
                link.click();
                URL.revokeObjectURL(url);
              } catch (reason) {
                setError(reason instanceof ClientError ? reason.message : "無法下載");
              }
            }}>下載{module.materialName ? ` ${module.materialName}` : ""}</Button> : <span className="text-sm text-[var(--muted)]">這門課還沒有上課資料</span>}
          </Card>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">課程</h2>
        {visible.map((course) => (
          <Card key={course.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{course.title}</p>
              <p className="text-sm text-[var(--muted)]">{courseDeliveryLabels[course.delivery].label}</p>
            </div>
            {!course.hasMaterial ? <span className="text-sm text-[var(--muted)]">這門課還沒有上課資料</span> : enrolled.has(course.id) ? <Button variant="secondary" onClick={() => download(course.id, course.materialName ?? course.title)}>下載{course.materialName ? ` ${course.materialName}` : ""}</Button> : <span className="text-sm text-[var(--muted)]">報名後可下載</span>}
          </Card>
        ))}
      </section>
    </div>
  );
}
