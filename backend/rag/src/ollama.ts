const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
const LLM_MODEL = process.env.LLM_MODEL || "gemma3:1b";

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
  temperature?: number;
  numPredict?: number;   // cap output tokens (faster when smaller)
}

export async function chat(prompt: string, opts: ChatOpts = {}): Promise<string> {
  const options: Record<string, unknown> = { temperature: opts.temperature ?? 0.3 };
  if (opts.numPredict) options.num_predict = opts.numPredict;

  const body: Record<string, unknown> = {
    model: LLM_MODEL,
    prompt,
    stream: false,
    options,
  };
  if (opts.json) body.format = "json";

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
