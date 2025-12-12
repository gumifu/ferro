import OpenAI from "openai";
import { z } from "zod";
import type { Reflection, AudioSummary } from "@/lib/types/reflection";

// Zod schema for Reflection validation
const ReflectionSchema = z.object({
  tone: z.enum(["calm", "neutral", "pulse", "wild"]),
  reason: z.string().min(10), // 選定理由: なぜこのtoneが選ばれたかの説明
  message: z.string().min(20).max(150), // 60-120 chars recommended, but allow some margin for validation
});

export class ReflectionModule {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    if (!apiKey || apiKey === "your_openai_api_key_here" || apiKey.trim() === "") {
      console.warn("[ReflectionModule] NEXT_PUBLIC_OPENAI_API_KEY not found or not set");
      return;
    }

    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // Note: In production, use API route instead
    });

    console.log("[ReflectionModule] OpenAI client initialized successfully");
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Generate a Reflection from audio summary
   * Returns a "mirror" of the listener's state, not a character or advice
   */
  async generateReflection(summary: AudioSummary): Promise<Reflection> {
    if (!this.openai) {
      throw new Error(
        "OpenAI API key is not set. Please set NEXT_PUBLIC_OPENAI_API_KEY in .env.local"
      );
    }

    const systemPrompt = this.buildSystemPrompt(summary.uiLanguage);
    const userPrompt = this.buildUserPrompt(summary);

    try {
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

      // Validate with Zod (lenient minimum for initial validation)
      let validatedReflection: Reflection;
      try {
        validatedReflection = ReflectionSchema.parse(jsonData);
      } catch (error) {
        // If validation fails, log and try to fix
        console.warn("[ReflectionModule] Zod validation failed, attempting to fix:", error);
        const parsed = jsonData as { tone?: string; reason?: string; message?: string };
        if (!parsed.message || parsed.message.length < 20) {
          throw new Error(
            `Reflection message is too short (${parsed.message?.length || 0} chars, minimum 20)`
          );
        }
        validatedReflection = {
          tone: (parsed.tone as Reflection["tone"]) || "neutral",
          reason: parsed.reason || "",
          message: parsed.message || "",
        };
      }

      // Additional validation: check message length and content
      this.validateReflectionMessage(validatedReflection.message, summary.uiLanguage);

      // Final validation and clamp
      return this.validateReflection(validatedReflection, summary.uiLanguage);
    } catch (error) {
      console.error("[ReflectionModule] Error generating reflection:", error);
      throw error;
    }
  }

  private buildSystemPrompt(uiLanguage: "en" | "ja"): string {
    const basePrompt = `You are generating a "Reflection" - a quiet mirror of the listener's state, inferred from sound, time, and change.

CRITICAL RULES (ABSOLUTE):

1. The reflection is NOT a character.
   - It does NOT speak as "I" or "You"
   - It is NOT ferro's voice
   - It is NOT AI's statement
   - It is NOT explanation or instruction

2. Language Rule:
   - Reflection messages must match the UI language: ${uiLanguage === "en" ? "English" : "Japanese"}
   - Do NOT mix languages within a single reflection

3. Subject Rules:
   FORBIDDEN: I, You, We, ferro, any character-like subjects
   ALLOWED: The sound, The rhythm, Things, The space, The world

4. No Commands/Advice/Evaluation:
   FORBIDDEN: should, need to, try to, advice, good/bad judgments
   Example FORBIDDEN: "You should relax." / "This is better now."
   Example ALLOWED: "Nothing is being rushed." / "The pace softened."

5. Emotion Words:
   FORBIDDEN (principle): happy, sad, stressed, anxious
   ALLOWED (abstract/physical): quiet, heavy, light, steady, thin, dense, slow, sudden, soft
   → Describe "state", not "emotion"

6. Length & Structure:
   - THREE sentences (approximately)
   - Minimum 60 characters for English, 40 characters for Japanese
   - Maximum 120 characters for English, 100 characters for Japanese
   - Each sentence should be short and concise
   - No explanation
   - Minimal metaphors
   - IMPORTANT: The message MUST be at least 60 characters (English) or 40 characters (Japanese)

7. Output Format:
   - Return ONLY valid JSON
   - NO mixed text and JSON
   - NO explanations outside JSON

The reflection is not guidance. It leaves space for interpretation.

IMPORTANT: You must return TWO separate fields:
1. "reason": A brief explanation (1-2 sentences) of why this tone was selected based on the audio characteristics. This is for internal understanding and can be more technical/explanatory.
2. "message": The actual reflection message that will be displayed to the user. This MUST follow all the rules above (no "I"/"You", no commands, state-based language, etc.).

Return ONLY this JSON structure:
{
  "tone": "calm" | "neutral" | "pulse" | "wild",
  "reason": "brief explanation of why this tone was selected (1-2 sentences, can be technical)",
  "message": "three sentences (approximately) following all rules above - this is what users will see"
}`;

    return basePrompt;
  }

  private buildUserPrompt(summary: AudioSummary): string {
    const lang = summary.uiLanguage === "en" ? "English" : "Japanese";

    return `Generate a Reflection in ${lang} based on this audio summary:

AUDIO SUMMARY:
- Duration: ${summary.duration.toFixed(1)}s
- Average volume (RMS): ${summary.avgRms.toFixed(2)}
- Peak volume: ${summary.maxRms.toFixed(2)}
- Average bass: ${summary.avgBass.toFixed(2)}
- Average mid: ${summary.avgMid.toFixed(2)}
- Average treble: ${summary.avgTreble.toFixed(2)}
- Change rate (flux): ${summary.flux.toFixed(2)}
${summary.userMoodText ? `- User mood: ${summary.userMoodText}` : ""}

Return ONLY valid JSON with TWO fields:
{
  "tone": "calm" | "neutral" | "pulse" | "wild",
  "reason": "brief explanation (1-2 sentences in ${lang}) of why this tone was selected based on the audio characteristics. This can be technical/explanatory.",
  "message": "three sentences (approximately) in ${lang}, following all language rules. Minimum length: ${summary.uiLanguage === "en" ? "60" : "40"} characters. Maximum length: ${summary.uiLanguage === "en" ? "120" : "100"} characters. This is what users will see."
}`;
  }

  private validateReflectionMessage(message: string, uiLanguage: "en" | "ja"): void {
    // Check for forbidden words
    const forbiddenWords = ["I ", "You ", "We ", "ferro", "should", "need to", "try to"];
    const found = forbiddenWords.find((word) => message.includes(word));
    if (found) {
      console.warn(`[ReflectionModule] Warning: Message contains forbidden word: ${found}`);
    }

    // Check length (approximate: Japanese chars are usually wider)
    const charCount = message.length;
    const recommendedMinChars = uiLanguage === "ja" ? 40 : 60;
    const recommendedMaxChars = uiLanguage === "ja" ? 100 : 120;

    // Warn if too short (but don't reject - allow some flexibility)
    if (charCount < recommendedMinChars) {
      console.warn(
        `[ReflectionModule] Warning: Message is shorter than recommended (${charCount} chars, recommended min ${recommendedMinChars})`
      );
    }
    if (charCount > recommendedMaxChars) {
      console.warn(
        `[ReflectionModule] Warning: Message is longer than recommended (${charCount} chars, recommended max ${recommendedMaxChars})`
      );
    }
  }

  private validateReflection(reflection: Reflection, uiLanguage: "en" | "ja"): Reflection {
    // Clamp tone to valid values
    const validTones: Reflection["tone"][] = ["calm", "neutral", "pulse", "wild"];
    const tone = validTones.includes(reflection.tone)
      ? reflection.tone
      : "neutral";

    return {
      tone,
      reason: reflection.reason?.trim() || "",
      message: reflection.message.trim(),
    };
  }
}


