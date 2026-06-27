import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout, { Icon } from "../components/Layout";
import { api, Exam } from "../api";
import { useAuth } from "../auth";

export default function ExamsList() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    api.get<Exam[]>("/exams").then(setExams).catch(() => {});
  }, []);

  return (
    <Layout title="Exams">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((e) => (
          <div key={e.id} className="bg-white rounded-xl border border-outline-variant p-6 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span
                className={`px-3 py-1 rounded-full text-xs uppercase tracking-wider ${
                  e.status === "active"
                    ? "bg-secondary-container text-on-secondary-container"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {e.status}
              </span>
              <Icon name="timer" className="text-secondary" />
            </div>
            <h3 className="font-headline text-lg text-primary mb-1">{e.title}</h3>
            <p className="text-sm text-on-surface-variant mb-4">{e.subject}</p>
            <div className="space-y-2 mb-6 text-sm text-on-surface-variant">
              <div className="flex items-center gap-2"><Icon name="schedule" className="text-[18px]" /> {e.duration_min} minutes</div>
              <div className="flex items-center gap-2"><Icon name="grade" className="text-[18px]" /> {e.total_points} points</div>
            </div>
            {user?.role === "student" && e.status === "active" ? (
              <Link
                to={`/exams/${e.id}/take`}
                className="mt-auto w-full bg-secondary text-on-secondary py-3 rounded-lg font-semibold text-center flex items-center justify-center gap-2"
              >
                Take Exam <Icon name="arrow_forward" className="text-[20px]" />
              </Link>
            ) : (
              <div className="mt-auto text-sm text-on-surface-variant flex items-center gap-1">
                <Icon name="info" className="text-[18px]" /> {e.status === "active" ? "Available" : "Not available"}
              </div>
            )}
          </div>
        ))}
        {exams.length === 0 && <p className="text-on-surface-variant">No exams found.</p>}
      </div>
    </Layout>
  );
}
