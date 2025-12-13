import type { AudioTimeline, FerroAnimationPlan } from "@/lib/types";
import { useAIProviderStore } from "@/lib/stores/aiProviderStore";
import { useAIPlanStore } from "@/lib/stores/aiPlanStore";

/**
 * AI Planner Factory
 * 常にAPI Route経由でAIプランを生成する
 * 本番環境と開発環境で同じ実装を使用
 */
export class AIPlannerFactory {
  /**
   * プランを生成（常にAPI Route経由）
   */
  async generatePlan(
    audioTimeline: AudioTimeline,
    userMoodText: string = ""
  ): Promise<FerroAnimationPlan | null> {
    const { provider, azureModel, openaiModel } = useAIProviderStore.getState();

    // AI providerが"none"の場合はスキップ
    if (provider === "none") {
      console.log("[AIPlannerFactory] AI provider is set to 'none', skipping AI plan generation");
      return null;
    }

    useAIPlanStore.getState().setIsGenerating(true);
    useAIPlanStore.getState().setError(null);

    try {
      const model = provider === "azure" ? azureModel : openaiModel;

      console.log("[AIPlannerFactory] Calling API route:", {
        url: "/api/ai/generate-plan",
        provider,
        model,
        hasTimeline: !!audioTimeline,
        timelineFrames: audioTimeline?.frames?.length || 0,
      });

      const response = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioTimeline,
          userMoodText,
          provider,
          model,
        }),
      });

      console.log("[AIPlannerFactory] API response:", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
      });

      let data: any;

      if (!response.ok) {
        // まずテキストとして取得して、JSONパースを試みる
        const responseText = await response.text();
        console.error("[AIPlannerFactory] API error response text:", responseText);

        let errorData: any = {};
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          // JSON解析に失敗した場合、テキストをそのまま使用
          errorData = {
            error: responseText || response.statusText,
            rawText: responseText,
          };
        }

        console.error("[AIPlannerFactory] API error details:", {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });

        throw new Error(
          errorData.error || `API request failed: ${response.status} ${response.statusText}`
        );
      }

      // 成功時のみJSONをパース
      data = await response.json();

      if (!data.plan) {
        throw new Error("No plan in response");
      }

      console.log("[AIPlannerFactory] ✅✅✅ AI Plan received successfully! ✅✅✅");
      console.log("[AIPlannerFactory] Plan summary:", {
        overallMood: data.plan.overallMood,
        sections: data.plan.sections?.length || 0,
        hasExplanation: !!data.plan.explanation,
        hasEncouragement: !!data.plan.encouragement,
      });

      useAIPlanStore.getState().setPlan(data.plan);
      useAIPlanStore.getState().setIsGenerating(false);

      return data.plan;
    } catch (error: any) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "AIプランの生成に失敗しました";

      useAIPlanStore.getState().setError(errorMessage);
      useAIPlanStore.getState().setIsGenerating(false);

      console.error("[AIPlannerFactory] Error:", error);
      throw error;
    }
  }

  /**
   * 現在のプロバイダーが利用可能かチェック
   * API Route経由なので、常にtrueを返す（実際のチェックはAPI Route側で行う）
   */
  isAvailable(): boolean {
    const { provider } = useAIProviderStore.getState();
    return provider !== "none";
  }
}

