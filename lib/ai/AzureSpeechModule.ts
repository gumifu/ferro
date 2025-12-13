import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import type { AudioFrame } from "@/lib/types";

/**
 * Azure Speech AI Module
 * 音声特徴量の解析を行う
 *
 * 注意: ferroは感情をラベリングしない
 * このモジュールは音声の技術的特徴（音量、周波数、リズムなど）を抽出するのみ
 */
export class AzureSpeechModule {
  private speechConfig: SpeechSDK.SpeechConfig | null = null;
  private audioConfig: SpeechSDK.AudioConfig | null = null;
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private isInitialized: boolean = false;

  constructor() {
    const subscriptionKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
    const region = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;

    if (!subscriptionKey || !region) {
      console.warn(
        "[AzureSpeechModule] Azure Speech credentials not found. " +
        "Please set NEXT_PUBLIC_AZURE_SPEECH_KEY and NEXT_PUBLIC_AZURE_SPEECH_REGION in .env.local"
      );
      return;
    }

    try {
      this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        subscriptionKey,
        region
      );
      this.isInitialized = true;
      console.log("[AzureSpeechModule] Azure Speech initialized successfully");
    } catch (error) {
      console.error("[AzureSpeechModule] Initialization error:", error);
      this.isInitialized = false;
    }
  }

  isAvailable(): boolean {
    return this.isInitialized && this.speechConfig !== null;
  }

  /**
   * 音声ストリームから特徴量を抽出
   * 注意: 感情分析は行わない。技術的特徴のみを抽出
   */
  async analyzeAudioFeatures(
    audioStream: MediaStream
  ): Promise<{
    volume: number;
    pitch: number;
    tempo: number;
    spectralCentroid: number;
  } | null> {
    if (!this.isAvailable()) {
      console.warn("[AzureSpeechModule] Not available");
      return null;
    }

    // 注意: Azure Speech SDKは主に音声認識用
    // 音声特徴量の抽出は、Web Audio APIで行う方が適切
    // このモジュールは将来的な拡張用のプレースホルダー

    // 現在は、Web Audio APIで既に実装されている解析を使用
    // Azure Speechは将来的に、より高度な音声解析が必要になった場合に使用

    return null;
  }

  /**
   * 音声ストリームを停止
   */
  stop(): void {
    if (this.recognizer) {
      this.recognizer.stopContinuousRecognitionAsync(
        () => {
          console.log("[AzureSpeechModule] Recognition stopped");
        },
        (error) => {
          console.error("[AzureSpeechModule] Stop error:", error);
        }
      );
      this.recognizer = null;
    }

    if (this.audioConfig) {
      this.audioConfig.close();
      this.audioConfig = null;
    }
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.stop();
    this.speechConfig = null;
    this.isInitialized = false;
  }
}

