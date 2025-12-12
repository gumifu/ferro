"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAudioStore } from "@/lib/stores/audioStore";

export function FerroObject() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { realtimeAudio } = useAudioStore();

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVolumeRms: { value: 0 },
      uBass: { value: 0 },
      uTreble: { value: 0 },
      uDistortionIntensity: { value: 0.3 },
      uSpikeIntensity: { value: 0 },
      uNoiseFrequency: { value: 3.0 },
      uColor: { value: new THREE.Vector3(0.2, 0.4, 0.8) },
      uMetallic: { value: 0.9 },
    }),
    []
  );

  // Vertex shader with distortion
  const vertexShader = `
    uniform float uTime;
    uniform float uVolumeRms;
    uniform float uBass;
    uniform float uTreble;
    uniform float uDistortionIntensity;
    uniform float uSpikeIntensity;
    uniform float uNoiseFrequency;

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying float vNoise;

    // 3D Noise function
    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
      return mod289(((x*34.0)+1.0)*x);
    }

    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    float fbm(vec3 p, int octaves) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      for (int i = 0; i < 4; i++) {
        if (i >= octaves) break;
        value += amplitude * snoise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      vPosition = position;
      vNormal = normal;

      vec3 pos = position;
      float time = uTime * 0.5;

      // Multi-octave noise for organic deformation
      vec3 noiseCoord = pos * uNoiseFrequency + vec3(0.0, 0.0, time);
      float noise1 = fbm(noiseCoord, 4);
      float noise2 = fbm(noiseCoord * 2.0 + vec3(100.0), 3);
      float noise3 = fbm(noiseCoord * 4.0 + vec3(200.0), 2);

      float combinedNoise = (noise1 + noise2 * 0.5 + noise3 * 0.25) / 1.75;
      vNoise = combinedNoise;

      // Distortion based on volume
      float distortion = combinedNoise * uDistortionIntensity * (0.5 + uVolumeRms * 0.5);

      // Spike formation (affected by treble and volume)
      float spikeNoise = fbm(pos * 10.0 + time, 3);
      float spikeLength = max(0.0, (spikeNoise - 0.3) * uSpikeIntensity * (0.5 + uTreble * 0.5));

      // Bass affects downward pull
      vec3 bassPull = vec3(0.0, -uBass * 0.1, 0.0);

      // Apply deformations
      pos += normal * distortion;
      pos += normal * spikeLength;
      pos += bassPull;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  // Fragment shader with metallic look
  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uMetallic;

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying float vNoise;

    void main() {
      vec3 normal = normalize(vNormal);

      // Base color with noise variation
      vec3 baseColor = uColor * (0.7 + vNoise * 0.3);

      // Simple lighting
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float NdotL = max(dot(normal, lightDir), 0.0);

      // Fresnel effect
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float fresnel = pow(1.0 - dot(viewDir, normal), 2.0);

      // Metallic reflection
      vec3 reflection = reflect(-viewDir, normal);
      float specular = pow(max(dot(reflection, lightDir), 0.0), 32.0) * uMetallic;

      // Combine lighting
      vec3 ambient = baseColor * 0.2;
      vec3 diffuse = baseColor * NdotL;
      vec3 spec = vec3(1.0) * specular * uMetallic;
      vec3 fresnelColor = mix(baseColor, vec3(1.0), uMetallic) * fresnel * 0.3;

      vec3 finalColor = ambient + diffuse + spec + fresnelColor;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  useFrame((state, delta) => {
    if (!materialRef.current || !meshRef.current) return;

    // Update time
    uniforms.uTime.value += delta;

    // Smooth interpolation of audio values
    const targetVolume = realtimeAudio.volumeRms;
    const targetBass = realtimeAudio.bass;
    const targetTreble = realtimeAudio.treble;

    uniforms.uVolumeRms.value += (targetVolume - uniforms.uVolumeRms.value) * 0.1;
    uniforms.uBass.value += (targetBass - uniforms.uBass.value) * 0.1;
    uniforms.uTreble.value += (targetTreble - uniforms.uTreble.value) * 0.1;

    // Update distortion and spike intensity based on volume
    uniforms.uDistortionIntensity.value = 0.2 + uniforms.uVolumeRms.value * 0.3;
    uniforms.uSpikeIntensity.value = uniforms.uVolumeRms.value * 0.4 + uniforms.uTreble.value * 0.2;

    // Update material uniforms
    materialRef.current.uniforms.uTime.value = uniforms.uTime.value;
    materialRef.current.uniforms.uVolumeRms.value = uniforms.uVolumeRms.value;
    materialRef.current.uniforms.uBass.value = uniforms.uBass.value;
    materialRef.current.uniforms.uTreble.value = uniforms.uTreble.value;
    materialRef.current.uniforms.uDistortionIntensity.value = uniforms.uDistortionIntensity.value;
    materialRef.current.uniforms.uSpikeIntensity.value = uniforms.uSpikeIntensity.value;

    // Gentle rotation
    meshRef.current.rotation.y += 0.003;
    meshRef.current.rotation.x += 0.002;

    // Scale based on volume (subtle)
    const scale = 1.0 + uniforms.uVolumeRms.value * 0.1;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

