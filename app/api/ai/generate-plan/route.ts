import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import OpenAI from "openai";
import { z } from "zod";
import type { AudioTimeline, FerroAnimationPlan } from "@/lib/types";

export const runtime = "nodejs"; // Edgeだと一部SDKが詰まることがある

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
  explanation: z.string().optional(),
  encouragement: z.string().optional(),
  global: z.object({
    baseEnergy: z.number().min(0).max(1),
    baseTension: z.number().min(0).max(1),
    colorPalette: z.array(z.string()),
  }),
  sections: z.array(FerroAnimationSectionSchema),
});

console.log("[env]", {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  version: process.env.AZURE_OPENAI_API_VERSION,
  hasKey: !!process.env.AZURE_OPENAI_API_KEY,
});
/**
 * AIプラン生成用のAPIルート
 * サーバーサイドでのみ実行され、APIキーをブラウザに露出させない
 */
export async function POST(req: NextRequest) {
  try {
    // 環境変数の確認（リクエストごとにログ出力）
    console.log("[generate-plan] [env] Request-time env check:", {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      version: process.env.AZURE_OPENAI_API_VERSION,
      hasKey: !!process.env.AZURE_OPENAI_API_KEY,
    });

    console.log("[generate-plan] Request received");

    const body = await req.json();
    const { audioTimeline, userMoodText = "", provider = "azure", model } = body;

    console.log("[generate-plan] Request body:", {
      hasAudioTimeline: !!audioTimeline,
      timelineFrames: audioTimeline?.frames?.length || 0,
      provider,
      model,
      userMoodTextLength: userMoodText.length,
    });

    // タイムラインがない場合は空のタイムラインを作成（userMoodTextのみで生成可能）
    const finalTimeline: AudioTimeline = audioTimeline || {
      trackInfo: {
        source: "mic",
      },
      frames: [],
    };

    // タイムラインもuserMoodTextもない場合はエラー
    if (finalTimeline.frames.length === 0 && !userMoodText) {
      console.error("[generate-plan] Missing both audioTimeline and userMoodText");
      return NextResponse.json(
        { error: "Either audioTimeline or userMoodText is required" },
        { status: 400 }
      );
    }

    // プロンプトを組み立て（AIPlannerModuleと同じ）
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
${JSON.stringify(finalTimeline, null, 2)}

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

    let response;
    let content: string;

    if (provider === "azure") {
      // Azure OpenAI
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const apiKey = process.env.AZURE_OPENAI_API_KEY;
      const deployment =
        model || process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "ferro-gpt-4o-mini";
      const apiVersion =
        process.env.AZURE_OPENAI_API_VERSION || "2024-07-18";

      console.log("[generate-plan] Azure OpenAI config:", {
        hasEndpoint: !!endpoint,
        hasApiKey: !!apiKey,
        deployment,
        apiVersion,
        endpointPrefix: endpoint ? endpoint.substring(0, 30) + "..." : "not set",
      });

      if (!endpoint || !apiKey || !deployment) {
        const errorMsg = "Missing server env vars for Azure OpenAI.";
        console.error("[generate-plan]", errorMsg, {
          hasEndpoint: !!endpoint,
          hasApiKey: !!apiKey,
          hasDeployment: !!deployment,
        });
        return NextResponse.json(
          {
            error: errorMsg,
            details: {
              hasEndpoint: !!endpoint,
              hasApiKey: !!apiKey,
              hasDeployment: !!deployment,
            },
          },
          { status: 500 }
        );
      }

      const normalizedEndpoint = endpoint.endsWith("/")
        ? endpoint.slice(0, -1)
        : endpoint;

      console.log("[generate-plan] Creating Azure OpenAI client...");
      const client = new AzureOpenAI({
        apiKey,
        endpoint: normalizedEndpoint,
        apiVersion,
      });

      // 実際のリクエストURLを構築（デバッグ用）
      const expectedUrl = `${normalizedEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

      console.log("[generate-plan] Calling Azure OpenAI API with:", {
        deployment,
        endpoint: normalizedEndpoint,
        apiVersion,
        messagesCount: 2,
        expectedUrl, // 実際のリクエストURL
      });

      try {
        // Azure OpenAIでは、modelパラメータにデプロイメント名を指定
        response = await client.chat.completions.create({
          model: deployment, // deployment名をmodelパラメータに指定
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });

        console.log("[generate-plan] ✅ Azure OpenAI response received successfully");
        content = response.choices?.[0]?.message?.content ?? "";
        console.log("[generate-plan] Response content length:", content.length);
      } catch (apiError: unknown) {
        const error = apiError as { message?: string; code?: string; status?: number; statusText?: string };
        console.error("[generate-plan] Azure OpenAI API error:", {
          message: error.message,
          code: error.code,
          status: error.status,
          statusText: error.statusText,
          deployment,
          endpoint: normalizedEndpoint,
          apiVersion,
          requestUrl: `${normalizedEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
          fullError: apiError,
        });

        // 404エラーの場合、デプロイメント名が間違っている可能性がある
        if (error.status === 404) {
          const errorMsg = `デプロイメント "${deployment}" が見つかりません。Azure Portalで実際のデプロイメント名を確認してください。エンドポイント: ${normalizedEndpoint}`;
          console.error("[generate-plan]", errorMsg);
          throw new Error(errorMsg);
        }
        throw apiError;
      }
    } else if (provider === "openai") {
      // OpenAI API
      const apiKey = process.env.OPENAI_API_KEY;
      const modelName = model || "gpt-4o-mini";

      if (!apiKey) {
        return NextResponse.json(
          { error: "Missing server env var OPENAI_API_KEY." },
          { status: 500 }
        );
      }

      const client = new OpenAI({
        apiKey,
      });

      response = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      content = response.choices?.[0]?.message?.content ?? "";
    } else {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "No response content from AI" },
        { status: 500 }
      );
    }

    // Parse and validate JSON
    let jsonData: unknown;
    try {
      jsonData = JSON.parse(content);
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to parse JSON response: ${error}` },
        { status: 500 }
      );
    }

    // Validate with Zod
    let validatedPlan: FerroAnimationPlan;
    try {
      validatedPlan = FerroAnimationPlanSchema.parse(jsonData);
    } catch (error) {
      return NextResponse.json(
        { error: `Validation failed: ${error}` },
        { status: 500 }
      );
    }

    // Additional validation: ensure sections cover the timeline
    const timelineDuration =
      finalTimeline.trackInfo.duration ||
      (finalTimeline.frames.length > 0
        ? finalTimeline.frames[finalTimeline.frames.length - 1].time
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

    console.log("[generate-plan] ✅✅✅ AI Plan generated successfully! ✅✅✅");
    console.log("[generate-plan] Plan details:", {
      overallMood: validatedPlan.overallMood,
      sections: validatedPlan.sections.length,
      hasExplanation: !!validatedPlan.explanation,
      hasEncouragement: !!validatedPlan.encouragement,
    });

    return NextResponse.json({ plan: validatedPlan }, { status: 200 });
  } catch (e: unknown) {
    const error = e as { message?: string; stack?: string; name?: string; cause?: unknown };
    console.error("[generate-plan] error", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    });

    const errorMessage = error.message || "Failed to generate plan.";
    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? {
          stack: error.stack,
          name: error.name,
        } : undefined,
      },
      { status: 500 }
    );
  }
}
