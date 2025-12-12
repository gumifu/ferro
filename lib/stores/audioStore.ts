import { create } from "zustand";
import type { AudioFrame, AudioTimeline } from "@/lib/types";

interface AudioStore {
  // Real-time audio values
  realtimeAudio: {
    volumeRms: number;
    bass: number;
    treble: number;
  };

  // Timeline for AI
  timeline: AudioTimeline | null;

  // Session state
  isRecording: boolean;
  trackTime: number; // 再生開始からの秒数

  // Error state
  error: string | null;

  // Actions
  setRealtimeAudio: (audio: { volumeRms: number; bass: number; treble: number }) => void;
  setTimeline: (timeline: AudioTimeline) => void;
  setIsRecording: (isRecording: boolean) => void;
  setTrackTime: (time: number) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  realtimeAudio: {
    volumeRms: 0,
    bass: 0,
    treble: 0,
  },
  timeline: null,
  isRecording: false,
  trackTime: 0,
  error: null,

  setRealtimeAudio: (audio) => set({ realtimeAudio: audio }),
  setTimeline: (timeline) => set({ timeline }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setTrackTime: (time) => set({ trackTime: time }),
  setError: (error) => set({ error }),
  reset: () => set({
    realtimeAudio: { volumeRms: 0, bass: 0, treble: 0 },
    timeline: null,
    isRecording: false,
    trackTime: 0,
    error: null,
  }),
}));

