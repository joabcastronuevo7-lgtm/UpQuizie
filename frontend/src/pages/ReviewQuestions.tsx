import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout, { Icon } from "../components/Layout";
import { api, Subject, Question } from "../api";

export default function ReviewQuestions() {
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [examTitle, setExamTitle] = useState("AI-Generated Exam");
  const [msg, setMsg] = useState("");

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get<Subject[]>("/subjects"),
  });
  const sid = subjectId || subjects[0]?.id || "";

  const { data: pending = [] } = useQuery({
    queryKey: ["generated", sid],
    queryFn: () => api.get<Question[]>(`/subjects/${sid}/generated?status=pending`),
    enabled: !!sid,
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/generated/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["generated", sid] }),
  });

  const createExam = useMutation({
    mutationFn: (ids: string[]) =>
      api.post<{ id: string; questions_added: number }>("/exams", {
        subject_id: sid,
        title: examTitle,
        question_ids: ids,
      }),
    onSuccess: (r) => {
      setMsg(`Created exam with ${r.questions_added} question(s). Publish it from the Exams page.`);
      setSelected({});
      qc.invalidateQueries({ queryKey: ["generated", sid] });
      qc.invalidateQueries({ queryKey: ["exams"] });
    },
  });

  const chosen = Object.keys(selected).filter((k) => selected[k]);

  return (
    <Layout title="Review Questions">
      <div className="flex items-center justify-between mb-6">
        <p className="text-on-surface-variant">Approve AI-generated questions, then build an exam from them.</p>
        <select value={sid} onChange={(e) => setSubjectId(e.target.value)}
          className="border border-outline-variant rounded-lg px-3 py-2 bg-white">
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
      </div>

      {chosen.length > 0 && (
        <div className="bg-secondary-container/40 border border-secondary rounded-xl p-4 mb-6 flex items-center gap-4">
          <input value={examTitle} onChange={(e) => setExamTitle(e.target.value)}
            className="flex-1 border border-outline-variant rounded-lg px-3 py-2 bg-white" />
          <button onClick={() => createExam.mutate(chosen)} disabled={createExam.isPending}
            className="px-6 py-2 bg-primary text-on-primary rounded-lg font-semibold whitespace-nowrap disabled:opacity-60">
            Create exam from {chosen.length} selected
          </button>
        </div>
      )}
      {msg && <p className="text-sm text-secondary mb-4">{msg}</p>}

      <div className="space-y-4">
        {pending.map((q) => (
          <div key={q.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <label className="flex items-start gap-3 flex-1 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={!!selected[q.id]}
                  onChange={(e) => setSelected((s) => ({ ...s, [q.id]: e.target.checked }))} />
                <div>
                  <div className="flex gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-xs">{q.type}</span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs">
                      {q.difficulty} • {q.points} pts
                    </span>
                    {q.topic && <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-container text-xs">{q.topic}</span>}
                  </div>
                  <p className="font-medium text-on-surface">{q.prompt}</p>
                  {Array.isArray(q.options) && (
                    <ul className="mt-2 text-sm text-on-surface-variant list-disc pl-5">
                      {q.options.map((o: string, k: number) => <li key={k}>{o}</li>)}
                    </ul>
                  )}
                  {q.source_ref && (
                    <p className="mt-2 text-xs italic text-on-surface-variant border-l-2 border-secondary pl-2">
                      Source: {q.source_ref}
                    </p>
                  )}
                </div>
              </label>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => decide.mutate({ id: q.id, status: "approved" })}
                  className="p-2 text-secondary hover:bg-secondary-container rounded" title="Approve">
                  <Icon name="check_circle" />
                </button>
                <button onClick={() => decide.mutate({ id: q.id, status: "rejected" })}
                  className="p-2 text-error hover:bg-error-container rounded" title="Reject">
                  <Icon name="cancel" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {pending.length === 0 && (
          <p className="text-on-surface-variant">No pending questions. Generate some on the Generate page.</p>
        )}
      </div>
    </Layout>
  );
}
