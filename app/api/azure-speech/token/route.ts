import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Azure Speech AI 認証トークン生成API
 * サーバーサイドでAPIキーを使用して認証トークンを生成し、クライアントに返す
 * これにより、APIキーをクライアントに露出せずにAzure Speech SDKを使用できる
 */
export async function GET(req: NextRequest) {
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

    // Azure Speech 認証トークンを取得
    // エンドポイント: https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken
    const tokenEndpoint = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[azure-speech/token] Token generation error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      return NextResponse.json(
        {
          error: "Failed to generate authentication token",
          details: {
            status: response.status,
            statusText: response.statusText,
          },
        },
        { status: response.status }
      );
    }

    const token = await response.text();

    console.log("[azure-speech/token] ✅ Authentication token generated successfully");

    // トークンとリージョンを返す
    return NextResponse.json({
      token,
      region,
    });
  } catch (error: any) {
    console.error("[azure-speech/token] Error:", {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: "Failed to generate authentication token",
        details: process.env.NODE_ENV === "development" ? {
          message: error.message,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

