import { useState } from "react";
import { Link } from "react-router";
import { formatTaipei } from "../lib/format";
import type { Course } from "@mf/contracts";

const COLORS = ["#1f6eae", "#0c4f86", "#2f7d6d", "#a56b2a", "#6b4c9a", "#9a4d55"];

function courseColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length] ?? COLORS[0];
}

function taipeiKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function registrationLabel(course: Course) {
  if (course.status === "CANCELLED") return "已取消，不能報名";
  if (course.status === "COMPLETED") return "課程已結束";
  if (course.remainingSeats <= 0) return "已額滿";
  const now = Date.now();
  if (now < Date.parse(course.registrationOpensAt)) return "尚未開放報名";
  if (now > Date.parse(course.registrationClosesAt)) return "報名已截止";
  return `開放報名，剩餘 ${course.remainingSeats} 名`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function CourseCalendar({ courses }: { courses: Course[] }) {
  const today = taipeiKey(new Date().toISOString()).split("-");
  const [cursor, setCursor] = useState({ year: Number(today[0]), month: Number(today[1]) - 1 });
  const { year, month } = cursor;
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = daysInMonth(year, month);
  const cells: Array<number | null> = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: count }, (_, index) => index + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const byDay = new Map<string, Course[]>();
  for (const course of courses) {
    const cursorDate = new Date(`${taipeiKey(course.startsAt)}T00:00:00Z`);
    const last = new Date(`${taipeiKey(course.endsAt)}T00:00:00Z`);
    while (cursorDate <= last) {
      const key = cursorDate.toISOString().slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push(course);
      byDay.set(key, list);
      cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="btn rounded-md px-3 py-2 text-sm" onClick={() => setCursor(shiftMonth(year, month, -1))}>上個月</button>
        <p className="text-lg">{year}年{month + 1}月</p>
        <button type="button" className="btn rounded-md px-3 py-2 text-sm" onClick={() => setCursor(shiftMonth(year, month, 1))}>下個月</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm text-[var(--muted)]">
        {["日", "一", "二", "三", "四", "五", "六"].map((label) => <div key={label}>{label}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          const key = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
          const items = day ? byDay.get(key) ?? [] : [];
          const align = index % 7 >= 4 ? "right-0" : "left-0";
          return (
            <div key={`${index}-${day ?? "x"}`} tabIndex={items.length ? 0 : undefined} className="group relative min-h-20 rounded-md border border-[var(--line)] bg-[var(--surface)] p-1 text-left">
              <span className="text-sm">{day ?? ""}</span>
              {items.map((course) => (
                <span key={course.id} className="course-mark mt-1 block h-1.5 rounded-full" style={{ background: courseColor(course.id) }} />
              ))}
              {items.length ? (
                <div className={`pointer-events-none absolute ${align} top-full z-20 hidden w-72 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 text-left shadow-md group-hover:pointer-events-auto group-hover:block group-focus-within:pointer-events-auto group-focus-within:block`}>
                  {items.map((course) => (
                    <div key={course.id} className="space-y-1 border-t border-[var(--line)] py-2 first:border-t-0 first:pt-0">
                      <p className="font-medium" style={{ color: courseColor(course.id) }}>{course.title}</p>
                      <p className="text-sm leading-6">課程內容：{course.description}</p>
                      <p className="text-sm">時間：{formatTaipei(course.startsAt)} 至 {formatTaipei(course.endsAt)}</p>
                      <p className="text-sm">地點：{course.location}</p>
                      <p className="text-sm">報名：{registrationLabel(course)}</p>
                      <Link className="text-sm" to={`/courses/${course.id}`}>前往這一梯次</Link>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
