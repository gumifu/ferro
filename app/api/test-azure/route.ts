import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

export const runtime = "nodejs";

/**
 * Azure OpenAI接続テスト用のAPIエンドポイント
 * GET /api/test-azure
 */
export async function GET() {
  // 開発環境でのみ実行可能
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment =
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "ferro-gpt-4o-mini";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-07-18";

  // 環境変数のチェック
  if (!endpoint || !apiKey) {
    return NextResponse.json({
      success: false,
      message: "環境変数が設定されていません",
      details: {
        hasEndpoint: !!endpoint,
        hasApiKey: !!apiKey,
        deployment,
      },
    });
  }

  try {
    // Azure OpenAI用の設定
    const normalizedEndpoint = endpoint.endsWith("/")
      ? endpoint.slice(0, -1)
      : endpoint;

    const client = new AzureOpenAI({
      endpoint: normalizedEndpoint,
      apiKey: apiKey,
      apiVersion: apiVersion,
    });

    // 簡単なテストリクエスト
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        {
          role: "user",
          content: "Hello, this is a connection test. Please respond with 'OK'.",
        },
      ],
      max_tokens: 10,
    });

    const content = response.choices[0]?.message?.content;

    return NextResponse.json({
      success: true,
      message: "Azure OpenAIへの接続に成功しました",
      details: {
        deployment,
        response: content,
        model: response.model,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; status?: number; statusText?: string };
    console.error("[test-azure] Error details:", {
      message: err.message,
      code: err.code,
      status: err.status,
      statusText: err.statusText,
      cause: (error as { cause?: unknown }).cause,
    });

    return NextResponse.json({
      success: false,
      message: "Azure OpenAIへの接続に失敗しました",
      details: {
        error: err.message,
        errorCode: err.code,
        errorStatus: err.status,
        deployment,
        endpoint: endpoint ? `${endpoint.substring(0, 30)}...` : "not set",
      },
    });
  }
}
