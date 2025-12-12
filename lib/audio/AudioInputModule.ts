import { useAudioStore } from "@/lib/stores/audioStore";
import type { AudioFrame, AudioTimeline } from "@/lib/types";

export class AudioInputModule {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private animationFrameId: number | null = null;
  private timelineFrames: AudioFrame[] = [];
  private timelineStartTime: number = 0;
  private lastTimelineUpdate: number = 0;
  private trackTimeStart: number = 0;
  private sourceType: "mic" | "file" = "mic";
  private enableDebugLog: boolean = false;

  async startMic(enableDebug: boolean = false): Promise<void> {
    try {
      this.enableDebugLog = enableDebug;
      this.sourceType = "mic";

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      this.timelineStartTime = Date.now();
      this.trackTimeStart = this.audioContext.currentTime;
      this.timelineFrames = [];
      this.lastTimelineUpdate = 0;

      useAudioStore.getState().setIsRecording(true);
      useAudioStore.getState().setError(null);

      if (this.enableDebugLog) {
        console.log("[AudioInputModule] Mic started, timeline collection begins");
      }

      this.startAnalysis();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "マイクの取得に失敗しました";
      useAudioStore.getState().setError(errorMessage);
      useAudioStore.getState().setIsRecording(false);
      throw error;
    }
  }

  async startFile(file: File, enableDebug: boolean = false): Promise<void> {
    try {
      this.enableDebugLog = enableDebug;
      this.sourceType = "file";

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      const audioElement = new Audio();
      audioElement.src = URL.createObjectURL(file);
      audioElement.crossOrigin = "anonymous";

      // Wait for metadata to load to get duration
      await new Promise((resolve, reject) => {
        audioElement.addEventListener("loadedmetadata", resolve);
        audioElement.addEventListener("error", reject);
      });

      await audioElement.play();

      this.audioElement = audioElement;
      this.source = this.audioContext.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.timelineStartTime = Date.now();
      this.trackTimeStart = this.audioContext.currentTime;
      this.timelineFrames = [];
      this.lastTimelineUpdate = 0;

      useAudioStore.getState().setIsRecording(true);
      useAudioStore.getState().setError(null);

      if (this.enableDebugLog) {
        console.log("[AudioInputModule] File started:", {
          fileName: file.name,
          duration: audioElement.duration,
          source: "file",
        });
      }

      // Update trackTime based on audio element
      audioElement.addEventListener("timeupdate", () => {
        useAudioStore.getState().setTrackTime(audioElement.currentTime);
      });

      // Log timeline when audio ends
      audioElement.addEventListener("ended", () => {
        this.logTimeline();
      });

      this.startAnalysis();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "音声ファイルの読み込みに失敗しました";
      useAudioStore.getState().setError(errorMessage);
      useAudioStore.getState().setIsRecording(false);
      throw error;
    }
  }

  private startAnalysis(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyData = new Float32Array(bufferLength);

    const analyze = () => {
      if (!this.analyser || !useAudioStore.getState().isRecording) {
        return;
      }

      this.analyser.getByteTimeDomainData(dataArray);
      this.analyser.getFloatFrequencyData(frequencyData);

      // Calculate RMS volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const volumeRms = Math.sqrt(sum / bufferLength);

      // Calculate bass (0-250 Hz) and treble (4000-20000 Hz)
      const sampleRate = this.audioContext?.sampleRate || 44100;
      const nyquist = sampleRate / 2;
      const bassEnd = Math.floor((250 / nyquist) * bufferLength);
      const trebleStart = Math.floor((4000 / nyquist) * bufferLength);
      const trebleEnd = Math.floor((20000 / nyquist) * bufferLength);

      let bassSum = 0;
      let trebleSum = 0;

      for (let i = 0; i < bassEnd; i++) {
        const magnitude = Math.pow(10, frequencyData[i] / 20);
        bassSum += magnitude;
      }

      for (let i = trebleStart; i < trebleEnd && i < bufferLength; i++) {
        const magnitude = Math.pow(10, frequencyData[i] / 20);
        trebleSum += magnitude;
      }

      const bass = Math.min(1, bassSum / bassEnd);
      const treble = Math.min(1, trebleSum / (trebleEnd - trebleStart));

      // Update real-time values
      useAudioStore.getState().setRealtimeAudio({
        volumeRms: Math.min(1, volumeRms * 2), // Amplify a bit
        bass,
        treble,
      });

      // Update trackTime
      if (this.audioElement) {
        useAudioStore.getState().setTrackTime(this.audioElement.currentTime);
      } else {
        const elapsed = (Date.now() - this.timelineStartTime) / 1000;
        useAudioStore.getState().setTrackTime(elapsed);
      }

      // Collect timeline data every 0.5 seconds
      const currentTime = useAudioStore.getState().trackTime;
      if (currentTime - this.lastTimelineUpdate >= 0.5) {
        const frame: AudioFrame = {
          time: Math.round(currentTime * 10) / 10, // Round to 0.1s precision
          volumeRms: Math.min(1, Math.max(0, volumeRms * 2)),
          bass: Math.min(1, Math.max(0, bass)),
          treble: Math.min(1, Math.max(0, treble)),
        };

        this.timelineFrames.push(frame);
        this.lastTimelineUpdate = currentTime;

        // Update timeline in store
        const timeline: AudioTimeline = {
          trackInfo: {
            source: this.sourceType,
            duration: this.audioElement?.duration,
            bpmApprox: null, // TODO: Calculate BPM in Phase 2+ if needed
          },
          frames: [...this.timelineFrames],
        };
        useAudioStore.getState().setTimeline(timeline);

        if (this.enableDebugLog && this.timelineFrames.length % 10 === 0) {
          console.log(`[AudioInputModule] Timeline: ${this.timelineFrames.length} frames collected`);
        }
      }

      this.animationFrameId = requestAnimationFrame(analyze);
    };

    analyze();
  }

  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;

    // Log final timeline before stopping
    if (this.timelineFrames.length > 0) {
      this.logTimeline();
    }

    useAudioStore.getState().setIsRecording(false);
    useAudioStore.getState().reset();
  }

  /**
   * Log the current timeline as JSON for debugging
   */
  private logTimeline(): void {
    if (!this.enableDebugLog) return;

    const timeline: AudioTimeline = {
      trackInfo: {
        source: this.sourceType,
        duration: this.audioElement?.duration,
        bpmApprox: null,
      },
      frames: [...this.timelineFrames],
    };

    console.log("[AudioInputModule] Final Timeline JSON:");
    console.log(JSON.stringify(timeline, null, 2));
    console.log(`[AudioInputModule] Total frames: ${timeline.frames.length}, Duration: ${timeline.trackInfo.duration || "N/A"}s`);
  }

  /**
   * Get current timeline for external use
   */
  getTimeline(): AudioTimeline | null {
    if (this.timelineFrames.length === 0) return null;

    return {
      trackInfo: {
        source: this.sourceType,
        duration: this.audioElement?.duration,
        bpmApprox: null,
      },
      frames: [...this.timelineFrames],
    };
  }
}

