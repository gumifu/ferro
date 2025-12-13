/**
 * Azure OpenAI接続テスト用のユーティリティ
 * API Route経由でテストを実行
 */
export async function testAzureOpenAIConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const response = await fetch("/api/test-azure");

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.message || "接続テストに失敗しました",
        details: errorData.details || {},
      };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("[testAzureConnection] Error:", error);
    return {
      success: false,
      message: "接続テスト中にエラーが発生しました",
      details: {
        error: error.message,
      },
    };
  }
}

