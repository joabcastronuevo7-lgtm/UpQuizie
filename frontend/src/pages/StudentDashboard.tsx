import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout, { Icon } from "../components/Layout";
import { api, Exam } from "../api";
import { useAuth } from "../auth";

interface Perf {
  average_score: number | null;
  attempts: { id: string; title: string; subject: string; score: number | null; total_points: number | null; status: string; submitted_at: string | null }[];
  weak_topics: { topic: string; accuracy: number; weak: boolean }[];
}

function Ring({ pct }: { pct: number }) {
  const r = 36, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return (
    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-container" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} className="text-secondary" />
    </svg>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [greeting, setGreeting] = useState("Good day");

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => api.get<Exam[]>("/exams") });
  const { data: perf } = useQuery({ queryKey: ["me-performance"], queryFn: () => api.get<Perf>("/me/performance") });

  const available = exams.filter((e) => e.status === "published");
  const avg = perf?.average_score;
  const weak = (perf?.weak_topics || []).filter((t) => t.weak).slice(0, 3);
  const recent = (perf?.attempts || []).slice(0, 4);

  return (
    <Layout title="Dashboard">
      <header className="mb-8">
        <h1 className="font-headline text-3xl text-primary mb-2">{greeting}, {user?.full_name?.split(" ")[0]}.</h1>
        <p className="text-on-surface-variant flex items-center gap-2">
          <Icon name="calendar_today" className="text-secondary" />
          You have <span className="font-bold text-primary">{available.length}</span> exam{available.length === 1 ? "" : "s"} available.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall progress */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="font-headline text-lg text-primary mb-4">Overall Progress</h3>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <Ring pct={avg ?? 0} />
              <div className="absolute inset-0 flex items-center justify-center font-headline text-lg font-bold text-primary">
                {avg != null ? `${avg.toFixed(0)}%` : "—"}
              </div>
            </div>
            <div>
              <p className="text-sm text-on-surface-variant">Average Exam Score</p>
              <p className="font-headline text-lg text-secondary">
                {avg == null ? "No exams yet" : avg >= 85 ? "Elite Status" : avg >= 70 ? "On Track" : "Keep Going"}
              </p>
            </div>
          </div>
        </div>

        {/* AI weakness insights */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="font-headline text-lg text-primary mb-4 flex items-center gap-2"><Icon name="psychology" className="text-secondary" /> AI Weakness Insights</h3>
          <div className="space-y-3">
            {weak.map((t) => (
              <div key={t.topic} className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
                <span className="text-sm font-medium text-primary">{t.topic}</span>
                <span className="text-error font-bold text-sm">{t.accuracy.toFixed(0)}% Match</span>
              </div>
            ))}
            {weak.length === 0 && <p className="text-sm text-on-surface-variant">No weak areas yet — take an exam to see insights.</p>}
          </div>
        </div>

        {/* Recent results */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="font-headline text-lg text-primary mb-4 flex items-center gap-2"><Icon name="history" /> Recent Results</h3>
          <div className="space-y-4">
            {recent.map((a) => (
              <div key={a.id} className="relative pl-5 border-l-2 border-secondary/30">
                <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-secondary" />
                <div className="p-3 bg-surface rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-primary font-medium">{a.title}</span>
                    <span className="text-secondary font-bold text-sm">
                      {a.score != null && a.total_points ? `${Math.round((a.score / a.total_points) * 100)}%` : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{a.subject} • {a.status.replace("_", " ")}</p>
                </div>
              </div>
            ))}
            {recent.length === 0 && <p className="text-sm text-on-surface-variant">No results yet.</p>}
          </div>
        </div>
      </div>

      {/* Exam schedule */}
      <section className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
          <h3 className="font-headline text-lg text-primary">Exam Schedule</h3>
          <button onClick={() => nav("/exams")} className="text-secondary text-sm font-semibold hover:underline">View All</button>
        </div>
        <div className="divide-y divide-outline-variant">
          {available.map((e) => (
            <div key={e.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-secondary-container text-on-secondary-container rounded-lg">
                  <Icon name="quiz" />
                </div>
                <div>
                  <h4 className="font-headline text-lg text-primary">{e.title}</h4>
                  <p className="text-sm text-on-surface-variant">{e.subject} • {e.duration_min} mins • {e.total_points} pts</p>
                </div>
              </div>
              <button onClick={() => nav(`/exams/${e.id}/take`)}
                className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-semibold flex items-center gap-1">
                Start Exam <Icon name="arrow_forward" className="text-[18px]" />
              </button>
            </div>
          ))}
          {available.length === 0 && <p className="p-6 text-on-surface-variant">No exams available right now.</p>}
        </div>
      </section>
    </Layout>
  );
}
