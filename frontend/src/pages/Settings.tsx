import { useState } from "react";
import Layout, { Icon } from "../components/Layout";
import { useAuth } from "../auth";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full transition-colors relative ${on ? "bg-secondary" : "bg-surface-container-high"}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState({ examReminders: true, resultNotifs: true, platformUpdates: false, profileVisible: false });
  const set = (k: keyof typeof prefs) => (v: boolean) => setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <Layout title="Settings">
      <p className="text-on-surface-variant mb-6">Manage your academic profile and application preferences.</p>

      {/* Personal info */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-6">
        <h3 className="font-headline text-lg text-primary mb-6 flex items-center gap-2"><Icon name="person" /> Personal Information</h3>
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-xl bg-primary-container text-on-primary flex items-center justify-center text-3xl font-bold">
            {user?.full_name?.[0] || "U"}
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name" value={user?.full_name || ""} />
            <Field label="Role" value={user?.role || ""} />
            <Field label="Email" value={user?.email || ""} full />
          </div>
        </div>
        <p className="text-xs text-on-surface-variant mt-4">Profile editing will be available in a future update.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account security */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="font-headline text-lg text-primary mb-4 flex items-center gap-2"><Icon name="shield" /> Account Security</h3>
          <div className="p-4 bg-surface-container-low rounded-lg flex justify-between items-center mb-3">
            <div><p className="font-semibold text-primary">Password</p><p className="text-sm text-on-surface-variant">Secured with bcrypt</p></div>
            <span className="text-on-surface-variant text-sm">Managed by admin</span>
          </div>
          <div className="p-4 bg-surface-container-low rounded-lg flex justify-between items-center">
            <div><p className="font-semibold text-primary">Two-Factor Authentication</p><p className="text-sm text-on-surface-variant">Coming soon</p></div>
            <Toggle on={false} onChange={() => {}} />
          </div>
        </div>

        {/* Notifications + privacy */}
        <div className="space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h3 className="font-headline text-lg text-primary mb-4 flex items-center gap-2"><Icon name="notifications" /> Notifications</h3>
            <Pref label="Exam Reminders" on={prefs.examReminders} onChange={set("examReminders")} />
            <Pref label="Result Notifications" on={prefs.resultNotifs} onChange={set("resultNotifs")} />
            <Pref label="Platform Updates" on={prefs.platformUpdates} onChange={set("platformUpdates")} />
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h3 className="font-headline text-lg text-primary mb-4 flex items-center gap-2"><Icon name="visibility" /> Privacy</h3>
            <Pref label="Make profile visible to educators" on={prefs.profileVisible} onChange={set("profileVisible")} />
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

function Pref({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-on-surface">{label}</span>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}
