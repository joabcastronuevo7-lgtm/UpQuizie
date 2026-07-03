import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout, { Icon } from "../components/Layout";
import { api, ExamMonitor as Monitor, MonitorStudent } from "../api";

const ONLINE_WINDOW_SEC = 30; // last heartbeat within this window == "online"

function secsBetween(fromISO: string | null, toMs: number): number | null {
  if (!fromISO) return null;
  return Math.max(0, Math.round((toMs - new Date(fromISO).getTime()) / 1000));
}

function fmtClock(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const statusStyle: Record<string, string> = {
  not_started: "bg-surface-container-high text-on-surface-variant",
  in_progress: "bg-secondary-container text-on-secondary-container",
  completed: "bg-green-100 text-green-800",
  needs_review: "bg-orange-100 text-orange-800",
};
const statusLabel: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Submitted",
  needs_review: "Needs review",
};

export default function ExamMonitor() {
  const { id } = useParams();
  const nav = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["exam-monitor", id],
    queryFn: () => api.get<Monitor>(`/exams/${id}/monitor`),
    enabled: !!id,
    refetchInterval: 4000,
  });

  if (isLoading) {
    return <Layout title="Live Monitor"><p className="text-on-surface-variant">Loading session…</p></Layout>;
  }
  if (isError || !data) {
    return (
      <Layout title="Live Monitor">
        <p className="text-error mb-4">{(error as Error)?.message || "Could not load this session."}</p>
        <button onClick={() => nav("/sessions")} className="text-secondary font-semibold">← Back to Exam Sessions</button>
      </Layout>
    );
  }

  const nowMs = new Date(data.now).getTime();
  const { exam, summary, students } = data;

  return (
    <Layout title="Live Monitor">
      <button onClick={() => nav("/sessions")}
        className="flex items-center gap-1 text-secondary font-semibold text-sm mb-4 hover:underline">
        <Icon name="arrow_back" className="text-[18px]" /> Exam Sessions
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-secondary rounded-full animate-pulse" />
            <h2 className="font-headline text-2xl text-primary">{exam.title}</h2>
          </div>
          <p className="text-on-surface-variant text-sm">
            {exam.question_count} questions • {exam.duration_min} min • {exam.total_points} points • live (auto-refreshes)
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Tile label="Enrolled" value={summary.enrolled} icon="group" />
        <Tile label="Not started" value={summary.not_started} icon="schedule" tone="muted" />
        <Tile label="In progress" value={summary.in_progress} icon="edit_note" tone="secondary" />
        <Tile label="Submitted" value={summary.submitted} icon="task_alt" tone="success" />
      </div>

      {/* Roster */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.6fr_1fr_1.4fr_1fr_1fr] gap-4 px-6 py-3 bg-surface-container-low text-[11px] font-bold uppercase tracking-wider text-outline">
          <span>Student</span><span>Status</span><span>Progress</span><span>Time</span><span>Score</span>
        </div>
        <div className="divide-y divide-outline-variant">
          {students.map((s) => (
            <StudentRow key={s.student_id} s={s} nowMs={nowMs} durationMin={exam.duration_min} />
          ))}
          {students.length === 0 && (
            <p className="px-6 py-8 text-on-surface-variant text-sm">
              No students are enrolled in this subject yet. Enroll students to monitor their sessions.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StudentRow({ s, nowMs, durationMin }: { s: MonitorStudent; nowMs: number; durationMin: number }) {
  const sinceSeen = secsBetween(s.last_seen_at, nowMs);
  const online = s.status === "in_progress" && sinceSeen != null && sinceSeen <= ONLINE_WINDOW_SEC;
  const away = s.status === "in_progress" && s.focused === false;

  const elapsed = secsBetween(s.started_at, nowMs);
  const remaining = elapsed != null ? durationMin * 60 - elapsed : null;
  const pct = s.question_count > 0 ? Math.round((s.answered_count / s.question_count) * 100) : 0;
  const scorePct =
    s.score != null && s.total_points ? Math.round((s.score / s.total_points) * 100) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1.4fr_1fr_1fr] gap-2 md:gap-4 px-6 py-4 items-center">
      {/* Student + presence */}
      <div className="flex items-center gap-3">
        <span
          title={online ? "Online" : "Offline"}
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${online ? "bg-green-500 animate-pulse" : "bg-surface-container-highest"}`}
        />
        <div className="min-w-0">
          <p className="font-semibold text-on-surface truncate">{s.name}</p>
          {s.identifier && <p className="text-xs text-on-surface-variant truncate">{s.identifier}</p>}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyle[s.status]}`}>
          {statusLabel[s.status]}
        </span>
        {away && (
          <span title="Exam tab is not focused" className="flex items-center gap-1 text-xs font-semibold text-error">
            <Icon name="warning" className="text-[15px]" /> Away
          </span>
        )}
      </div>

      {/* Progress */}
      <div>
        {s.status === "in_progress" || s.status === "completed" || s.status === "needs_review" ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-on-surface-variant whitespace-nowrap">
              {s.answered_count}/{s.question_count}
            </span>
          </div>
        ) : (
          <span className="text-xs text-on-surface-variant">—</span>
        )}
      </div>

      {/* Time */}
      <div className="text-sm">
        {s.status === "in_progress" && remaining != null ? (
          <span className={`font-mono ${remaining < 300 ? "text-error font-bold" : "text-on-surface-variant"}`}>
            {fmtClock(remaining)} left
          </span>
        ) : s.status === "not_started" ? (
          <span className="text-on-surface-variant">—</span>
        ) : (
          <span className="text-on-surface-variant">Done</span>
        )}
      </div>

      {/* Score */}
      <div className="text-sm">
        {scorePct != null ? (
          <span className="font-bold text-primary">
            {scorePct}% <span className="text-on-surface-variant font-normal">({s.score}/{s.total_points})</span>
          </span>
        ) : (
          <span className="text-on-surface-variant">—</span>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, icon, tone = "primary" }: { label: string; value: number; icon: string; tone?: string }) {
  const toneCls: Record<string, string> = {
    primary: "text-primary",
    secondary: "text-secondary",
    success: "text-green-600",
    muted: "text-on-surface-variant",
  };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-on-surface-variant">{label}</p>
        <Icon name={icon} className={`text-[20px] ${toneCls[tone]}`} />
      </div>
      <p className={`font-headline text-3xl font-bold mt-2 ${toneCls[tone]}`}>{value}</p>
    </div>
  );
}
