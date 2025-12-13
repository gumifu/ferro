import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Azure Speech AI リアルタイム音声認識API (Streaming Speech-to-Text)
 * Server-Sent Events (SSE) を使用してリアルタイムで音声認識結果を返す
 *
 * 注意: ferroは感情をラベリングしない
 * このAPIは音声をテキストに変換するのみ
 */
export async function POST(req: NextRequest) {
  const subscriptionKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!subscriptionKey || !region) {
    return new Response(
      JSON.stringify({
        error: "Azure Speech credentials not configured",
        details: {
          hasKey: !!subscriptionKey,
          hasRegion: !!region,
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Server-Sent Events (SSE) のストリームを作成
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await req.json();
        const { audioChunk, language = "ja-JP", format = "wav", isFinal = false } = body;

        if (!audioChunk) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "audioChunk is required" })}\n\n`)
          );
          controller.close();
          return;
        }

        console.log("[azure-speech/recognize-stream] Processing audio chunk:", {
          audioChunkLength: audioChunk.length,
          language,
          format,
          isFinal,
        });

        // Azure Speech REST APIを使用して音声認識を実行
        // エンドポイント: https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1
        const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed`;

        // Base64デコードされた音声データを取得
        const audioBuffer = Buffer.from(audioChunk, "base64");

        // WAVヘッダーのチェック
        const first4Bytes = audioBuffer.length >= 4
          ? audioBuffer.toString('ascii', 0, 4)
          : '';
        const hasWavHeader = audioBuffer.length >= 44 && first4Bytes === 'RIFF';

        // デバッグ: 最初の数バイトを確認
        const debugBytes = audioBuffer.length >= 12
          ? Array.from(audioBuffer.slice(0, 12)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
          : 'too short';

        console.log("[azure-speech/recognize-stream] Calling Azure Speech API:", {
          endpoint,
          audioBufferLength: audioBuffer.length,
          format,
          language,
          hasWavHeader,
          first4Bytes,
          debugBytes,
        });

        try {
          // Azure Speech REST APIは、WAVファイル形式を期待
          // Content-Typeは audio/wav を使用
          const contentType = "audio/wav";

          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Ocp-Apim-Subscription-Key": subscriptionKey,
              "Content-Type": contentType,
            },
            body: audioBuffer,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("[azure-speech/recognize-stream] API error:", {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
              headers: Object.fromEntries(response.headers.entries()),
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  error: "Speech recognition failed",
                  details: {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                  },
                })}\n\n`
              )
            );
            controller.close();
            return;
          }

          const result = await response.json();

          console.log("[azure-speech/recognize-stream] ✅ Speech recognition successful:", {
            result,
            displayText: result.DisplayText,
            text: result.Text,
            confidence: result.Confidence,
            nBest: result.NBest,
            recognitionStatus: result.RecognitionStatus,
          });

          // 認識されたテキストを取得
          // NBest配列から最適な結果を取得（DisplayTextが空の場合）
          let recognizedText = result.DisplayText || result.Text || "";
          let confidence = result.Confidence || 0;

          // DisplayTextが空で、NBest配列がある場合は、そこから取得
          if (!recognizedText && result.NBest && result.NBest.length > 0) {
            const bestResult = result.NBest[0];
            recognizedText = bestResult.Display || bestResult.Text || bestResult.Lexical || "";
            confidence = bestResult.Confidence || 0;
            console.log("[azure-speech/recognize-stream] Using NBest result:", {
              text: recognizedText,
              confidence,
            });
          }

          // SSE形式で結果を送信
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                success: true,
                text: recognizedText,
                confidence: confidence,
                language: result.Language || language,
                isFinal,
                details: result,
              })}\n\n`
            )
          );

          console.log("[azure-speech/recognize-stream] SSE data sent:", {
            text: recognizedText,
            confidence,
          });

          if (isFinal) {
            controller.close();
          }
        } catch (fetchError: any) {
          console.error("[azure-speech/recognize-stream] Fetch error:", {
            message: fetchError.message,
            stack: fetchError.stack,
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: "Failed to call Azure Speech API",
                details: process.env.NODE_ENV === "development" ? {
                  message: fetchError.message,
                } : undefined,
              })}\n\n`
            )
          );
          controller.close();
        }
      } catch (error: any) {
        console.error("[azure-speech/recognize-stream] Error:", {
          message: error.message,
          stack: error.stack,
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: "Failed to process speech recognition request",
              details: process.env.NODE_ENV === "development" ? {
                message: error.message,
              } : undefined,
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

