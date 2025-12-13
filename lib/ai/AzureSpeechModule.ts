import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

/**
 * Azure Speech AI Module
 * Azure Speech SDKを使用してリアルタイム音声認識を実装
 *
 * 注意: ferroは感情をラベリングしない
 * このモジュールは音声をテキストに変換するのみ
 */
export class AzureSpeechModule {
  private isInitialized: boolean = false;
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private audioConfig: SpeechSDK.AudioConfig | null = null;

  constructor() {
    console.log("[AzureSpeechModule] Azure Speech module initialized (using Speech SDK)");
    this.isInitialized = true;
  }

  isAvailable(): boolean {
    return this.isInitialized;
  }

  /**
   * 音声ストリームから特徴量を抽出（API Route経由）
   * 注意: 感情分析は行わない。技術的特徴のみを抽出
   */
  async analyzeAudioFeatures(
    audioData: ArrayBuffer | Float32Array
  ): Promise<{
    volume: number;
    pitch: number;
    tempo: number;
    spectralCentroid: number;
  } | null> {
    try {
      // 音声データをBase64エンコード
      // 注意: ブラウザ環境ではBufferが使えないため、ArrayBufferを直接Base64に変換
      let base64Audio: string;
      if (audioData instanceof ArrayBuffer) {
        const bytes = new Uint8Array(audioData);
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        base64Audio = btoa(binary);
      } else {
        const bytes = new Uint8Array(audioData.buffer);
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        base64Audio = btoa(binary);
      }

      // API Route経由でサーバーサイドのAzure Speech AIを呼び出し
      const response = await fetch("/api/azure-speech/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioData: base64Audio,
          format: "wav",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[AzureSpeechModule] API error:", errorData);
        return null;
      }

      const data = await response.json();

      // 将来的に、Azure Speech AIの高度な機能を使用して特徴量を抽出
      // 現在は、Web Audio APIで既に実装されている解析を使用

      return {
        volume: 0.5, // プレースホルダー
        pitch: 0.5, // プレースホルダー
        tempo: 120, // プレースホルダー
        spectralCentroid: 0.5, // プレースホルダー
      };
    } catch (error) {
      console.error("[AzureSpeechModule] Analysis error:", error);
      return null;
    }
  }

  /**
   * 音声認識（Speech-to-Text）
   * 音声データをテキストに変換
   *
   * @param audioData 音声データ（ArrayBufferまたはFloat32Array）
   * @param language 言語コード（デフォルト: "ja-JP"）
   * @returns 認識されたテキストと信頼度
   */
  async recognizeSpeech(
    audioData: ArrayBuffer | Float32Array,
    language: string = "ja-JP"
  ): Promise<{
    text: string;
    confidence: number;
    language: string;
  } | null> {
    try {
      // 音声データをBase64エンコード
      // 注意: ブラウザ環境ではBufferが使えないため、ArrayBufferを直接Base64に変換
      let base64Audio: string;
      if (audioData instanceof ArrayBuffer) {
        const bytes = new Uint8Array(audioData);
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        base64Audio = btoa(binary);
      } else {
        const bytes = new Uint8Array(audioData.buffer);
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        base64Audio = btoa(binary);
      }

      console.log("[AzureSpeechModule] Calling speech recognition API...");

      // API Route経由でサーバーサイドのAzure Speech AIを呼び出し
      const response = await fetch("/api/azure-speech/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioData: base64Audio,
          language,
          format: "wav",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[AzureSpeechModule] Speech recognition API error:", errorData);
        return null;
      }

      const data = await response.json();

      if (!data.success) {
        console.error("[AzureSpeechModule] Speech recognition failed:", data);
        return null;
      }

      console.log("[AzureSpeechModule] ✅ Speech recognition successful:", {
        text: data.text,
        confidence: data.confidence,
      });

      return {
        text: data.text || "",
        confidence: data.confidence || 0,
        language: data.language || language,
      };
    } catch (error) {
      console.error("[AzureSpeechModule] Speech recognition error:", error);
      return null;
    }
  }

  /**
   * 認証トークンを取得
   */
  private async getAuthToken(): Promise<{ token: string; region: string } | null> {
    console.log("[AzureSpeechModule] 🔑 Fetching auth token from /api/azure-speech/token...");
    try {
      const response = await fetch("/api/azure-speech/token");
      console.log("[AzureSpeechModule] Token API response:", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[AzureSpeechModule] Failed to get auth token:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return null;
      }

      const data = await response.json();
      console.log("[AzureSpeechModule] ✅ Token received:", {
        hasToken: !!data.token,
        tokenLength: data.token?.length,
        region: data.region,
      });

      return { token: data.token, region: data.region };
    } catch (error) {
      console.error("[AzureSpeechModule] ❌ Error getting auth token:", error);
      return null;
    }
  }

