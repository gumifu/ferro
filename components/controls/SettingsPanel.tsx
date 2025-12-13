"use client";

import { useState } from "react";
import { useAIProviderStore } from "@/lib/stores/aiProviderStore";
import type {
  AIProvider,
  AzureModel,
  OpenAIModel,
} from "@/lib/stores/aiProviderStore";

/**
 * Settings Panel Component
 * 設定画面 - AI Provider Settingsを含む
 *
 * 注意: 仕様書に従い、UIは最小限に
 * ユーザーはAIの存在を意識しなくてよい
 */
export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    provider,
    azureModel,
    openaiModel,
    setProvider,
    setAzureModel,
    setOpenAIModel,
  } = useAIProviderStore();

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

  // Azure OpenAI用のモデルリスト
  const azureModels: { value: AzureModel; label: string }[] = [
    { value: "ferro-gpt-4o-mini", label: "ferro-gpt-4o-mini (Default)" },
    { value: "gpt-4o-mini-2", label: "gpt-4o-mini-2" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
  ];

  // OpenAI API用のモデルリスト
  const openaiModels: { value: OpenAIModel; label: string }[] = [
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4-turbo", label: "gpt-4-turbo" },
  ];

  return (
    <div className="absolute top-4 right-4 z-10">
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 bg-gray-800/80 backdrop-blur-sm text-white text-xs rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
        title="Settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Settings
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Settings Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/95 backdrop-blur-sm rounded-lg p-6 text-white min-w-[400px] max-w-[500px] shadow-2xl border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* AI Provider Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 text-gray-300">
                AI Provider (Developer)
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                使用するAIプロバイダーを選択します。デフォルトはAzure AIです。
              </p>

              <div className="space-y-2 mb-4">
                {providers.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-start gap-3 p-3 rounded hover:bg-gray-800 cursor-pointer border border-transparent hover:border-gray-700 transition-colors"
                  >
                    <input
                      type="radio"
                      name="aiProvider"
                      value={p.value}
                      checked={provider === p.value}
                      onChange={() => setProvider(p.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {p.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* モデル選択 */}
              {provider === "azure" && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <label className="text-xs text-gray-400 mb-2 block">
                    Azure OpenAI デプロイメント:
                  </label>
                  <select
                    value={azureModel}
                    onChange={(e) =>
                      setAzureModel(e.target.value as AzureModel)
                    }
                    className="w-full px-3 py-2 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-colors"
                  >
                    {azureModels.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {provider === "openai" && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <label className="text-xs text-gray-400 mb-2 block">
                    OpenAI モデル:
                  </label>
                  <select
                    value={openaiModel}
                    onChange={(e) =>
                      setOpenAIModel(e.target.value as OpenAIModel)
                    }
                    className="w-full px-3 py-2 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-colors"
                  >
                    {openaiModels.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 現在の設定表示 */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-400">
                  <div className="mb-1">現在の設定:</div>
                  <div className="font-mono text-white text-sm">
                    {provider}
                    {provider === "azure" && ` / ${azureModel}`}
                    {provider === "openai" && ` / ${openaiModel}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

