import { create } from "zustand";
import { User } from "./api";

interface AuthState {
  user: User | null;
  ready: boolean; // bootstrap (/me) completed
  setUser: (u: User | null) => void;
  setReady: (r: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
}));
