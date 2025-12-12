import OpenAI from "openai";
import { z } from "zod";
import { useAIPlanStore } from "@/lib/stores/aiPlanStore";
import type { AudioTimeline, FerroAnimationPlan } from "@/lib/types";

// Zod schema for validation
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
  explanation: z.string().optional(), // AIが選んだカラーやパラメータの理由を説明
  encouragement: z.string().optional(), // ユーザーへの励ましメッセージ
  global: z.object({
    baseEnergy: z.number().min(0).max(1),
    baseTension: z.number().min(0).max(1),
    colorPalette: z.array(z.string()),
  }),
  sections: z.array(FerroAnimationSectionSchema),
});

export class AIPlannerModule {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    // Debug log
    console.log("[AIPlannerModule] Checking API key:", {
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey?.substring(0, 7) || "N/A",
      isPlaceholder: apiKey === "your_openai_api_key_here",
    });

    if (!apiKey || apiKey === "your_openai_api_key_here" || apiKey.trim() === "") {
      console.warn("[AIPlannerModule] NEXT_PUBLIC_OPENAI_API_KEY not found or not set");
      console.warn("[AIPlannerModule] Please set NEXT_PUBLIC_OPENAI_API_KEY in .env.local");
      console.warn("[AIPlannerModule] Make sure to restart the dev server after setting the key");
      return;
    }

    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // Note: In production, use API route instead
    });

    console.log("[AIPlannerModule] OpenAI client initialized successfully");
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }

  async generatePlan(
    audioTimeline: AudioTimeline,
    userMoodText: string = ""
  ): Promise<FerroAnimationPlan> {
    if (!this.openai) {
      const errorMessage = "OpenAI APIキーが設定されていません。.env.localファイルにNEXT_PUBLIC_OPENAI_API_KEYを設定してください。";
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
- Provide a thoughtful explanation (2-4 sentences) of why you chose the colors and parameters based on the music and user's mood. Match the language of the user's input (if English, respond in English; if Japanese, respond in Japanese).
- Provide an encouraging message (1-2 sentences) to the user, matching their language. Be warm, supportive, and natural. Examples: "Keep pushing forward, you've got this!" or "Great work today, take care!" for English; "あともう一踏ん張り頑張ってね！" or "今日もお疲れ様" for Japanese.

Constraints:
- Keep motion parameters subtle enough for a calm, relaxing experience.
- The explanation and encouragement should match the user's language and be warm and supportive.
- Make the messages feel natural and personalized based on the music and user's mood.
- Respond ONLY with valid JSON following the schema I will provide.`;

      const userPrompt = `Here is the audio timeline and the optional user mood text.

USER_MOOD_TEXT:
${userMoodText || "(none)"}

AUDIO_TIMELINE_JSON:
${JSON.stringify(audioTimeline, null, 2)}

Please respond ONLY with JSON following this schema:

{
  "overallMood": string,
  "explanation": string,        // 2-4 sentences explaining why you chose these colors and parameters based on the music and user's mood. Match the user's language (English or Japanese).
  "encouragement": string,      // 1-2 sentences of encouraging message to the user. Match the user's language and be warm and supportive.
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

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response content from OpenAI");
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
      const timelineDuration = audioTimeline.trackInfo.duration ||
        (audioTimeline.frames.length > 0
          ? audioTimeline.frames[audioTimeline.frames.length - 1].time
          : 0);

      if (validatedPlan.sections.length > 0) {
        const lastSection = validatedPlan.sections[validatedPlan.sections.length - 1];
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
      const errorMessage = error instanceof Error
        ? error.message
        : "AIプランの生成に失敗しました";

      useAIPlanStore.getState().setError(errorMessage);
      useAIPlanStore.getState().setIsGenerating(false);

      console.error("[AIPlannerModule] Error:", error);
      throw error;
    }
  }
}

