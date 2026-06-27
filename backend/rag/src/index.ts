import express from "express";
import { embed, chat } from "./ollama.js";
import { insertChunks, search, getClient, deleteByDocument } from "./milvus.js";
import { extractText } from "./extract.js";
import { query } from "./db.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = parseInt(process.env.PORT || "7000", 10);

// ---------- helpers ----------

// 500-word chunks with 50-word overlap (per thesis Chapter IV).
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

const answerSchema = (type: string): string => {
  switch (type) {
    case "mcq":
      return `"options": ["A","B","C","D"], "answer": {"correct_index": 0}`;
    case "true_false":
      return `"options": ["True","False"], "answer": {"correct": true}`;
    case "fill_blank":
      return `"options": null, "answer": {"accepted": ["the term"]}`;
    case "matching":
      return `"options": {"left": ["term1"], "right": ["def1"]}, "answer": {"pairs": [[0,0]]}`;
    case "essay":
      return `"options": null, "answer": {"rubric": "key points expected"}`;
    default:
      return `"options": null, "answer": {}`;
  }
};

// ---------- routes ----------

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Process an uploaded document: extract -> chunk -> embed -> store (Milvus + PG).
app.post("/process", async (req, res) => {
  const { document_id, subject_id, file_path } = req.body || {};
  if (!document_id || !file_path) {
    return res.status(400).json({ error: "document_id and file_path required" });
  }
  try {
    const text = await extractText(file_path);
    const chunks = chunkByWords(text, 500, 50);
    if (chunks.length === 0) {
      return res.status(422).json({ error: "no extractable text" });
    }

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embed(chunks[i]);
      vectors.push({
        document_id,
        subject_id: subject_id || "",
        chunk_index: i,
        text: chunks[i].slice(0, 8000),
        embedding,
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

// Remove a document's vectors from Milvus.
app.delete("/document/:id", async (req, res) => {
  try {
    await deleteByDocument(req.params.id);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("delete document error", e);
    res.status(500).json({ error: e.message });
  }
});

// Generate grounded questions and stage them in generated_questions for review.
app.post("/generate", async (req, res) => {
  const { subject_id, topic, distribution } = req.body || {};
  const dist: Array<{ type: string; difficulty: string; count: number; points: number }> =
    Array.isArray(distribution) && distribution.length
      ? distribution
      : [{ type: "mcq", difficulty: "medium", count: 3, points: 5 }];

  try {
    const seen = new Set<string>();
    let generated = 0;

    for (const item of dist) {
      let context = "";
      let sourceRef = "";
      try {
        const queryText = topic && topic.trim() ? topic : `${item.type} ${item.difficulty} assessment`;
        const qvec = await embed(queryText);
        const hits = await search(subject_id || "", qvec, 4);
        context = hits.map((h) => h.text).join("\n---\n");
        if (hits[0]) sourceRef = hits[0].text.slice(0, 220) + "…";
      } catch (e) {
        console.warn("retrieval failed; generating without grounding", e);
      }

      for (let i = 0; i < (item.count || 1); i++) {
        const prompt = `You are an exam author. Using ONLY the source material below, write one ${item.difficulty} ${item.type} question${topic ? ` about "${topic}"` : ""}.
Respond with STRICT JSON and nothing else:
{"type":"${item.type}","difficulty":"${item.difficulty}","prompt":"...","topic":"...",${answerSchema(item.type)}}

Source material:
"""
${context || "(no source material available; use general knowledge of the subject)"}
"""`;

        try {
          const raw = await chat(prompt);
          const q = extractJSON(raw);
          const norm = String(q.prompt || "").toLowerCase().replace(/\s+/g, " ").trim();
          if (!norm || seen.has(norm)) continue;
          seen.add(norm);

          await query(
            `INSERT INTO generated_questions
               (subject_id, type, difficulty, points, prompt, options, answer, topic, source_ref, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
            [
              subject_id || null,
              item.type,
              item.difficulty,
              item.points || 1,
              q.prompt,
              q.options != null ? JSON.stringify(q.options) : null,
              q.answer != null ? JSON.stringify(q.answer) : null,
              q.topic || topic || "",
              sourceRef,
            ]
          );
          generated++;
        } catch (e) {
          console.error("generation failed for one item", e);
        }
      }
    }

    res.json({ generated });
  } catch (e: any) {
    console.error("generate error", e);
    res.status(500).json({ error: e.message });
  }
});

// AI-assisted essay/short-answer scoring via embedding similarity.
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
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

app.listen(PORT, () => {
  console.log(`RAG service listening on :${PORT}`);
  getClient().catch((e) => console.warn("milvus warmup deferred:", e.message));
});
