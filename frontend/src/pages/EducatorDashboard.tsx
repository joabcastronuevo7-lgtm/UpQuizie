import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout, { Icon } from "../components/Layout";
import { api, Subject } from "../api";

interface DistRow {
  type: string;
  difficulty: string;
  count: number;
  points: number;
}

const QUESTION_TYPES = ["mcq", "true_false", "fill_blank", "essay", "matching"];

export default function EducatorDashboard() {
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get<Subject[]>("/subjects"),
  });

  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [dist, setDist] = useState<DistRow[]>([
    { type: "mcq", difficulty: "medium", count: 3, points: 5 },
  ]);
  const [msg, setMsg] = useState("");

  const sid = subjectId || subjects[0]?.id || "";

  const generate = useMutation({
    mutationFn: () =>
      api.post<{ generated: number }>(`/subjects/${sid}/generate`, { topic, distribution: dist }),
    onSuccess: (r) =>
      setMsg(`Generated ${r.generated} question(s). Review them on the Review Questions page.`),
    onError: (e: any) => setMsg(`Error: ${e.message}`),
  });

  function updateRow(i: number, patch: Partial<DistRow>) {
    setDist((d) => d.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const total = dist.reduce((s, r) => s + (Number(r.count) || 0), 0);

  return (
    <Layout title="Generate Questions">
      <div className="max-w-3xl">
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-headline text-2xl text-primary">RAG Question Generation</h3>
              <p className="text-on-surface-variant">
                Questions are grounded in the selected subject's uploaded materials.
              </p>
            </div>
            <div className="bg-tertiary-container text-tertiary-fixed px-4 py-2 rounded-lg flex items-center gap-2">
              <Icon name="auto_awesome" />
              <span className="text-sm font-semibold">gemma3:1b</span>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-on-surface">Subject (source material)</label>
              <select
                value={sid}
                onChange={(e) => setSubjectId(e.target.value)}
                className="mt-1.5 w-full border border-outline-variant rounded-lg px-3 py-2.5 bg-white outline-none focus:border-secondary"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-on-surface">Topic / focus (optional)</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Backpropagation"
                className="mt-1.5 w-full border border-outline-variant rounded-lg px-3 py-2.5 outline-none focus:border-secondary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-on-surface">Question Distribution</label>
                <span className="text-xs font-bold uppercase text-outline">Total: {total}</span>
              </div>
              <div className="space-y-3">
                {dist.map((row, i) => (
                  <div key={i} className="flex items-end gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                    <Mini label="Type">
                      <select value={row.type} onChange={(e) => updateRow(i, { type: e.target.value })}
                        className="w-full bg-white border border-outline-variant rounded px-2 py-1.5 text-sm">
                        {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Mini>
                    <Mini label="Difficulty">
                      <select value={row.difficulty} onChange={(e) => updateRow(i, { difficulty: e.target.value })}
                        className="w-full bg-white border border-outline-variant rounded px-2 py-1.5 text-sm">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </Mini>
                    <Mini label="Count">
                      <input type="number" min={1} value={row.count}
                        onChange={(e) => updateRow(i, { count: Number(e.target.value) })}
                        className="w-16 bg-white border border-outline-variant rounded px-2 py-1.5 text-sm" />
                    </Mini>
                    <Mini label="Pts">
                      <input type="number" min={1} value={row.points}
                        onChange={(e) => updateRow(i, { points: Number(e.target.value) })}
                        className="w-16 bg-white border border-outline-variant rounded px-2 py-1.5 text-sm" />
                    </Mini>
                    <button onClick={() => setDist((d) => d.filter((_, idx) => idx !== i))}
                      className="mb-1.5 text-outline hover:text-error">
                      <Icon name="delete" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setDist((d) => [...d, { type: "true_false", difficulty: "easy", count: 2, points: 3 }])}
                className="mt-3 w-full py-2 border border-dashed border-outline-variant rounded-lg text-secondary text-sm flex items-center justify-center gap-2 hover:bg-surface-container-low"
              >
                <Icon name="add_circle" className="text-[18px]" /> Add question type
              </button>
            </div>

            <div className="pt-4 border-t border-outline-variant flex items-center justify-between">
              <Link to="/review" className="text-secondary text-sm font-semibold hover:underline">
                Go to Review Questions →
              </Link>
              <button
                onClick={() => { setMsg(""); generate.mutate(); }}
                disabled={generate.isPending || !sid}
                className="px-8 py-3 bg-secondary text-on-secondary rounded-lg font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                <Icon name={generate.isPending ? "sync" : "generating_tokens"} className={generate.isPending ? "animate-spin" : ""} />
                {generate.isPending ? "Generating…" : "Generate Questions"}
              </button>
            </div>

            {msg && <p className="text-sm text-on-surface-variant">{msg}</p>}
          </div>
        </section>
      </div>
    </Layout>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <span className="text-[10px] text-outline uppercase font-bold block mb-1">{label}</span>
      {children}
    </div>
  );
}
