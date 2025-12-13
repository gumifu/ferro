import { create } from "zustand";

export type AIProvider = "azure" | "openai" | "none";

// Azure OpenAI用のデプロイメント名
export type AzureModel = "gpt-4o-mini-2" | "gpt-4o-mini" | string;

// OpenAI API用のモデル名
export type OpenAIModel = "gpt-4o-mini" | "gpt-4o" | "gpt-4-turbo" | string;

interface AIProviderStore {
  provider: AIProvider;
  azureModel: AzureModel;
  openaiModel: OpenAIModel;
  setProvider: (provider: AIProvider) => void;
  setAzureModel: (model: AzureModel) => void;
  setOpenAIModel: (model: OpenAIModel) => void;
}

// デフォルトモデル（環境変数はサーバーサイドのみなので、クライアント側では固定値を使用）
const defaultAzureModel: AzureModel = "gpt-4o-mini";
const defaultOpenAIModel: OpenAIModel = "gpt-4o-mini";

export const useAIProviderStore = create<AIProviderStore>((set) => ({
  provider: "azure", // デフォルトはAzure AI
  azureModel: defaultAzureModel,
  openaiModel: defaultOpenAIModel,
  setProvider: (provider) => set({ provider }),
  setAzureModel: (model) => set({ azureModel: model }),
  setOpenAIModel: (model) => set({ openaiModel: model }),
}));

