import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout, { Icon } from "../components/Layout";
import { api, Subject } from "../api";

interface AnalyticsData {
  topics: { topic: string; correct: number; total: number; accuracy: number; weak: boolean }[];
  average_score: number | null;
}

export default function Analytics() {
  const [subjectId, setSubjectId] = useState("");
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get<Subject[]>("/subjects"),
  });
  const sid = subjectId || subjects[0]?.id || "";

  const { data } = useQuery({
    queryKey: ["analytics", sid],
    queryFn: () => api.get<AnalyticsData>(`/subjects/${sid}/analytics`),
    enabled: !!sid,
  });

  const weak = (data?.topics || []).filter((t) => t.weak);

  return (
    <Layout title="Performance Analytics">
      <div className="flex items-center justify-between mb-6">
        <p className="text-on-surface-variant">Weak-topic detection from student attempts (RAG topic tags).</p>
        <select value={sid} onChange={(e) => setSubjectId(e.target.value)}
          className="border border-outline-variant rounded-lg px-3 py-2 bg-white">
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-primary text-on-primary rounded-xl p-6">
          <p className="text-sm opacity-80">Average Score</p>
          <p className="font-headline text-4xl font-bold mt-2">
            {data?.average_score != null ? `${data.average_score.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <p className="text-sm text-on-surface-variant">Tracked Topics</p>
          <p className="font-headline text-4xl font-bold mt-2 text-primary">{data?.topics.length ?? 0}</p>
        </div>
        <div className="bg-error-container rounded-xl p-6">
          <p className="text-sm text-on-error-container">Weak Topics</p>
          <p className="font-headline text-4xl font-bold mt-2 text-on-error-container">{weak.length}</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h3 className="font-headline text-lg text-primary mb-6">Topic Mastery</h3>
        <div className="space-y-4">
          {(data?.topics || []).map((t) => (
            <div key={t.topic}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-on-surface flex items-center gap-2">
                  {t.weak && <Icon name="warning" className="text-error text-[18px]" />}
                  {t.topic}
                </span>
                <span className={t.weak ? "text-error font-bold" : "text-secondary font-bold"}>
                  {t.accuracy.toFixed(0)}% ({t.correct}/{t.total})
                </span>
              </div>
              <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${t.weak ? "bg-error" : "bg-secondary"}`}
                  style={{ width: `${t.accuracy}%` }} />
              </div>
            </div>
          ))}
          {(data?.topics?.length ?? 0) === 0 && (
            <p className="text-on-surface-variant">No attempt data yet. Analytics appear once students submit exams.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
