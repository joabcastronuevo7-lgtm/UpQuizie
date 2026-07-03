import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Layout, { Icon } from "../components/Layout";
import { api, Exam } from "../api";

export default function ExamSessions() {
  const nav = useNavigate();
  const { data: exams = [] } = useQuery({ queryKey: ["exams"], queryFn: () => api.get<Exam[]>("/exams") });
  const published = exams.filter((e) => e.status === "published");

  return (
    <Layout title="Exam Sessions">
      <p className="text-on-surface-variant mb-6">Published exams currently available to students.</p>

      {published.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-4">
            <Icon name="live_tv" className="text-3xl" />
          </div>
          <h3 className="font-headline text-lg text-primary mb-1">No active sessions</h3>
          <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
            Publish an exam from the Exams page to make it available to enrolled students.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {published.map((e) => (
            <div key={e.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 bg-secondary rounded-full animate-pulse" />
                <span className="text-secondary font-bold text-xs uppercase tracking-widest">Live</span>
              </div>
              <h3 className="font-headline text-lg text-primary mb-1">{e.title}</h3>
              <p className="text-sm text-on-surface-variant mb-4">{e.subject}</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-surface-container-low p-3 rounded-lg">
                  <p className="text-xs text-on-surface-variant">Duration</p>
                  <p className="font-bold">{e.duration_min} min</p>
                </div>
                <div className="bg-surface-container-low p-3 rounded-lg">
                  <p className="text-xs text-on-surface-variant">Total Points</p>
                  <p className="font-bold">{e.total_points}</p>
                </div>
              </div>
              <button onClick={() => nav(`/exams/${e.id}/monitor`)}
                className="mt-auto w-full bg-primary text-on-primary py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                <Icon name="monitoring" className="text-[20px]" /> Monitor Students
              </button>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
