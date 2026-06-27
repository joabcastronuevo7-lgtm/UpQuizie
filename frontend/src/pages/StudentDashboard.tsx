import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout, { Icon } from "../components/Layout";
import { api, Exam, Subject } from "../api";
import { useAuth } from "../auth";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    api.get<Subject[]>("/subjects").then(setSubjects).catch(() => {});
    api.get<Exam[]>("/exams").then(setExams).catch(() => {});
  }, []);

  const active = exams.filter((e) => e.status === "active");

  return (
    <Layout title="Dashboard">
      <header className="mb-8">
        <h1 className="font-headline text-3xl text-primary mb-2">
          Good day, {user?.full_name?.split(" ")[0]}.
        </h1>
        <p className="text-on-surface-variant flex items-center gap-2">
          <Icon name="calendar_today" className="text-secondary" />
          You have <span className="font-bold text-primary">{active.length}</span> active exam
          {active.length === 1 ? "" : "s"} available.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Stat icon="library_books" label="Enrolled Subjects" value={subjects.length} />
        <Stat icon="assignment" label="Active Exams" value={active.length} />
        <Stat icon="monitoring" label="Total Exams" value={exams.length} />
      </div>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
          <h3 className="font-headline text-xl text-primary">Exam Schedule</h3>
        </div>
        <div className="divide-y divide-outline-variant">
          {exams.length === 0 && (
            <div className="p-6 text-on-surface-variant">No exams yet.</div>
          )}
          {exams.map((e) => (
            <div key={e.id} className="p-6 flex items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-container text-on-primary-container rounded-lg">
                  <Icon name="quiz" />
                </div>
                <div>
                  <h4 className="font-headline text-lg text-primary">{e.title}</h4>
                  <p className="text-sm text-on-surface-variant">
                    {e.subject} • {e.duration_min} mins • {e.total_points} pts
                  </p>
                </div>
              </div>
              {e.status === "active" ? (
                <Link
                  to={`/exams/${e.id}/take`}
                  className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-semibold"
                >
                  Start Exam
                </Link>
              ) : (
                <span className="flex items-center gap-1 text-on-surface-variant text-sm">
                  <Icon name="lock" className="text-[18px]" /> {e.status}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-secondary-container flex items-center justify-center text-on-secondary-container">
        <Icon name={icon} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-on-surface-variant">{label}</p>
        <p className="font-headline text-2xl font-bold text-primary">{value}</p>
      </div>
    </div>
  );
}
