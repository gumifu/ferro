// Helper utilities for color transitions using GSAP
// Can be used to replace existing lerpColors calls with GSAP-based transitions

import { gsap } from "gsap";
import * as THREE from "three";

/**
 * Transition a Three.js Color object using GSAP
 * This provides smoother, more controlled color transitions than lerpColors
 *
 * @param color - Three.js Color object to animate
 * @param targetColor - Target color (hex string or THREE.Color)
 * @param duration - Transition duration in seconds
 * @param ease - GSAP easing function (default: "power2.inOut")
 * @param onUpdate - Optional callback called on each frame
 * @returns GSAP tween instance
 */
export function transitionColor(
  color: THREE.Color,
  targetColor: string | THREE.Color,
  duration: number,
  ease: string = "power2.inOut",
  onUpdate?: () => void
): gsap.core.Tween {
  // Convert target to THREE.Color if it's a string
  const target = typeof targetColor === "string"
    ? new THREE.Color(targetColor)
    : targetColor;

  // Create a temporary object for GSAP to animate
  const colorObj = {
    r: color.r,
    g: color.g,
    b: color.b,
  };

  // Animate using GSAP
  return gsap.to(colorObj, {
    r: target.r,
    g: target.g,
    b: target.b,
    duration,
    ease,
    onUpdate: () => {
      // Update the Three.js Color object
      color.setRGB(colorObj.r, colorObj.g, colorObj.b);
      onUpdate?.();
    },
  });
}

/**
 * Transition multiple colors in sequence (for color palettes)
 * Useful for cycling through color palettes smoothly
 *
 * @param color - Three.js Color object to animate
 * @param colorPalette - Array of hex color strings
 * @param duration - Duration for each transition
 * @param ease - GSAP easing function
 * @param onUpdate - Optional callback
 * @returns Function to stop the animation
 */
export function transitionColorSequence(
  color: THREE.Color,
  colorPalette: string[],
  duration: number = 2,
  ease: string = "power2.inOut",
  onUpdate?: () => void
): () => void {
  if (colorPalette.length === 0) return () => {};
  if (colorPalette.length === 1) {
    transitionColor(color, colorPalette[0], duration, ease, onUpdate);
    return () => {};
  }

  let currentIndex = 0;
  let activeTween: gsap.core.Tween | null = null;

  const transitionToNext = () => {
    const nextIndex = (currentIndex + 1) % colorPalette.length;
    const targetColor = colorPalette[nextIndex];

    activeTween = transitionColor(color, targetColor, duration, ease, () => {
      onUpdate?.();
    });

    activeTween.eventCallback("onComplete", () => {
      currentIndex = nextIndex;
      transitionToNext();
    });
  };

  // Start the first transition
  transitionToNext();

  // Return cleanup function
  return () => {
    if (activeTween) {
      activeTween.kill();
      activeTween = null;
    }
  };
}

