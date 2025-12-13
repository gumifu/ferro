"use client";

import { useState, useRef } from "react";
import { useAudioStore } from "@/lib/stores/audioStore";
import { useAIPlanStore } from "@/lib/stores/aiPlanStore";
import { useAIProviderStore } from "@/lib/stores/aiProviderStore";
import { AudioInputModule } from "@/lib/audio/AudioInputModule";
import { AIPlannerFactory } from "@/lib/ai/AIPlannerFactory";
import { AzureSpeechModule } from "@/lib/ai/AzureSpeechModule";

export function AudioControls() {
  const [audioSource, setAudioSource] = useState<"mic" | "file" | "system">(
    "mic"
  );
  const [enableDebug, setEnableDebug] = useState(false);
  const [userMoodText, setUserMoodText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioModuleRef = useRef<AudioInputModule | null>(null);
  const aiPlannerFactoryRef = useRef<AIPlannerFactory | null>(null);
  const speechModuleRef = useRef<AzureSpeechModule | null>(null);
  const stopRealtimeRecognitionRef = useRef<(() => void) | null>(null);
  const {
    isRecording,
    error,
    timeline,
    speechRecognitionResults,
    isRecognizing,
    addSpeechRecognitionResult,
    setIsRecognizing,
    clearSpeechRecognitionResults,
  } = useAudioStore();
  const { provider: aiProvider } = useAIProviderStore();
  const {
    isGenerating: isAIGenerating,
    plan,
    error: aiError,
  } = useAIPlanStore();

  const handleStart = async () => {
    if (!audioModuleRef.current) {
      audioModuleRef.current = new AudioInputModule();
    }

    try {
      if (audioSource === "mic") {
        await audioModuleRef.current.startMic(enableDebug);
      } else if (audioSource === "file") {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          useAudioStore.getState().setError("音声ファイルを選択してください");
          return;
        }
        await audioModuleRef.current.startFile(file, enableDebug);
      } else if (audioSource === "system") {
        await audioModuleRef.current.startSystemAudio(enableDebug);
      }

      // For file source, generate plan immediately after metadata loads
      // For mic, wait for ~10 seconds of data
      if (audioSource === "file" && timeline) {
        setTimeout(() => {
          generateAIPlan();
        }, 1000); // Wait 1 second for timeline to populate
      }
    } catch (err) {
      console.error("Audio start error:", err);
    }
  };

  const generateAIPlan = async () => {
    if (!timeline || timeline.frames.length === 0) {
      console.warn("[AudioControls] No timeline data available");
      return;
    }

    // AI providerが"none"の場合はスキップ
    if (aiProvider === "none") {
      console.log(
        "[AudioControls] AI provider is set to 'none', skipping AI plan generation"
      );
      return;
    }

    if (!aiPlannerFactoryRef.current) {
      aiPlannerFactoryRef.current = new AIPlannerFactory();
    }

    // Check if AI planner is available
    if (!aiPlannerFactoryRef.current.isAvailable()) {
      const providerName = aiProvider === "azure" ? "Azure" : "OpenAI";
      const errorMsg = `${providerName} APIキーが設定されていません。.env.localファイル（開発環境）またはEnvironment Variables（本番環境）に必要な環境変数を設定してください。`;
      useAIPlanStore.getState().setError(errorMsg);
      console.error("[AudioControls]", errorMsg);
      return;
    }

    try {
      const plan = await aiPlannerFactoryRef.current.generatePlan(
        timeline,
        userMoodText
      );
      if (!plan) {
        console.warn("[AudioControls] AI plan generation returned null");
      }
    } catch (err) {
      console.error("[AudioControls] AI plan generation error:", err);
      // Error is already set in the planner module
    }
  };

  const handleStop = () => {
    if (audioModuleRef.current) {
      audioModuleRef.current.stop();
    }

    // Generate plan from collected timeline when stopping
    if (timeline && timeline.frames.length > 0) {
      generateAIPlan();
    }
  };

  const handleStartRealtimeRecognition = async () => {
    if (!speechModuleRef.current) {
      speechModuleRef.current = new AzureSpeechModule();
    }

    if (!speechModuleRef.current.isAvailable()) {
      useAudioStore.getState().setError("Azure Speech AI is not available");
      return;
    }

    // マイクストリームを取得
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      useAudioStore.getState().setError("マイクへのアクセスが拒否されました");
      return;
    }

    setIsRecognizing(true);
    useAudioStore.getState().setError(null);

    try {
      const stopFn = await speechModuleRef.current.startRealtimeRecognition(
        stream,
        "ja-JP",
        (result) => {
          // 認識結果を受け取る
          addSpeechRecognitionResult({
            text: result.text,
            confidence: result.confidence,
            language: "ja-JP",
            timestamp: Date.now(),
          });

          console.log("[AudioControls] Speech recognition result:", result);
        }
      );

      stopRealtimeRecognitionRef.current = stopFn;
      console.log("[AudioControls] ✅ Realtime speech recognition started");
    } catch (err) {
      console.error(
        "[AudioControls] Failed to start realtime recognition:",
        err
      );
      useAudioStore
        .getState()
        .setError(
          err instanceof Error
            ? err.message
            : "リアルタイム音声認識の開始に失敗しました"
        );
      setIsRecognizing(false);
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleStopRealtimeRecognition = () => {
    if (stopRealtimeRecognitionRef.current) {
      stopRealtimeRecognitionRef.current();
      stopRealtimeRecognitionRef.current = null;
      setIsRecognizing(false);
      console.log("[AudioControls] Realtime speech recognition stopped");
    }
  };

  return (
    <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white min-w-[280px] max-w-[320px]">
      <h2 className="text-lg font-semibold mb-4">ferro</h2>

      {/* Audio Source Selection */}
      <div className="mb-4">
        <label className="block text-sm mb-2">音声入力</label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setAudioSource("mic")}
            className={`px-3 py-1 rounded text-sm ${
              audioSource === "mic"
                ? "bg-white text-black"
                : "bg-gray-700 text-white"
            }`}
            disabled={isRecording}
          >
            Mic
          </button>
          <button
            onClick={() => setAudioSource("file")}
            className={`px-3 py-1 rounded text-sm ${
              audioSource === "file"
                ? "bg-white text-black"
                : "bg-gray-700 text-white"
            }`}
            disabled={isRecording}
          >
            Audio File
          </button>
          <button
            onClick={() => setAudioSource("system")}
            className={`px-3 py-1 rounded text-sm ${
              audioSource === "system"
                ? "bg-white text-black"
                : "bg-gray-700 text-white"
            }`}
            disabled={isRecording}
          >
            Tab Audio
          </button>
        </div>
      </div>

      {/* File Input */}
      {audioSource === "file" && (
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="text-sm text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-white file:text-black hover:file:bg-gray-100"
            disabled={isRecording}
          />
        </div>
      )}

      {/* Mic Info */}
      {audioSource === "mic" && (
        <p className="text-xs text-gray-400 mb-4">
          マイクの音に反応して動きます。マイクの権限を許可してください。
        </p>
      )}

      {/* System Audio Info */}
      {audioSource === "system" && (
        <p className="text-xs text-gray-400 mb-4">
          ブラウザタブの音声に反応します。画面共有でタブを選択してください。
        </p>
      )}

      {/* Realtime Speech Recognition */}
      <div className="mb-4">
        {!isRecognizing ? (
          <button
            onClick={handleStartRealtimeRecognition}
            disabled={isRecording}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
          >
            リアルタイム音声認識を開始
          </button>
        ) : (
          <button
            onClick={handleStopRealtimeRecognition}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
          >
            音声認識を停止
          </button>
        )}
      </div>

      {/* Speech Recognition Results */}
      {speechRecognitionResults.length > 0 && (
        <div className="mb-4 p-2 bg-purple-500/20 border border-purple-500/50 rounded text-xs max-h-32 overflow-y-auto">
          <div className="font-semibold mb-1">音声認識結果:</div>
          {speechRecognitionResults.map((result, index) => (
            <div key={index} className="mb-1">
              <div className="text-white">{result.text}</div>
              <div className="text-gray-400 text-xs">
                信頼度: {(result.confidence * 100).toFixed(1)}%
              </div>
            </div>
          ))}
          <button
            onClick={clearSpeechRecognitionResults}
            className="mt-2 text-xs text-purple-300 hover:text-purple-200"
          >
            クリア
          </button>
        </div>
      )}

      {/* User Mood Text Input */}
      <div className="mb-4">
        <label className="block text-sm mb-2">今の気分や状況（任意）</label>
        <textarea
          value={userMoodText}
          onChange={(e) => setUserMoodText(e.target.value)}
          placeholder="例: 疲れてるけど集中したい"
          className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm resize-none"
          rows={2}
          disabled={isRecording || isAIGenerating}
        />
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      {aiError && (
        <div className="mb-4 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded text-sm text-yellow-300">
          AI解析: {aiError}
        </div>
      )}

      {/* AI Generating Indicator */}
      {isAIGenerating && (
        <div className="mb-4 p-2 bg-blue-500/20 border border-blue-500/50 rounded text-sm text-blue-300">
          AIがムードを解析中...
        </div>
      )}

      {/* AI Plan Info */}
      {plan && !isAIGenerating && (
        <div className="mb-4 p-2 bg-green-500/20 border border-green-500/50 rounded text-xs">
          <div className="font-semibold mb-1">ムード: {plan.overallMood}</div>
          <div>セクション数: {plan.sections.length}</div>
        </div>
      )}

      {/* Debug Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={enableDebug}
            onChange={(e) => setEnableDebug(e.target.checked)}
            disabled={isRecording}
            className="w-4 h-4"
          />
          <span>デバッグログを有効化</span>
        </label>
      </div>

      {/* Timeline Info */}
      {timeline && (
        <div className="mb-4 p-2 bg-gray-800 rounded text-xs">
          <div>Frames: {timeline.frames.length}</div>
          <div>Source: {timeline.trackInfo.source}</div>
          {timeline.trackInfo.duration && (
            <div>Duration: {timeline.trackInfo.duration.toFixed(1)}s</div>
          )}
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2">
        {!isRecording ? (
          <button
            onClick={handleStart}
            className="flex-1 px-4 py-2 bg-white text-black rounded font-medium hover:bg-gray-200 transition-colors"
          >
            Start Session
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded font-medium hover:bg-red-600 transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {/* Export Timeline Button */}
      {timeline && timeline.frames.length > 0 && !isRecording && (
        <button
          onClick={() => {
            console.log("[AudioControls] Timeline JSON:");
            console.log(JSON.stringify(timeline, null, 2));
            navigator.clipboard.writeText(JSON.stringify(timeline, null, 2));
            alert(
              "Timeline JSONをコンソールに出力し、クリップボードにコピーしました"
            );
          }}
          className="mt-2 w-full px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
        >
          Export Timeline JSON
        </button>
      )}
    </div>
  );
}
