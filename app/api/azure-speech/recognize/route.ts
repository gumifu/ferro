import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Azure Speech AI 音声認識API (Speech-to-Text)
 * サーバーサイドで音声データをテキストに変換
 *
 * 注意: ferroは感情をラベリングしない
 * このAPIは音声をテキストに変換するのみ
 */
export async function POST(req: NextRequest) {
  try {
    const subscriptionKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!subscriptionKey || !region) {
      return NextResponse.json(
        {
          error: "Azure Speech credentials not configured",
          details: {
            hasKey: !!subscriptionKey,
            hasRegion: !!region,
          },
        },
        { status: 500 }
      );
    }

    // リクエストボディから音声データを取得
    const body = await req.json();
    const { audioData, language = "ja-JP", format = "wav" } = body;

    if (!audioData) {
      return NextResponse.json(
        { error: "audioData is required" },
        { status: 400 }
      );
    }

    console.log("[azure-speech/recognize] Speech recognition request:", {
      audioDataLength: audioData.length,
      language,
      format,
    });

    // Azure Speech REST APIを使用して音声認識を実行
    // エンドポイント: https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1
    const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed`;

    // Base64デコードされた音声データを取得
    const audioBuffer = Buffer.from(audioData, "base64");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": subscriptionKey,
          "Content-Type": `audio/${format}`,
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[azure-speech/recognize] API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return NextResponse.json(
          {
            error: "Speech recognition failed",
            details: {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
            },
          },
          { status: response.status }
        );
      }

      const result = await response.json();

      console.log("[azure-speech/recognize] ✅ Speech recognition successful");

      return NextResponse.json({
        success: true,
        text: result.DisplayText || result.Text || "",
        confidence: result.Confidence || 0,
        language: result.Language || language,
        details: result,
      });
    } catch (fetchError: any) {
      console.error("[azure-speech/recognize] Fetch error:", {
        message: fetchError.message,
        stack: fetchError.stack,
      });

      return NextResponse.json(
        {
          error: "Failed to call Azure Speech API",
          details: process.env.NODE_ENV === "development" ? {
            message: fetchError.message,
            stack: fetchError.stack,
          } : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[azure-speech/recognize] Error:", {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: "Failed to process speech recognition request",
        details: process.env.NODE_ENV === "development" ? {
          message: error.message,
          stack: error.stack,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

