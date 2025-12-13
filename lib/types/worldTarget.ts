// WorldTarget type definition for v2
// See doc/v2-api-types.md for full specification

import type { Reflection } from "./reflection";

export type RenderMode = "meshOnly" | "full";
export type Mood = "calm" | "flow" | "pulse" | "wild";
export type BgStyle = "SoftGradient" | "Mist" | "DeepSpace" | "GlowField";

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

/**
 * Clamp WorldTarget values to valid ranges
 * See doc/v2-api-types.md for constraints
 */
export function clampWorldTarget(target: WorldTarget): WorldTarget {
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
      bgNoiseAmount: Math.max(0, Math.min(0.25, target.background.bgNoiseAmount)),
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


