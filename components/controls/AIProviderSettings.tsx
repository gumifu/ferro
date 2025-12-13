"use client";

import { useState } from "react";
import { useAIProviderStore } from "@/lib/stores/aiProviderStore";
import type {
  AIProvider,
  AzureModel,
  OpenAIModel,
} from "@/lib/stores/aiProviderStore";

/**
 * AI Provider Settings Component
 * 開発者向けのAIプロバイダー切り替えUI
 *
 * 注意: 仕様書に従い、UIは最小限に
 * ユーザーはAIの存在を意識しなくてよい
 */
export function AIProviderSettings() {
  const {
    provider,
    azureModel,
    openaiModel,
    setProvider,
    setAzureModel,
    setOpenAIModel,
  } = useAIProviderStore();
  const [isOpen, setIsOpen] = useState(false);

  // Azure OpenAI用のモデルリスト
  const azureModels: { value: AzureModel; label: string }[] = [
    { value: "gpt-4o-mini-2", label: "gpt-4o-mini-2" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
  ];

  // OpenAI API用のモデルリスト
  const openaiModels: { value: OpenAIModel; label: string }[] = [
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4-turbo", label: "gpt-4-turbo" },
  ];

  const providers: { value: AIProvider; label: string; description: string }[] =
    [
      {
        value: "azure",
        label: "Azure AI (Default)",
        description: "Azure OpenAI + Azure Speech AI",
      },
      {
        value: "openai",
        label: "OpenAI API",
        description: "OpenAI API (比較・検証用)",
      },
      {
        value: "none",
        label: "None (Local Only)",
        description: "AIを使わないローカル解析のみ",
      },
    ];

  return (
    <div className="absolute bottom-4 right-4 z-10">
      {/* Toggle Button - 最小限のUI */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 bg-gray-800/80 backdrop-blur-sm text-white text-xs rounded hover:bg-gray-700 transition-colors"
        title="AI Provider Settings (Developer)"
      >
        AI:{" "}
        {provider === "azure"
          ? "Azure"
          : provider === "openai"
          ? "OpenAI"
          : "None"}
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="absolute bottom-10 right-0 bg-black/90 backdrop-blur-sm rounded-lg p-4 text-white min-w-[280px] max-w-[320px] shadow-lg">
          <div className="mb-3">
            <h3 className="text-sm font-semibold mb-2">
              AI Provider (Developer)
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              使用するAIプロバイダーを選択します。デフォルトはAzure AIです。
            </p>
          </div>

          <div className="space-y-2">
            {providers.map((p) => (
              <label
                key={p.value}
                className="flex items-start gap-2 p-2 rounded hover:bg-gray-800 cursor-pointer"
              >
                <input
                  type="radio"
                  name="aiProvider"
                  value={p.value}
                  checked={provider === p.value}
                  onChange={() => setProvider(p.value)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-gray-400">{p.description}</div>
                </div>
              </label>
            ))}
          </div>

          {/* モデル選択 */}
          {provider === "azure" && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="mb-2">
                <label className="text-xs text-gray-400 mb-1 block">
                  Azure OpenAI デプロイメント:
                </label>
                <select
                  value={azureModel}
                  onChange={(e) => setAzureModel(e.target.value as AzureModel)}
                  className="w-full px-2 py-1.5 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:border-blue-500"
                >
                  {azureModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {provider === "openai" && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="mb-2">
                <label className="text-xs text-gray-400 mb-1 block">
                  OpenAI モデル:
                </label>
                <select
                  value={openaiModel}
                  onChange={(e) =>
                    setOpenAIModel(e.target.value as OpenAIModel)
                  }
                  className="w-full px-2 py-1.5 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:border-blue-500"
                >
                  {openaiModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400">
              <div className="mb-1">現在の設定:</div>
              <div className="font-mono text-white">
                {provider}
                {provider === "azure" && ` / ${azureModel}`}
                {provider === "openai" && ` / ${openaiModel}`}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="mt-3 w-full px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
