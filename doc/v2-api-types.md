# ferro v2 API 型定義

## WorldTarget 型（AI 出力フォーマット）

### TypeScript 型定義

```typescript
type RenderMode = "meshOnly" | "full";
type Mood = "calm" | "flow" | "pulse" | "wild";
type BgStyle = "SoftGradient" | "Mist" | "DeepSpace" | "GlowField";

export type Reflection = {
  tone: "calm" | "neutral" | "pulse" | "wild";
  message: string; // one sentence, rules applied (see v2-reflection-rules.md)
};

export type WorldTarget = {
  version: "v2";
  renderMode: RenderMode;
  mood: Mood;

  transitionSeconds: number; // 5..20
  reflection?: Reflection; // optional, shown only on world change

  ferro: {
    baseColor: string; // "#RRGGBB"
    accentColor?: string; // "#RRGGBB"
    saturation: number; // 0..0.7
    roughness: number; // 0..1
    metalness: number; // 0..1
    envIntensity: number; // 0..2

    deformStrength: number; // 0..1
    deformScale: number; // 0.5..3
    deformSpeed: number; // 0..2

    swayAmount: number; // 0..1
    swaySpeed: number; // 0..1.5
    pulseAmount: number; // 0..1

    gravityStrength: number; // 0..1
    attractStrength: number; // 0..1
  };

  background: {
    bgStyle: BgStyle;
    bgGradientA: string; // "#RRGGBB"
    bgGradientB: string; // "#RRGGBB"
    bgNoiseAmount: number; // 0..0.25
    bgFogDensity: number; // 0..0.8
    bgVignette: number; // 0..0.8
    bgMotion: number; // 0..1

    bloomIntensity: number; // 0..1.2
    grainAmount: number; // 0..0.35
  };
};
```

## 制約（Three 側で必ず Clamp）

- 彩度・Bloom・Grain・Fog には上限を設ける
- `transitionSeconds`は最低 5 秒
- `renderMode=meshOnly`のときは背景/FX の上限をさらに下げる

## バリデーション関数例

````typescript
function clampWorldTarget(target: WorldTarget): WorldTarget {
  return {
    ...target,
    transitionSeconds: Math.max(5, Math.min(20, target.transitionSeconds)),
    ferro: {
      ...target.ferro,
      saturation: Math.max(0, Math.min(0.7, target.ferro.saturation)),
      roughness: Math.max(0, Math.min(1, target.ferro.roughness)),
      metalness: Math.max(0, Math.min(1, target.ferro.metalness)),
      envIntensity: Math.max(0, Math.min(2, target.ferro.envIntensity)),
      deformStrength: Math.max(0, Math.min(1, target.ferro.deformStrength)),
      deformScale: Math.max(0.5, Math.min(3, target.ferro.deformScale)),
      deformSpeed: Math.max(0, Math.min(2, target.ferro.deformSpeed)),
      swayAmount: Math.max(0, Math.min(1, target.ferro.swayAmount)),
      swaySpeed: Math.max(0, Math.min(1.5, target.ferro.swaySpeed)),
      pulseAmount: Math.max(0, Math.min(1, target.ferro.pulseAmount)),
      gravityStrength: Math.max(0, Math.min(1, target.ferro.gravityStrength)),
      attractStrength: Math.max(0, Math.min(1, target.ferro.attractStrength)),
    },
    background: {
      ...target.background,
      bgNoiseAmount: Math.max(
        0,
        Math.min(0.25, target.background.bgNoiseAmount)
      ),
      bgFogDensity: Math.max(0, Math.min(0.8, target.background.bgFogDensity)),
      bgVignette: Math.max(0, Math.min(0.8, target.background.bgVignette)),
      bgMotion: Math.max(0, Math.min(1, target.background.bgMotion)),
      bloomIntensity:
        target.renderMode === "meshOnly"
          ? Math.max(0, Math.min(0.5, target.background.bloomIntensity))
          : Math.max(0, Math.min(1.2, target.background.bloomIntensity)),
      grainAmount:
        target.renderMode === "meshOnly"
          ? Math.max(0, Math.min(0.15, target.background.grainAmount))
          : Math.max(0, Math.min(0.35, target.background.grainAmount)),
    },
  };
}

## Reflection バリデーション関数

```typescript
import type { Reflection } from "@/lib/types/reflection";

function validateReflection(reflection: Reflection, uiLanguage: "en" | "ja"): Reflection {
  // Check message length (warnings only, allow flexibility)
  const charCount = reflection.message.length;
  const recommendedMinChars = uiLanguage === "ja" ? 40 : 60;
  const recommendedMaxChars = uiLanguage === "ja" ? 100 : 120; // Japanese chars are typically wider

  if (charCount < recommendedMinChars) {
    console.warn(
      `[Reflection] Warning: Message is shorter than recommended (${charCount} chars, recommended min ${recommendedMinChars})`
    );
  }
  if (charCount > recommendedMaxChars) {
    console.warn(
      `[Reflection] Warning: Message is longer than recommended (${charCount} chars, recommended max ${recommendedMaxChars})`
    );
  }

  // Check for forbidden words (warning only, don't reject)
  const forbiddenWords = ["I ", "You ", "We ", "ferro", "should", "need to", "try to"];
  const found = forbiddenWords.find((word) => reflection.message.includes(word));
  if (found) {
    console.warn(`[Reflection] Warning: Message contains forbidden word: ${found}`);
  }

  // Clamp tone to valid values
  const validTones: Reflection["tone"][] = ["calm", "neutral", "pulse", "wild"];
  const tone = validTones.includes(reflection.tone)
    ? reflection.tone
    : "neutral";

  return {
    tone,
    message: reflection.message.trim(),
  };
}
````
