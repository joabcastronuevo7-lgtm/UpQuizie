import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout, { Icon } from "../components/Layout";
import { api, Subject } from "../api";
import { useAuth } from "../auth";

export default function Subjects() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", department: "", description: "" });

  const load = () => api.get<Subject[]>("/subjects").then(setSubjects).catch(() => {});
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/subjects", form);
    setForm({ code: "", name: "", department: "", description: "" });
    setShowForm(false);
    load();
  }

  const canCreate = user?.role === "educator" || user?.role === "admin";

  return (
    <Layout title="Subjects">
      <div className="flex justify-between items-center mb-6">
        <p className="text-on-surface-variant">Click a subject to manage its learning materials.</p>
        {canCreate && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="bg-secondary text-on-secondary px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2"
          >
            <Icon name="add_circle" /> New Subject
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-6 grid grid-cols-2 gap-4">
          {(["code", "name", "department", "description"] as const).map((k) => (
            <input
              key={k}
              placeholder={k[0].toUpperCase() + k.slice(1)}
              value={(form as any)[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="border border-outline-variant rounded-lg px-3 py-2.5 outline-none focus:border-secondary"
              required={k === "code" || k === "name"}
            />
          ))}
          <button type="submit" className="col-span-2 bg-primary text-on-primary py-2.5 rounded-lg font-semibold">
            Create
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {subjects.map((s) => (
          <div
            key={s.id}
            onClick={() => nav(`/subjects/${s.id}/materials`)}
            className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden cursor-pointer hover:shadow-lg hover:border-secondary transition-all"
          >
            <div className="h-24 bg-primary relative">
              <span className="absolute top-3 left-3 bg-primary-container text-on-primary-container px-2 py-1 rounded text-[10px] font-bold uppercase">
                {s.code}
              </span>
              <div className="absolute -bottom-5 left-6 w-11 h-11 bg-white shadow rounded-xl flex items-center justify-center text-primary">
                <Icon name="book" />
              </div>
            </div>
            <div className="pt-8 px-6 pb-6">
              <h3 className="font-headline text-lg text-primary mb-1">{s.name}</h3>
              <p className="text-sm text-on-surface-variant mb-4">{s.department || "—"}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-surface-container-low p-3 rounded-lg">
                  <p className="text-xs text-on-surface-variant">Students</p>
                  <p className="font-bold">{s.students}</p>
                </div>
                <div className="bg-surface-container-low p-3 rounded-lg">
                  <p className="text-xs text-on-surface-variant">Active Exams</p>
                  <p className="font-bold">{s.active_exams}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-secondary text-sm font-semibold border-t border-outline-variant pt-3">
                <span className="flex items-center gap-1">
                  <Icon name="folder_open" className="text-[18px]" /> Open Materials
                </span>
                <Icon name="arrow_forward" className="text-[18px]" />
              </div>
            </div>
          </div>
        ))}
        {subjects.length === 0 && <p className="text-on-surface-variant">No subjects yet.</p>}
      </div>
    </Layout>
  );
}
