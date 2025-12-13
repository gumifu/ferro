// Reflection type definition for v2
// See doc/v2-reflection-rules.md for language rules

export type ReflectionTone = "calm" | "neutral" | "pulse" | "wild";

export type Reflection = {
  tone: ReflectionTone;
  reason: string; // 選定理由: なぜこのtoneが選ばれたかの説明（技術的な説明、内部的な理由）
  message: string; // 3 sentences, 60-120 chars (60-100 for Japanese), rules applied - 実際に表示されるreflection
};

// Audio summary for Reflection generation
export type AudioSummary = {
  duration: number; // seconds
  avgRms: number; // 0-1
  maxRms: number; // 0-1
  avgBass: number; // 0-1
  avgMid: number; // 0-1
  avgTreble: number; // 0-1
  flux: number; // 0-1, change rate
  userMoodText?: string; // optional user input
  uiLanguage: "en" | "ja"; // UI language to match reflection
};



