import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout, { Icon } from "../components/Layout";
import { api, Exam, Question } from "../api";

export default function TakeExam() {
  const { id } = useParams();
  const nav = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState("");
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<Exam>(`/exams/${id}`).then(setExam);
    api.get<Question[]>(`/exams/${id}/questions`).then(setQuestions);
    api.post<{ attempt_id: string }>(`/exams/${id}/attempts`).then((r) => setAttemptId(r.attempt_id));
  }, [id]);

  function setResp(qid: string, value: any) {
    setResponses((r) => ({ ...r, [qid]: value }));
  }

  async function submit() {
    setBusy(true);
    try {
      const answers = questions.map((q) => ({
        question_id: q.id,
        response: responses[q.id] ?? {},
      }));
      await api.post(`/attempts/${attemptId}/submit`, { answers });
      nav(`/attempts/${attemptId}/results`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title={exam?.title || "Exam"}>
      <div className="max-w-3xl mx-auto space-y-6">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3 text-sm text-on-surface-variant">
              <span className="font-semibold text-secondary">Question {i + 1}</span>•
              <span>{q.points} pts</span>•<span className="capitalize">{q.type}</span>
            </div>
            <p className="font-medium text-on-surface mb-4">{q.prompt}</p>

            {q.type === "mcq" && Array.isArray(q.options) && (
              <div className="space-y-2">
                {q.options.map((opt: string, idx: number) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                      responses[q.id]?.index === idx ? "border-secondary bg-secondary-container/20" : "border-outline-variant"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={responses[q.id]?.index === idx}
                      onChange={() => setResp(q.id, { index: idx })}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.type === "true_false" && (
              <div className="flex gap-3">
                {[true, false].map((v) => (
                  <label
                    key={String(v)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer ${
                      responses[q.id]?.value === v ? "border-secondary bg-secondary-container/20" : "border-outline-variant"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={responses[q.id]?.value === v}
                      onChange={() => setResp(q.id, { value: v })}
                    />
                    {v ? "True" : "False"}
                  </label>
                ))}
              </div>
            )}

            {(q.type === "fill_blank" || q.type === "short_answer" || q.type === "essay") && (
              <textarea
                rows={q.type === "essay" ? 5 : 2}
                value={responses[q.id]?.text || ""}
                onChange={(e) => setResp(q.id, { text: e.target.value })}
                placeholder="Your answer…"
                className="w-full border border-outline-variant rounded-lg p-3 outline-none focus:border-secondary"
              />
            )}
          </div>
        ))}

        {questions.length === 0 && (
          <p className="text-on-surface-variant">This exam has no questions yet.</p>
        )}

        {questions.length > 0 && (
          <button
            onClick={submit}
            disabled={busy || !attemptId}
            className="w-full bg-primary text-on-primary py-3.5 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Submit Exam"} <Icon name="check" />
          </button>
        )}
      </div>
    </Layout>
  );
}
