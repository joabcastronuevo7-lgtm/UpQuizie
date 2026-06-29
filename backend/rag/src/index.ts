import express from "express";
import { embed, chat } from "./ollama.js";
import { insertChunks, search, getClient, deleteByDocument, deleteBySubject } from "./milvus.js";
import { extractText } from "./extract.js";
import { query, ensureSchema } from "./db.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = parseInt(process.env.PORT || "7000", 10);
const ARRAY_BATCH = parseInt(process.env.GEN_BATCH || "8", 10); // questions per LLM call

// ---------- helpers ----------

function chunkByWords(text: string, size = 500, overlap = 50): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= size) return [words.join(" ")];
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    chunks.push(words.slice(start, start + size).join(" "));
    start += size - overlap;
  }
  return chunks;
}

function extractJSON(s: string): any {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : s;
  const first = candidate.search(/[[{]/);
  if (first === -1) throw new Error("no JSON found");
  const sub = candidate.slice(first);
  for (let end = sub.length; end > 0; end--) {
    try {
      return JSON.parse(sub.slice(0, end));
    } catch {
      /* shrink */
    }
  }
  throw new Error("could not parse JSON");
}

// Normalize an LLM JSON response into an array of question objects.
function toQuestionArray(parsed: any): any[] {
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  if (parsed && Array.isArray(parsed.questions)) return parsed.questions.filter(Boolean);
  if (parsed && typeof parsed === "object" && parsed.prompt) return [parsed];
  return [];
}

function exampleFor(type: string, difficulty: string): string {
  switch (type) {
    case "mcq":
      return `{"type":"mcq","difficulty":"${difficulty}","topic":"Photosynthesis","prompt":"Which organelle carries out photosynthesis?","options":["Mitochondrion","Chloroplast","Nucleus","Ribosome"],"answer":{"correct_index":1}}`;
    case "true_false":
      return `{"type":"true_false","difficulty":"${difficulty}","topic":"Gravity","prompt":"Gravity accelerates all objects equally in a vacuum.","options":["True","False"],"answer":{"correct":true}}`;
    case "fill_blank":
      return `{"type":"fill_blank","difficulty":"${difficulty}","topic":"Cells","prompt":"The powerhouse of the cell is the _____.","options":null,"answer":{"accepted":["mitochondria","mitochondrion"]}}`;
    case "matching":
      return `{"type":"matching","difficulty":"${difficulty}","topic":"Capitals","prompt":"Match each country to its capital.","options":{"left":["France","Japan"],"right":["Tokyo","Paris"]},"answer":{"pairs":[[0,1],[1,0]]}}`;
    case "essay":
      return `{"type":"essay","difficulty":"${difficulty}","topic":"Climate","prompt":"Explain the greenhouse effect.","options":null,"answer":{"rubric":"Mentions greenhouse gases, trapping heat, warming."}}`;
    default:
      return `{"type":"${type}","difficulty":"${difficulty}","topic":"...","prompt":"...","options":null,"answer":{}}`;
  }
}

function templateQuestion(type: string, idx: number, topic: string): { prompt: string; options: any; answer: any } {
  const t = topic && topic.trim() ? topic : "this subject";
  switch (type) {
    case "mcq":
      return { prompt: `[DRAFT ${idx} — please edit] Multiple-choice question about ${t}.`, options: ["Option A", "Option B", "Option C", "Option D"], answer: { correct_index: 0 } };
    case "true_false":
      return { prompt: `[DRAFT ${idx} — please edit] True or False statement about ${t}.`, options: ["True", "False"], answer: { correct: true } };
    case "fill_blank":
      return { prompt: `[DRAFT ${idx} — please edit] A key term in ${t} is _____.`, options: null, answer: { accepted: ["answer"] } };
    case "matching":
      return { prompt: `[DRAFT ${idx} — please edit] Match the terms about ${t}.`, options: { left: ["Term 1", "Term 2"], right: ["Definition 1", "Definition 2"] }, answer: { pairs: [[0, 0], [1, 1]] } };
    case "essay":
      return { prompt: `[DRAFT ${idx} — please edit] Essay question about ${t}.`, options: null, answer: { rubric: "Edit this rubric." } };
    default:
      return { prompt: `[DRAFT ${idx} — please edit] Question about ${t}.`, options: null, answer: {} };
  }
}

interface DistItem { type: string; difficulty: string; count: number; points: number }

async function insertQuestion(
  jobId: string, subjectId: string, item: DistItem,
  prompt: string, options: any, answer: any, topic: string, sourceRef: string
) {
  await query(
    `INSERT INTO generated_questions
       (subject_id, type, difficulty, points, prompt, options, answer, topic, source_ref, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
    [
      subjectId || null, item.type, item.difficulty, item.points || 1,
      prompt,
      options != null ? JSON.stringify(options) : null,
      answer != null ? JSON.stringify(answer) : null,
      topic || "", sourceRef,
    ]
  );
  await query(`UPDATE generation_jobs SET generated = generated + 1 WHERE id=$1`, [jobId]);
}

// Background generation: produces exactly `count` per item. Asks the model for a
// BATCH (array) of questions per call for speed, then tops up / guarantees count.
async function runGeneration(
  jobId: string, subjectId: string, topic: string, dist: DistItem[]
): Promise<void> {
  const seen = new Set<string>();

  let pool: string[] = [];
  let sourceRef = "";
  try {
    const queryText = topic && topic.trim() ? topic : "key concepts and definitions";
    const qvec = await embed(queryText);
    const hits = await search(subjectId || "", qvec, 12);
    pool = hits.map((h) => h.text);
    if (hits[0]) sourceRef = hits[0].text.slice(0, 220) + "…";
  } catch (e) {
    console.warn("retrieval failed; generating without grounding", e);
  }

  const contextFor = (n: number) => {
    if (!pool.length) return "(no source material available; use general knowledge of the subject)";
    const start = (n - 1) % pool.length;
    return [pool[start], pool[(start + 1) % pool.length]].filter(Boolean).join("\n---\n");
  };

  // One call -> up to `want` questions as a JSON array.
  const genBatch = async (item: DistItem, want: number, n: number): Promise<any[]> => {
    const prompt = `You are an exam author. Write ${want} DISTINCT ${item.difficulty} ${item.type} questions${topic ? ` about "${topic}"` : ""}, based on the source material below.

Return ONLY a JSON array of exactly ${want} objects. Each object must have this shape (format example, vary the content):
${exampleFor(item.type, item.difficulty)}

Rules:
- Each question must be answerable from the source material.
- All ${want} questions must be different from each other.
- Output a valid JSON array only. No explanation.

Source material:
"""
${contextFor(n)}
"""`;
    try {
      const parsed = extractJSON(await chat(prompt, { json: true, temperature: 0.7, numPredict: Math.min(3072, want * 200 + 200) }));
      return toQuestionArray(parsed);
    } catch (e) {
      console.error(`batch gen failed (${item.type}/${item.difficulty})`, e);
      return [];
    }
  };

  const tryInsert = async (item: DistItem, q: any): Promise<boolean> => {
    if (!q) return false;
    const norm = String(q.prompt || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!norm || seen.has(norm)) return false;
    seen.add(norm);
    await insertQuestion(jobId, subjectId, item, q.prompt, q.options ?? null, q.answer ?? {}, q.topic || topic || "", sourceRef);
    return true;
  };

  for (const item of dist) {
    const target = item.count || 1;
    let produced = 0;
    let call = 0;
    const maxCalls = Math.ceil(target / ARRAY_BATCH) * 3 + 3;

    // Phase 1 — batched array generation.
    while (produced < target && call < maxCalls) {
      call++;
      const want = Math.min(ARRAY_BATCH, target - produced);
      const arr = await genBatch(item, want, call);
      for (const q of arr) {
        if (produced >= target) break;
        if (await tryInsert(item, q)) produced++;
      }
    }

    // Phase 2 — guarantee exact count with labeled drafts for any shortfall.
    while (produced < target) {
      const t = templateQuestion(item.type, produced + 1, topic);
      await insertQuestion(jobId, subjectId, item, t.prompt, t.options, t.answer, topic || "", "Placeholder — edit before use");
      produced++;
    }

    console.log(`item ${item.type}/${item.difficulty}: produced ${produced}/${target} in ${call} call(s)`);
  }

  await query(`UPDATE generation_jobs SET status='done', finished_at=now() WHERE id=$1`, [jobId]);
}

// ---------- routes ----------

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/process", async (req, res) => {
  const { document_id, subject_id, file_path } = req.body || {};
  if (!document_id || !file_path) {
    return res.status(400).json({ error: "document_id and file_path required" });
  }
  try {
    const text = await extractText(file_path);
    const chunks = chunkByWords(text, 500, 50);
    if (chunks.length === 0) return res.status(422).json({ error: "no extractable text" });

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embed(chunks[i]);
      vectors.push({
        document_id, subject_id: subject_id || "", chunk_index: i,
        text: chunks[i].slice(0, 8000), embedding,
      });
    }
    const milvusIds = await insertChunks(vectors);
    for (let i = 0; i < chunks.length; i++) {
      await query(
        `INSERT INTO document_chunks (document_id, subject_id, chunk_index, content, milvus_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [document_id, subject_id || null, i, chunks[i], milvusIds[i] ? Number(milvusIds[i]) : null]
      );
    }
    res.json({ chunks: chunks.length });
  } catch (e: any) {
    console.error("process error", e);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/document/:id", async (req, res) => {
  try { await deleteByDocument(req.params.id); res.json({ ok: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/subject/:id", async (req, res) => {
  try { await deleteBySubject(req.params.id); res.json({ ok: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/generate", async (req, res) => {
  const { subject_id, topic, distribution } = req.body || {};
  const dist: DistItem[] =
    Array.isArray(distribution) && distribution.length
      ? distribution
      : [{ type: "mcq", difficulty: "medium", count: 3, points: 5 }];
  const requested = dist.reduce((s, i) => s + (Number(i.count) || 1), 0);

  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO generation_jobs (subject_id, status, requested) VALUES ($1,'running',$2) RETURNING id`,
      [subject_id || null, requested]
    );
    const jobId = rows[0].id;
    res.status(202).json({ job_id: jobId, requested });

    runGeneration(jobId, subject_id || "", topic || "", dist).catch(async (e) => {
      console.error("generation job failed", e);
      await query(
        `UPDATE generation_jobs SET status='error', error=$2, finished_at=now() WHERE id=$1`,
        [jobId, String(e?.message || e)]
      );
    });
  } catch (e: any) {
    console.error("generate error", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/job/:id", async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, status, requested, generated, error FROM generation_jobs WHERE id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "job not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/grade", async (req, res) => {
  const { model_answer, student_answer, max_points } = req.body || {};
  try {
    const [a, b] = await Promise.all([embed(model_answer || ""), embed(student_answer || "")]);
    const sim = cosine(a, b);
    const points = Math.round(Math.max(0, sim) * (max_points || 10));
    res.json({ points, similarity: sim });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

app.listen(PORT, async () => {
  console.log(`RAG service listening on :${PORT} (batch ${ARRAY_BATCH})`);
  ensureSchema().catch((e) => console.warn("ensureSchema deferred:", e.message));
  getClient().catch((e) => console.warn("milvus warmup deferred:", e.message));
});
