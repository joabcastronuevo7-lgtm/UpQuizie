// Cookie-based auth: the JWT lives in an HTTP-only cookie set by the API,
// so the browser sends it automatically with credentials: "include".

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`/api${path}`, { ...options, headers, credentials: "include" });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => request<T>(p, { method: "DELETE" }),
  upload: <T>(p: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<T>(p, { method: "POST", body: fd });
  },
};

// ---------- types ----------
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "student" | "educator" | "admin";
}
export interface Subject {
  id: string;
  code: string;
  name: string;
  department?: string;
  status: string;
  educator?: string;
  students: number;
  active_exams: number;
}
export interface Exam {
  id: string;
  title: string;
  duration_min: number;
  total_points: number;
  status: string;
  subject?: string;
  subject_id?: string;
}
export interface Question {
  id: string;
  type: string;
  difficulty: string;
  points: number;
  prompt: string;
  options: any;
  answer?: any;
  topic?: string;
  source_ref?: string;
  status?: string;
  position?: number;
}
export interface DocumentMeta {
  id: string;
  filename: string;
  file_type?: string;
  size_bytes: number;
  status: string;
  error?: string;
}
