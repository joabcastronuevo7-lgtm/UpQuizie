import { useQuery } from "@tanstack/react-query";
import Layout, { Icon } from "../components/Layout";
import { api } from "../api";

interface Perf {
  average_score: number | null;
  attempts: { id: string; title: string; subject: string; score: number | null; total_points: number | null; status: string }[];
  weak_topics: { topic: string; accuracy: number; weak: boolean }[];
}

export default function StudentPerformance() {
  const { data: perf } = useQuery({ queryKey: ["me-performance"], queryFn: () => api.get<Perf>("/me/performance") });
  const avg = perf?.average_score;
  const attempts = perf?.attempts || [];
  const completed = attempts.filter((a) => a.status !== "in_progress");
  const topics = perf?.weak_topics || [];

  return (
    <Layout title="Performance">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-primary text-on-primary rounded-xl p-6">
          <p className="text-sm opacity-80">Average Score</p>
          <p className="font-headline text-4xl font-bold mt-2">{avg != null ? `${avg.toFixed(1)}%` : "—"}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <p className="text-sm text-on-surface-variant">Exams Taken</p>
          <p className="font-headline text-4xl font-bold mt-2 text-primary">{completed.length}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <p className="text-sm text-on-surface-variant">Weak Topics</p>
          <p className="font-headline text-4xl font-bold mt-2 text-error">{topics.filter((t) => t.weak).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="font-headline text-lg text-primary mb-4">Topic Performance</h3>
          <div className="space-y-4">
            {topics.map((t) => (
              <div key={t.topic}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-on-surface">{t.topic}</span>
                  <span className={t.weak ? "text-error font-bold" : "text-secondary font-bold"}>{t.accuracy.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${t.weak ? "bg-error" : "bg-secondary"}`} style={{ width: `${t.accuracy}%` }} />
                </div>
              </div>
            ))}
            {topics.length === 0 && <p className="text-sm text-on-surface-variant">No topic data yet. Take an exam to see your strengths and weak areas.</p>}
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="font-headline text-lg text-primary mb-4">Exam History</h3>
          <div className="space-y-3">
            {completed.map((a) => (
              <div key={a.id} className="flex justify-between items-center p-3 bg-surface-container-low rounded-lg">
                <div>
                  <p className="text-sm font-medium text-primary">{a.title}</p>
                  <p className="text-xs text-on-surface-variant">{a.subject}</p>
                </div>
                <span className="text-secondary font-bold">
                  {a.score != null && a.total_points ? `${Math.round((a.score / a.total_points) * 100)}%` : "—"}
                </span>
              </div>
            ))}
            {completed.length === 0 && <p className="text-sm text-on-surface-variant">No exams completed yet.</p>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
