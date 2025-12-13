"use client";

import { useState } from "react";

/**
 * Azure OpenAI接続テストコンポーネント
 * 開発者向けの接続確認用
 */
export function AzureConnectionTest() {
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const testConnection = async () => {
    setIsTesting(true);
    setResult(null);

    try {
      const response = await fetch("/api/test-azure");
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        message: "テスト実行中にエラーが発生しました",
        details: {
          error: error.message,
        },
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <button
        onClick={testConnection}
        disabled={isTesting}
        className="px-3 py-1.5 bg-blue-600/80 backdrop-blur-sm text-white text-xs rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Test Azure OpenAI Connection"
      >
        {isTesting ? "Testing..." : "Test Azure"}
      </button>

      {result && (
        <div
          className={`absolute bottom-10 left-0 bg-black/90 backdrop-blur-sm rounded-lg p-4 text-white min-w-[280px] max-w-[400px] shadow-lg ${
            result.success ? "border border-green-500" : "border border-red-500"
          }`}
        >
          <div className="mb-2">
            <div
              className={`text-sm font-semibold ${
                result.success ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.success ? "✓ Success" : "✗ Failed"}
            </div>
            <div className="text-xs text-gray-300 mt-1">{result.message}</div>
          </div>

          {result.details && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-xs text-gray-400">
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <button
            onClick={() => setResult(null)}
            className="mt-3 w-full px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

