// TransitionEngine: Smooth transitions using GSAP
// See doc/v2-specification.md section 6 and doc/v2-implementation-guide.md Task 2

import { gsap } from "gsap";
import type { WorldTarget } from "@/lib/types/worldTarget";
import * as THREE from "three";

export type WorldState = {
  renderMode: WorldTarget["renderMode"];
  mood: WorldTarget["mood"];
  ferro: WorldTarget["ferro"];
  background: WorldTarget["background"];
};

/**
 * TransitionEngine manages smooth transitions from current WorldState to WorldTarget
 * Uses GSAP for smooth, controlled animations with easing
 */
export class TransitionEngine {
  private currentState: WorldState;
  private activeTweens: Map<string, gsap.core.Tween> = new Map();
  private onStateUpdate?: (state: WorldState) => void;

  constructor(initialState: WorldState, onStateUpdate?: (state: WorldState) => void) {
    this.currentState = { ...initialState };
    this.onStateUpdate = onStateUpdate;
  }

  /**
   * Get current world state
   */
  getCurrentState(): Readonly<WorldState> {
    return { ...this.currentState };
  }

  /**
   * Transition to a new WorldTarget
   * Cancels any ongoing transitions and starts new ones
   */
  transitionTo(target: WorldTarget): void {
    // Kill all existing tweens
    this.activeTweens.forEach((tween) => tween.kill());
    this.activeTweens.clear();

    const duration = target.transitionSeconds;
    const previousMood = this.currentState.mood;

    // Determine easing based on mood transition
    // wild→calm transitions are slower and smoother
    let ease: string = "power2.inOut";
    let actualDuration = duration;

    if (previousMood === "wild" && target.mood === "calm") {
      // Slower return from wild to calm (12-20 seconds)
      actualDuration = Math.max(12, Math.min(20, duration * 1.5));
      ease = "power1.out"; // Slower, smoother easing
    } else if (target.mood === "wild") {
      // Faster transition to wild
      ease = "power2.out";
    }

    // Transition ferro parameters
    this.transitionFerroParams(target.ferro, actualDuration, ease);

    // Transition background parameters (slower than ferro)
    // Background changes should be slower to avoid "world rushing ahead"
    const bgDuration = actualDuration * 1.2; // 20% slower
    this.transitionBackgroundParams(target.background, bgDuration, ease);

    // Update renderMode and mood immediately (these are discrete values)
    this.currentState.renderMode = target.renderMode;
    this.currentState.mood = target.mood;

    // Notify state update
    this.onStateUpdate?.(this.currentState);
  }

  /**
   * Transition ferro parameters
   */
  private transitionFerroParams(
    targetFerro: WorldTarget["ferro"],
    duration: number,
    ease: string
  ): void {
    const currentFerro = this.currentState.ferro;

    // Color transitions (HSV interpolation for smoother color changes)
    this.transitionColor(
      "ferro.baseColor",
      currentFerro.baseColor,
      targetFerro.baseColor,
      duration,
      ease
    );

    if (targetFerro.accentColor) {
      this.transitionColor(
        "ferro.accentColor",
        currentFerro.accentColor || currentFerro.baseColor,
        targetFerro.accentColor,
        duration,
        ease
      );
    }

    // Numeric parameters
    const numericParams: Array<keyof typeof targetFerro> = [
      "saturation",
      "roughness",
      "metalness",
      "envIntensity",
      "deformStrength",
      "deformScale",
      "deformSpeed",
      "swayAmount",
      "swaySpeed",
      "pulseAmount",
      "gravityStrength",
      "attractStrength",
    ];

    numericParams.forEach((param) => {
      if (typeof targetFerro[param] === "number") {
        const key = `ferro.${param}`;
        const tween = gsap.to(this.currentState.ferro, {
          [param]: targetFerro[param],
          duration,
          ease,
          onUpdate: () => {
            this.onStateUpdate?.(this.currentState);
          },
        });
        this.activeTweens.set(key, tween);
      }
    });
  }

  /**
   * Transition background parameters
   */
  private transitionBackgroundParams(
    targetBg: WorldTarget["background"],
    duration: number,
    ease: string
  ): void {
    const currentBg = this.currentState.background;

    // Background style is discrete, update immediately
    this.currentState.background.bgStyle = targetBg.bgStyle;

    // Color transitions
    this.transitionColor(
      "background.bgGradientA",
      currentBg.bgGradientA,
      targetBg.bgGradientA,
      duration,
      ease
    );

    this.transitionColor(
      "background.bgGradientB",
      currentBg.bgGradientB,
      targetBg.bgGradientB,
      duration,
      ease
    );

    // Numeric parameters
    // Fog and Bloom have minimum transition times (8 seconds)
    const fogDuration = Math.max(8, duration);
    const bloomDuration = Math.max(8, duration);

    const numericParams: Array<keyof typeof targetBg> = [
      "bgNoiseAmount",
      "bgFogDensity",
      "bgVignette",
      "bgMotion",
      "bloomIntensity",
      "grainAmount",
    ];

    numericParams.forEach((param) => {
      if (typeof targetBg[param] === "number") {
        const key = `background.${param}`;
        // Use longer duration for fog and bloom
        const paramDuration =
          param === "bgFogDensity" || param === "bloomIntensity"
            ? fogDuration
            : duration;

        const tween = gsap.to(this.currentState.background, {
          [param]: targetBg[param],
          duration: paramDuration,
          ease,
          onUpdate: () => {
            this.onStateUpdate?.(this.currentState);
          },
        });
        this.activeTweens.set(key, tween);
      }
    });
  }

  /**
   * Transition color values (HEX strings)
   * Converts to RGB, interpolates, then converts back
   */
  private transitionColor(
    key: string,
    fromColor: string,
    toColor: string,
    duration: number,
    ease: string
  ): void {
    // If colors are the same, skip transition
    if (fromColor === toColor) {
      return;
    }

    // Parse hex colors
    const from = this.hexToRgb(fromColor);
    const to = this.hexToRgb(toColor);

    if (!from || !to) {
      console.warn(`[TransitionEngine] Invalid color: ${fromColor} or ${toColor}`);
      return;
    }

    // Create a temporary object for GSAP to animate
    const colorObj = { r: from.r, g: from.g, b: from.b };

    const tween = gsap.to(colorObj, {
      r: to.r,
      g: to.g,
      b: to.b,
      duration,
      ease,
      onUpdate: () => {
        // Convert back to hex and update state
        const hex = this.rgbToHex(
          Math.round(colorObj.r),
          Math.round(colorObj.g),
          Math.round(colorObj.b)
        );

        // Update the appropriate state property
        if (key === "ferro.baseColor") {
          this.currentState.ferro.baseColor = hex;
        } else if (key === "ferro.accentColor") {
          this.currentState.ferro.accentColor = hex;
        } else if (key === "background.bgGradientA") {
          this.currentState.background.bgGradientA = hex;
        } else if (key === "background.bgGradientB") {
          this.currentState.background.bgGradientB = hex;
        }

        this.onStateUpdate?.(this.currentState);
      },
    });

    this.activeTweens.set(key, tween);
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Convert RGB to hex color
   */
  private rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }

  /**
   * Kill all active transitions
   */
  killAll(): void {
    this.activeTweens.forEach((tween) => tween.kill());
    this.activeTweens.clear();
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.killAll();
    this.onStateUpdate = undefined;
  }
}

