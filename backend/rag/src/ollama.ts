const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
const LLM_MODEL = process.env.LLM_MODEL || "gemma3:1b";
const LLM_NUM_CTX = Math.max(1024, parseInt(process.env.LLM_NUM_CTX || "2048", 10));

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { embedding: number[] };
  return data.embedding;
}

interface ChatOpts {
  json?: boolean;        // force valid-JSON output (Ollama format: "json")
  schema?: Record<string, unknown>;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  numPredict?: number;   // cap output tokens (faster when smaller)
}

export async function chat(prompt: string, opts: ChatOpts = {}): Promise<string> {
  const options: Record<string, unknown> = { temperature: opts.temperature ?? 0.3, num_ctx: LLM_NUM_CTX };
  if (opts.topP != null) options.top_p = opts.topP;
  if (opts.topK != null) options.top_k = opts.topK;
  if (opts.repeatPenalty != null) options.repeat_penalty = opts.repeatPenalty;
  if (opts.numPredict) options.num_predict = opts.numPredict;

  const body: Record<string, unknown> = {
    model: LLM_MODEL,
    prompt,
    stream: false,
    options,
  };
  if (opts.schema) body.format = opts.schema;
  else if (opts.json) body.format = "json";

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`chat failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { response: string };
  return data.response;
}

export { EMBED_MODEL, LLM_MODEL };
