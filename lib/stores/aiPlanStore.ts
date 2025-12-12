import { create } from "zustand";
import type { FerroAnimationPlan } from "@/lib/types";

interface AIPlanStore {
  plan: FerroAnimationPlan | null;
  isGenerating: boolean;
  error: string | null;

  // Actions
  setPlan: (plan: FerroAnimationPlan) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAIPlanStore = create<AIPlanStore>((set) => ({
  plan: null,
  isGenerating: false,
  error: null,

  setPlan: (plan) => set({ plan, error: null }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  reset: () => set({
    plan: null,
    isGenerating: false,
    error: null,
  }),
}));

