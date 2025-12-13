import { AzureOpenAI } from "openai";
import { z } from "zod";
import { useAIPlanStore } from "@/lib/stores/aiPlanStore";
import type { AudioTimeline, FerroAnimationPlan } from "@/lib/types";

// Zod schema for validation (AIPlannerModuleと同じ)
const FerroAnimationSectionSchema = z.object({
  name: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  energy: z.number().min(0).max(1),
  tension: z.number().min(0).max(1),
  motionStyle: z.string(),
  spikeAmount: z.number().min(0).max(1),
  noiseAmount: z.number().min(0).max(1),
  colorPalette: z.array(z.string()),
});

const FerroAnimationPlanSchema = z.object({
  overallMood: z.string(),
  explanation: z.string().optional(),
  encouragement: z.string().optional(),
  global: z.object({
    baseEnergy: z.number().min(0).max(1),
    baseTension: z.number().min(0).max(1),
    colorPalette: z.array(z.string()),
  }),
  sections: z.array(FerroAnimationSectionSchema),
});

/**
 * Azure OpenAI Planner Module
 * Azure OpenAIを使用してアニメーションプランを生成
 *
 * 注意: ferroは感情をラベリングしない
 * AIは判断・発話しない。音の状態を抽象化し、視覚パラメータに変換するのみ
 */
export class AzureAIPlannerModule {
  private client: AzureOpenAI | null = null;
  private defaultDeploymentName: string = "";

  constructor(deploymentName?: string) {
    const endpoint = process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY;
    const deployment =
      deploymentName ||
      process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME ||
      "gpt-4o-mini-2";

    if (!endpoint || !apiKey) {
      console.warn(
        "[AzureAIPlannerModule] Azure OpenAI credentials not found. " +
        "Please set NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT and NEXT_PUBLIC_AZURE_OPENAI_API_KEY in .env.local"
      );
      return;
    }

    try {
      // Azure OpenAI用の設定
      // エンドポイントの末尾スラッシュを正規化
      const normalizedEndpoint = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;

      // AzureOpenAIクラスを使用（APIキー認証）
      // エンドポイントは https://{resource-name}.openai.azure.com または
      // https://{resource-name}.cognitiveservices.azure.com の形式
      // 注意: 本番環境ではAPIルート経由で呼び出すことを推奨
      this.client = new AzureOpenAI({
        endpoint: normalizedEndpoint,
        apiKey: apiKey,
        apiVersion: "2024-02-15-preview",
        dangerouslyAllowBrowser: true, // 開発環境のみ。本番ではAPIルート経由を推奨
      });
      this.defaultDeploymentName = deployment;
      console.log("[AzureAIPlannerModule] Azure OpenAI client initialized successfully", {
        endpoint: normalizedEndpoint,
        deployment,
      });
    } catch (error) {
      console.error("[AzureAIPlannerModule] Initialization error:", error);
    }
  }

  /**
   * デプロイメント名を取得（動的に変更可能）
   */
  getDeploymentName(): string {
    return this.defaultDeploymentName;
  }

