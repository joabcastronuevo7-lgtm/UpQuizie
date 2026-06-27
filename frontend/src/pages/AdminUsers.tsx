import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../api";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
}

const roleBadge: Record<string, string> = {
  admin: "bg-tertiary-fixed text-on-tertiary-container",
  educator: "bg-secondary-fixed text-on-secondary-container",
  student: "bg-primary-fixed text-on-primary-container",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    api.get<AdminUser[]>("/admin/users").then(setUsers).catch(() => {});
  }, []);

  return (
    <Layout title="Manage Users">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant text-sm text-on-surface-variant">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-container-low">
                <td className="px-6 py-4 font-semibold text-primary">{u.full_name}</td>
                <td className="px-6 py-4 text-on-surface">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadge[u.role] || ""}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-container text-on-secondary-container capitalize">
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-6 text-on-surface-variant">No users.</p>}
      </div>
    </Layout>
  );
}
