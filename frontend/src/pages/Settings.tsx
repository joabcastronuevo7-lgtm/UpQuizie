import { useEffect, useRef, useState } from "react";
import Layout, { Icon } from "../components/Layout";
import { useAuth } from "../auth";
import { useAuthStore } from "../store";
import { api, ApiError, User } from "../api";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-primary" : "bg-surface-container-highest border border-outline-variant"}`}>
      <span className={`inline-block rounded-full bg-white shadow transition-transform ${
        on ? "translate-x-[23px]" : "translate-x-[3px]"}`}
        style={{ width: 18, height: 18 }} />
    </button>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const [prefs, setPrefs] = useState({ examReminders: true, resultNotifs: true, platformUpdates: false });
  const set = (k: keyof typeof prefs) => (v: boolean) => setPrefs((p) => ({ ...p, [k]: v }));

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [identifier, setIdentifier] = useState(user?.identifier ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Re-seed the form once the session bootstrap (/me) finishes.
  useEffect(() => {
    setFullName(user?.full_name ?? "");
    setEmail(user?.email ?? "");
    setIdentifier(user?.identifier ?? "");
  }, [user?.full_name, user?.email, user?.identifier]);

  const dirty = user != null && (
    fullName.trim() !== user.full_name ||
    email.trim().toLowerCase() !== user.email ||
    identifier.trim() !== (user.identifier ?? "")
  );

  const saveProfile = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api.patch<User>("/me", {
        full_name: fullName.trim(),
        email: email.trim(),
        identifier: identifier.trim(),
      });
      setUser(updated);
      setMsg({ kind: "ok", text: "Profile updated." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as ApiError).message || "Could not save profile." });
    } finally {
      setSaving(false);
    }
  };

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const savePassword = async () => {
    setPwSaving(true);
    setPwMsg(null);
    try {
      await api.post("/me/password", { current_password: curPw, new_password: newPw });
      setCurPw(""); setNewPw(""); setConfirmPw("");
      setPwMsg({ kind: "ok", text: "Password changed." });
    } catch (e) {
      setPwMsg({ kind: "error", text: (e as ApiError).message || "Could not change password." });
    } finally {
      setPwSaving(false);
    }
  };

  const pickAvatar = () => fileInput.current?.click();

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    setMsg(null);
    try {
      const res = await api.upload<{ avatar_url: string }>("/me/avatar", file);
      if (user) setUser({ ...user, avatar_url: res.avatar_url });
      setMsg({ kind: "ok", text: "Profile picture updated." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as ApiError).message || "Could not upload picture." });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Layout title="Settings">
      <p className="text-on-surface-variant mb-6">Manage your academic profile and application preferences.</p>

      {/* Personal info */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-6">
        <h3 className="font-headline text-lg text-primary mb-6 flex items-center gap-2"><Icon name="person" /> Personal Information</h3>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <button onClick={pickAvatar} disabled={uploading} title="Change profile picture"
              className="relative w-24 h-24 rounded-xl overflow-hidden group disabled:opacity-60">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full bg-primary-container text-on-primary flex items-center justify-center text-3xl font-bold">
                  {user?.full_name?.[0] || "U"}
                </span>
              )}
              <span className="absolute inset-0 bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-on-primary">
                <Icon name="photo_camera" />
              </span>
            </button>
            <button onClick={pickAvatar} disabled={uploading}
              className="text-xs font-semibold text-secondary disabled:opacity-60">
              {uploading ? "Uploading…" : "Change photo"}
            </button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-on-surface-variant uppercase">Full Name</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full px-4 py-2.5 bg-white border border-outline-variant rounded-lg text-on-surface outline-none focus:border-secondary" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-on-surface-variant uppercase">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-4 py-2.5 bg-white border border-outline-variant rounded-lg text-on-surface outline-none focus:border-secondary" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-on-surface-variant uppercase">
                {user?.role === "student" ? "Student ID" : "ID Number"}
              </span>
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 w-full px-4 py-2.5 bg-white border border-outline-variant rounded-lg text-on-surface outline-none focus:border-secondary" />
            </label>
            <Field label="Role" value={user?.role || ""} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <p className={`text-sm ${msg?.kind === "error" ? "text-error" : "text-secondary"}`}>{msg?.text || ""}</p>
          <button onClick={saveProfile} disabled={saving || !dirty || !fullName.trim() || !email.trim()}
            className="px-6 py-2 bg-primary text-on-primary rounded-lg font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account security */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="font-headline text-lg text-primary mb-4 flex items-center gap-2"><Icon name="shield" /> Account Security</h3>
          <p className="text-sm text-on-surface-variant mb-4">Change your password. It must be at least 6 characters.</p>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-on-surface-variant uppercase">Current Password</span>
              <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password"
                className="mt-1 w-full px-4 py-2.5 bg-white border border-outline-variant rounded-lg text-on-surface outline-none focus:border-secondary" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-on-surface-variant uppercase">New Password</span>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password"
                className="mt-1 w-full px-4 py-2.5 bg-white border border-outline-variant rounded-lg text-on-surface outline-none focus:border-secondary" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-on-surface-variant uppercase">Confirm New Password</span>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password"
                className="mt-1 w-full px-4 py-2.5 bg-white border border-outline-variant rounded-lg text-on-surface outline-none focus:border-secondary" />
            </label>
            {confirmPw && newPw !== confirmPw && (
              <p className="text-sm text-error">Passwords do not match.</p>
            )}
            {pwMsg && <p className={`text-sm ${pwMsg.kind === "error" ? "text-error" : "text-secondary"}`}>{pwMsg.text}</p>}
            <div className="flex justify-end">
              <button onClick={savePassword}
                disabled={pwSaving || !curPw || newPw.length < 6 || newPw !== confirmPw}
                className="px-6 py-2 bg-primary text-on-primary rounded-lg font-semibold disabled:opacity-50">
                {pwSaving ? "Changing…" : "Change password"}
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 self-start">
          <h3 className="font-headline text-lg text-primary mb-4 flex items-center gap-2"><Icon name="notifications" /> Notifications</h3>
          <div className="space-y-2">
            <Pref label="Exam Reminders" description="Get reminded before an exam is due" on={prefs.examReminders} onChange={set("examReminders")} />
            <Pref label="Result Notifications" description="Know when your scores are released" on={prefs.resultNotifs} onChange={set("resultNotifs")} />
            <Pref label="Platform Updates" description="News about new features" on={prefs.platformUpdates} onChange={set("platformUpdates")} />
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-xs font-semibold text-on-surface-variant uppercase">{label}</label>
      <div className="mt-1 w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface capitalize">{value || "—"}</div>
    </div>
  );
}

function Pref({ label, description, on, onChange }: { label: string; description: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-surface-container-low rounded-lg">
      <div>
        <p className="font-semibold text-primary text-sm">{label}</p>
        <p className="text-xs text-on-surface-variant">{description}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}
