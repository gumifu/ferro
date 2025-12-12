// Phase 1: Basic types
export type AudioFrame = {
  time: number;         // 秒
  volumeRms: number;    // 0-1
  bass: number;         // 0-1
  treble: number;       // 0-1
};

export type AudioTimeline = {
  trackInfo: {
    duration?: number;     // 取得できれば
    bpmApprox?: number | null;    // ざっくり推定 or null
    source: "mic" | "file";
  };
  frames: AudioFrame[];    // 0.5秒刻み程度（長すぎる場合は間引き）
};

// Phase 3: AI Planner types
export type FerroAnimationSection = {
  name: string;
  startTime: number;
  endTime: number;
  energy: number;        // 0-1
  tension: number;       // 0-1
  motionStyle: string;   // "slow_waves" | "spikes" | "breathing" | etc.
  spikeAmount: number;   // 0-1
  noiseAmount: number;   // 0-1
  colorPalette: string[]; // array of hex colors
};

export type FerroAnimationPlan = {
  overallMood: string;
  explanation?: string; // Moodを選んだ理由（音楽の特徴に基づく説明）
  encouragement?: string; // ユーザーへの励ましメッセージ
  global: {
    baseEnergy: number;
    baseTension: number;
    colorPalette: string[];
  };
  sections: FerroAnimationSection[];
};

