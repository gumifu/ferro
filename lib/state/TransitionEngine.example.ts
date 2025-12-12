// Example usage of TransitionEngine
// This demonstrates how to use TransitionEngine with Three.js materials

import { TransitionEngine, type WorldState } from "./TransitionEngine";
import { clampWorldTarget, type WorldTarget } from "@/lib/types/worldTarget";
import * as THREE from "three";

/**
 * Example: Using TransitionEngine with Three.js material
 */
export function exampleTransitionEngineUsage(material: THREE.MeshStandardMaterial) {
  // Initialize with current state
  const initialState: WorldState = {
    renderMode: "full",
    mood: "calm",
    ferro: {
      baseColor: "#3366ff",
      saturation: 0.5,
      roughness: 0.3,
      metalness: 0.8,
      envIntensity: 1.0,
      deformStrength: 0.3,
      deformScale: 1.5,
      deformSpeed: 1.0,
      swayAmount: 0.2,
      swaySpeed: 0.5,
      pulseAmount: 0.1,
      gravityStrength: 0.3,
      attractStrength: 0.2,
    },
    background: {
      bgStyle: "SoftGradient",
      bgGradientA: "#1a0033",
      bgGradientB: "#003366",
      bgNoiseAmount: 0.1,
      bgFogDensity: 0.3,
      bgVignette: 0.4,
      bgMotion: 0.2,
      bloomIntensity: 0.5,
      grainAmount: 0.1,
    },
  };

  // Create TransitionEngine with callback to update Three.js material
  const engine = new TransitionEngine(initialState, (state) => {
    // Update Three.js material based on state
    const color = new THREE.Color(state.ferro.baseColor);
    material.color.copy(color);
    material.metalness = state.ferro.metalness;
    material.roughness = state.ferro.roughness;
    material.needsUpdate = true;

    console.log("[TransitionEngine] State updated:", state);
  });

  // Example: Transition to a new target
  const target: WorldTarget = {
    version: "v2",
    renderMode: "full",
    mood: "pulse",
    transitionSeconds: 8,
    ferro: {
      baseColor: "#ff3366",
      accentColor: "#ffaa00",
      saturation: 0.7,
      roughness: 0.2,
      metalness: 0.9,
      envIntensity: 1.5,
      deformStrength: 0.6,
      deformScale: 2.0,
      deformSpeed: 1.5,
      swayAmount: 0.5,
      swaySpeed: 1.0,
      pulseAmount: 0.4,
      gravityStrength: 0.2,
      attractStrength: 0.3,
    },
    background: {
      bgStyle: "GlowField",
      bgGradientA: "#330033",
      bgGradientB: "#660066",
      bgNoiseAmount: 0.15,
      bgFogDensity: 0.5,
      bgVignette: 0.6,
      bgMotion: 0.4,
      bloomIntensity: 0.8,
      grainAmount: 0.2,
    },
  };

  // Clamp target values
  const clampedTarget = clampWorldTarget(target);

  // Start transition
  engine.transitionTo(clampedTarget);

  // Cleanup when done
  // engine.dispose();
}

