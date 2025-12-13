import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

export const runtime = "nodejs";

/**
 * Azure OpenAIデプロイメント一覧を取得するAPIエンドポイント
 * GET /api/list-azure-deployments
 *
 * 注意: このエンドポイントは開発環境でのみ使用可能
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
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-07-18";

  // 環境変数のチェック
  if (!endpoint || !apiKey) {
    return NextResponse.json({
      success: false,
      message: "環境変数が設定されていません",
      details: {
        hasEndpoint: !!endpoint,
        hasApiKey: !!apiKey,
      },
    });
  }

  try {
    const normalizedEndpoint = endpoint.endsWith("/")
      ? endpoint.slice(0, -1)
      : endpoint;

    const client = new AzureOpenAI({
      endpoint: normalizedEndpoint,
      apiKey: apiKey,
      apiVersion: apiVersion,
    });

    // デプロイメント一覧を取得（Azure OpenAI REST APIを使用）
    // 注意: openai SDKには直接的なデプロイメント一覧取得メソッドがないため、
    // REST APIを直接呼び出す必要があります
    const deploymentsUrl = `${normalizedEndpoint}/openai/deployments?api-version=${apiVersion}`;

    const response = await fetch(deploymentsUrl, {
      method: "GET",
      headers: {
        "api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        message: "デプロイメント一覧の取得に失敗しました",
        details: {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          endpoint: normalizedEndpoint,
          apiVersion,
        },
      });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "デプロイメント一覧を取得しました",
      deployments: data.data || data.value || [],
      details: {
        endpoint: normalizedEndpoint,
        apiVersion,
        count: (data.data || data.value || []).length,
      },
    });
  } catch (error: any) {
    console.error("[list-azure-deployments] Error details:", {
      message: error.message,
      code: error.code,
      status: error.status,
      statusText: error.statusText,
      cause: error.cause,
    });

    return NextResponse.json({
      success: false,
      message: "デプロイメント一覧の取得に失敗しました",
      details: {
        error: error.message,
        errorCode: error.code,
        errorStatus: error.status,
        endpoint: endpoint ? `${endpoint.substring(0, 30)}...` : "not set",
      },
    });
  }
}