  /**
   * リアルタイム音声認識（ストリーミング）
   * Azure Speech SDKを使用してマイクから直接音声認識を実行
   *
   * @param audioStream 音声ストリーム（MediaStream）- SDKが直接マイクを使用するため未使用
   * @param language 言語コード（デフォルト: "ja-JP"）
   * @param onResult 認識結果を受け取るコールバック関数
   * @returns 停止関数
   */
  async startRealtimeRecognition(
    audioStream: MediaStream,
    language: string = "ja-JP",
    onResult: (result: { text: string; confidence: number; isFinal: boolean }) => void
  ): Promise<() => void> {
    console.log("[AzureSpeechModule] 🚀 startRealtimeRecognition called");

    try {
      // 認証トークンを取得
      console.log("[AzureSpeechModule] Getting auth token...");
      const auth = await this.getAuthToken();
      if (!auth) {
        console.error("[AzureSpeechModule] ❌ Failed to get auth token");
        throw new Error("Failed to get authentication token");
      }

      console.log("[AzureSpeechModule] ✅ Auth token obtained:", {
        tokenLength: auth.token.length,
        region: auth.region,
      });

      // Azure Speech SDKの設定
      console.log("[AzureSpeechModule] Creating SpeechConfig...");
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
        auth.token,
        auth.region
      );
      speechConfig.speechRecognitionLanguage = language;

      // 詳細な結果（NBest配列と信頼度）を取得するために設定
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceResponse_RequestSentenceBoundary,
        "true"
      );
      speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;

      console.log("[AzureSpeechModule] SpeechConfig created, language:", language);

      // マイクから直接音声を取得（SDKが自動的に処理）
      console.log("[AzureSpeechModule] Creating AudioConfig from default microphone...");
      this.audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      console.log("[AzureSpeechModule] AudioConfig created");

      // 音声認識エンジンを作成
      console.log("[AzureSpeechModule] Creating SpeechRecognizer...");
      this.recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, this.audioConfig);
      console.log("[AzureSpeechModule] SpeechRecognizer created");

      // 認識結果のイベントハンドラー
      this.recognizer.recognizing = (s, e) => {
        console.log("[AzureSpeechModule] 🔵 Recognizing event fired:", {
          text: e.result.text,
          reason: e.result.reason,
        });

        if (e.result.text) {
          // 部分的な認識結果の信頼度を取得
          let confidence = 0;
          try {
            const jsonResult = e.result.properties.getProperty(
              SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult
            );
            if (jsonResult) {
              const parsed = JSON.parse(jsonResult);
              if (parsed.NBest && parsed.NBest.length > 0) {
                confidence = parsed.NBest[0].Confidence || 0;
              }
            }
          } catch (err) {
            console.warn("[AzureSpeechModule] Failed to parse confidence from partial result:", err);
          }

          console.log("[AzureSpeechModule] Recognizing (partial):", {
            text: e.result.text,
            confidence,
          });

          onResult({
            text: e.result.text,
            confidence,
            isFinal: false,
          });
        }
      };

      this.recognizer.recognized = (s, e) => {
        console.log("[AzureSpeechModule] 🟢 Recognized event fired:", {
          text: e.result.text,
          reason: e.result.reason,
          resultReason: SpeechSDK.ResultReason[e.result.reason],
        });

        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
          // 最終的な認識結果の信頼度を取得
          let confidence = 0;
          try {
            const jsonResult = e.result.properties.getProperty(
              SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult
            );
            console.log("[AzureSpeechModule] JSON result:", jsonResult);

            if (jsonResult) {
              const parsed = JSON.parse(jsonResult);
              console.log("[AzureSpeechModule] Parsed JSON:", parsed);

              if (parsed.NBest && parsed.NBest.length > 0) {
                confidence = parsed.NBest[0].Confidence || 0;
                console.log("[AzureSpeechModule] NBest[0]:", parsed.NBest[0]);
              }
            }
          } catch (err) {
            console.error("[AzureSpeechModule] Failed to parse confidence:", err);
          }

          console.log("[AzureSpeechModule] ✅ Recognized (final):", {
            text: e.result.text,
            confidence,
          });

          onResult({
            text: e.result.text,
            confidence,
            isFinal: true,
          });
        } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
          console.log("[AzureSpeechModule] No speech could be recognized");
        } else {
          console.log("[AzureSpeechModule] Other reason:", {
            reason: e.result.reason,
            resultReason: SpeechSDK.ResultReason[e.result.reason],
            text: e.result.text,
          });
        }
      };

      this.recognizer.canceled = (s, e) => {
        console.error("[AzureSpeechModule] Recognition canceled:", e.errorDetails);
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          console.error("[AzureSpeechModule] Error details:", e.errorDetails);
        }
      };

      // 認識を開始
      console.log("[AzureSpeechModule] Starting continuous recognition...");
      this.recognizer.startContinuousRecognitionAsync(
        () => {
          console.log("[AzureSpeechModule] ✅✅✅ Continuous recognition started successfully!");
        },
        (error) => {
          console.error("[AzureSpeechModule] ❌ Failed to start recognition:", error);
          throw error;
        }
      );

      // 停止関数を返す
      return () => {
        if (this.recognizer) {
          this.recognizer.stopContinuousRecognitionAsync(
            () => {
              console.log("[AzureSpeechModule] Recognition stopped");
            },
            (error) => {
              console.error("[AzureSpeechModule] Error stopping recognition:", error);
            }
          );
          this.recognizer.close();
          this.recognizer = null;
        }
        if (this.audioConfig) {
          this.audioConfig.close();
          this.audioConfig = null;
        }
      };
    } catch (error) {
      console.error("[AzureSpeechModule] Failed to start realtime recognition:", error);
      throw error;
    }
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
          console.error("[AzureSpeechModule] Error stopping recognition:", error);
        }
      );
      this.recognizer.close();
      this.recognizer = null;
    }
    if (this.audioConfig) {
      this.audioConfig.close();
      this.audioConfig = null;
    }
    console.log("[AzureSpeechModule] Stop called");
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.stop();
    this.isInitialized = false;
  }
}