  /**
   * デプロイメント名を設定
   */
  setDeploymentName(deploymentName: string): void {
    this.defaultDeploymentName = deploymentName;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generatePlan(
    audioTimeline: AudioTimeline,
    userMoodText: string = ""
  ): Promise<FerroAnimationPlan> {
    if (!this.client) {
      const errorMessage =
        "Azure OpenAI APIキーが設定されていません。.env.localファイルにNEXT_PUBLIC_AZURE_OPENAI_ENDPOINTとNEXT_PUBLIC_AZURE_OPENAI_API_KEYを設定してください。";
      useAIPlanStore.getState().setError(errorMessage);
      throw new Error(errorMessage);
    }

    useAIPlanStore.getState().setIsGenerating(true);
    useAIPlanStore.getState().setError(null);

    try {
      const systemPrompt = `You are a motion designer for a ferrofluid-like 3D sculpture called "ferro".

ferro has no personality, does not talk, and never shows text to the user.
The user will listen to music or ambient sound, and ferro silently reacts to it.

Your job:
- Analyze the given simple audio timeline (volume, bass, treble over time).
- Optionally use the user's mood text to refine the interpretation.
- Design a high-level animation plan for the sculpture:
  - overall mood description
  - 3-6 time sections (intro, build, peak, outro, etc.)
  - parameters for each section that control motion and colors.
- Provide TWO separate messages:
  1. "explanation" (1-2 sentences): Explain why you chose the overall mood based on the music characteristics (low bass strength, calm volume changes, etc.). Focus on the mood selection reason, not on "accompanying the user's feelings". Match the language of the user's input (if English, respond in English; if Japanese, respond in Japanese). IMPORTANT: Never use phrases like "あなたの気持ちに寄り添うためには" (to accompany your feelings) or "ユーザー" (user) in Japanese - always use "あなた" (you) instead. Keep it technical and objective about the music analysis.
  2. "encouragement" (2-4 sentences): Provide an encouraging message to the listener, matching their language. The message should adapt to the listener's emotional state (joy, anger, sadness, excitement, etc.) while maintaining variety and avoiding monotony. Be warm, supportive, and natural. Expand on the listener's situation, acknowledge their feelings authentically, and offer genuine encouragement that matches their emotional tone. IMPORTANT: Never use the word "ユーザー" (user) in Japanese messages - always use "あなた" (you) instead.
  - For joy/happiness: Celebrate with them, acknowledge their positive energy
  - For sadness/melancholy: Offer comfort and understanding, validate their feelings
  - For anger/frustration: Acknowledge their feelings, suggest calm and perspective
  - For excitement/energy: Match their energy, encourage their enthusiasm
  - For calm/peace: Appreciate the moment, encourage mindfulness
  - Vary the tone and approach to avoid repetition - each message should feel fresh and personalized.

Constraints:
- Keep motion parameters subtle enough for a calm, relaxing experience.
- The explanation should focus on WHY the mood was chosen based on music analysis, NOT on "accompanying user's feelings".
- The encouragement should match the user's language and be warm and supportive.
- Make the messages feel natural and personalized based on the music and user's mood.
- NEVER use phrases like "あなたの気持ちに寄り添うためには" (to accompany your feelings) in the explanation.
- Respond ONLY with valid JSON following the schema I will provide.`;

      const userPrompt = `Here is the audio timeline and the optional user mood text.

USER_MOOD_TEXT:
${userMoodText || "(none)"}

AUDIO_TIMELINE_JSON:
${JSON.stringify(audioTimeline, null, 2)}

Please respond ONLY with JSON following this schema:

{
  "overallMood": string,
  "explanation": string,        // 1-2 sentences explaining why you chose the overall mood based on music characteristics (e.g., "低音の強さと穏やかなボリュームの変化に基づいて、落ち着いた青と緑の色合いを選びました"). Focus on mood selection reason, NOT on "accompanying user's feelings". Match the user's language (English or Japanese). IMPORTANT: Never use phrases like "あなたの気持ちに寄り添うためには" or "ユーザー" (user) in Japanese - always use "あなた" (you) instead. Keep it technical and objective.
  "encouragement": string,      // 2-4 sentences of encouraging message to the listener. Match the user's language and adapt to their emotional state (joy, anger, sadness, excitement, etc.) while maintaining variety. Be warm, supportive, and detailed. Expand on the listener's situation, acknowledge their feelings authentically, and offer genuine encouragement that matches their emotional tone. Avoid monotony - vary the tone and approach. IMPORTANT: Never use "ユーザー" (user) in Japanese - always use "あなた" (you).
  "global": {
    "baseEnergy": number,        // 0-1
    "baseTension": number,       // 0-1
    "colorPalette": string[]     // hex colors, 2-4 items
  },
  "sections": [
    {
      "name": string,
      "startTime": number,       // seconds
      "endTime": number,         // seconds
      "energy": number,          // 0-1
      "tension": number,         // 0-1
      "motionStyle": string,     // e.g. "slow_waves", "spikes"
      "spikeAmount": number,     // 0-1
      "noiseAmount": number,     // 0-1
      "colorPalette": string[]   // hex colors
    }
  ]
}`;

      // Azure OpenAIでは、modelパラメータにデプロイメント名を指定
      const deploymentName = this.getDeploymentName();
      const response = await this.client.chat.completions.create({
        model: deploymentName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response content from Azure OpenAI");
      }

      // Parse and validate JSON
      let jsonData: unknown;
      try {
        jsonData = JSON.parse(content);
      } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error}`);
      }

      // Validate with Zod
      const validatedPlan = FerroAnimationPlanSchema.parse(jsonData);

      // Additional validation: ensure sections cover the timeline
      const timelineDuration =
        audioTimeline.trackInfo.duration ||
        (audioTimeline.frames.length > 0
          ? audioTimeline.frames[audioTimeline.frames.length - 1].time
          : 0);

      if (validatedPlan.sections.length > 0) {
        const lastSection =
          validatedPlan.sections[validatedPlan.sections.length - 1];
        if (lastSection.endTime < timelineDuration) {
          // Extend last section to cover full timeline
          validatedPlan.sections[validatedPlan.sections.length - 1] = {
            ...lastSection,
            endTime: timelineDuration,
          };
        }
      }

      useAIPlanStore.getState().setPlan(validatedPlan);
      useAIPlanStore.getState().setIsGenerating(false);

      return validatedPlan;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Azure AIプランの生成に失敗しました";

      useAIPlanStore.getState().setError(errorMessage);
      useAIPlanStore.getState().setIsGenerating(false);

      console.error("[AzureAIPlannerModule] Error:", error);
      throw error;
    }
  }
}

