import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Azure Speech AI 音声解析API
 * サーバーサイドで音声データを解析し、特徴量を抽出
 *
 * 注意: ferroは感情をラベリングしない
 * このAPIは音声の技術的特徴（音量、周波数、リズムなど）を抽出するのみ
 *
 * 現在の実装: プレースホルダー
 * Azure Speech AIは主に音声認識（Speech-to-Text）と音声合成（Text-to-Speech）用
 * 音声特徴量の抽出には、Web Audio APIで行う方が適切
 * このAPIは将来的な拡張用（音声認識機能など）のプレースホルダー
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
    const { audioData, format = "wav" } = body;

    if (!audioData) {
      return NextResponse.json(
        { error: "audioData is required" },
        { status: 400 }
      );
    }

    // 注意: Azure Speech AIは主に音声認識（Speech-to-Text）と音声合成（Text-to-Speech）用
    // 音声特徴量の抽出には、Web Audio APIで行う方が適切
    // このAPIは将来的な拡張用のプレースホルダー

    // 現在は、クライアント側のWeb Audio APIで既に実装されている解析を使用
    // Azure Speechは将来的に、より高度な音声解析（音声認識など）が必要になった場合に使用

    // 一時的な実装: 音声データの基本情報を返す
    const audioBuffer = Buffer.from(audioData, "base64");
    const duration = audioBuffer.length / 44100; // 仮の計算（実際のサンプルレートに応じて調整）

    console.log("[azure-speech/analyze] Audio analysis request received:", {
      audioDataLength: audioData.length,
      format,
      estimatedDuration: duration,
    });

    return NextResponse.json({
      success: true,
      features: {
        duration,
        sampleRate: 44100, // 仮の値
        channels: 1, // 仮の値
        // 将来的に、Azure Speech AIの高度な機能を使用して特徴量を抽出
      },
      message: "Azure Speech AI analysis completed (placeholder implementation)",
      note: "Currently using Web Audio API for audio analysis. Azure Speech AI is reserved for future features like speech recognition.",
    });
  } catch (error: any) {
    console.error("[azure-speech/analyze] Error:", {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: "Failed to analyze audio",
        details: process.env.NODE_ENV === "development" ? {
          message: error.message,
          stack: error.stack,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

