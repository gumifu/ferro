"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { parseBlob } from "music-metadata";
import { useAIPlanStore } from "@/lib/stores/aiPlanStore";
import { AIPlannerModule } from "@/lib/ai/AIPlannerModule";
import { ReflectionModule } from "@/lib/ai/ReflectionModule";
import type { AudioFrame } from "@/lib/types";
import type { Reflection, AudioSummary } from "@/lib/types/reflection";
import { ReflectionDisplay } from "./ReflectionDisplay";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaUpload,
  FaStop,
  FaDesktop,
  FaExpand,
  FaCompress,
  FaMusic,
  FaTimes,
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeDown,
  FaVolumeMute,
  FaGripVertical,
} from "react-icons/fa";
import { FaYoutube, FaSpotify } from "react-icons/fa6";
import { SiApplemusic } from "react-icons/si";

// Initialize Simplex noise for smooth, liquid-like deformations
const noise3D = createNoise3D();

// Sample music list
const SAMPLE_MUSIC = [
  { name: "Silence", url: "/samples/Silence.mp3" },
  { name: "Floating Silence", url: "/samples/Floating Silence.mp3" },
];

// Helper functions
function fractionate(val: number, minVal: number, maxVal: number): number {
  return (val - minVal) / (maxVal - minVal);
}

function modulate(
  val: number,
  minVal: number,
  maxVal: number,
  outMin: number,
  outMax: number
): number {
  const fr = fractionate(val, minVal, maxVal);
  const delta = outMax - outMin;
  return outMin + fr * delta;
}

function avg(arr: Uint8Array): number {
  let total = 0;
  for (let i = 0; i < arr.length; i++) {
    total += arr[i];
  }
  return total / arr.length;
}

function max(arr: Uint8Array): number {
  let maxVal = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > maxVal) maxVal = arr[i];
  }
  return maxVal;
}

// Create animated gradient background plane (Apple style)
function createAnimatedGradientBackground(
  width: number,
  height: number
): THREE.Mesh {
  // Make plane large enough to cover camera view
  // Camera is at z=100, plane at z=-50, so distance is 150
  // With 45deg FOV, we need a large plane
  const planeWidth = Math.max(width, height) * 3;
  const planeHeight = Math.max(width, height) * 3;
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uColor1;  // AIプランのカラー1
    uniform vec3 uColor2;  // AIプランのカラー2
    uniform vec3 uColor3;  // AIプランのカラー3
    uniform float uUseAIColors;  // AIカラーを使用するか（0.0 or 1.0）

    // 簡易ノイズ（sinベース）
    float noise(vec2 p) {
      return sin(p.x) * sin(p.y);
    }

    void main() {
      vec2 uv = vUv;
      float t = uTime * 0.08;

      // 座標をゆっくりゆがませる
      vec2 p = uv * 3.0;
      float n = noise(p + vec2(t, -t * 1.3));
      float n2 = noise(p * 0.7 + vec2(-t * 0.4, t * 0.6));
      float offset = n * 0.15 + n2 * 0.1;

      // ベースになる縦グラデーション（ノイズでゆらす）
      float y = uv.y + offset;

      // AIプランのカラーを使用するか、デフォルトカラーを使用するか
      vec3 col1, col2, col3;
      if (uUseAIColors > 0.5) {
        // AIプランのカラーを使用
        col1 = uColor1;
        col2 = uColor2;
        col3 = uColor3;
      } else {
        // デフォルトカラー（Apple-style）
        col1 = vec3(0.05, 0.02, 0.18);  // deep purple (top)
        col2 = vec3(1.00, 0.60, 0.30);  // warm orange (middle)
        col3 = vec3(0.10, 0.35, 0.95);  // blue (bottom)
      }

      // Add subtle horizontal shifting for wind-like movement
      float horizontalOffset = noise(p * 0.5 + vec2(t * 0.2, t * 0.15)) * 0.05;
      float yWithOffset = uv.y + offset + horizontalOffset;

      // Smooth interpolation with soft transitions
      vec3 top = mix(col1, col2, smoothstep(0.2, 0.7, yWithOffset));
      vec3 bottom = mix(col2, col3, smoothstep(0.4, 1.1, yWithOffset));
      vec3 color = mix(top, bottom, smoothstep(0.0, 1.0, yWithOffset));

      // Subtle breathing effect (slower and softer)
      float breathe = 0.04 * sin(t * 0.5);
      color += breathe;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(width, height) },
      uColor1: { value: new THREE.Vector3(0.05, 0.02, 0.18) }, // デフォルト: deep purple
      uColor2: { value: new THREE.Vector3(1.0, 0.6, 0.3) }, // デフォルト: warm orange
      uColor3: { value: new THREE.Vector3(0.1, 0.35, 0.95) }, // デフォルト: blue
      uUseAIColors: { value: 0.0 }, // デフォルトではAIカラーを使用しない
    },
  });

  const plane = new THREE.Mesh(geometry, material);
  // Position plane far behind the camera's view
  // Camera is at z=100 looking at 0,0,0, so place plane at z=-50 to be visible
  plane.position.z = -50;
  plane.position.x = 0;
  plane.position.y = 0;

  return plane;
}

export default function FerrofluidVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const systemAudioStreamRef = useRef<MediaStream | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingFile, setIsPlayingFile] = useState(false);
  const [isSystemAudio, setIsSystemAudio] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<
    "youtube" | "applemusic" | "spotify" | null
  >(null); // デフォルトでは何も選択しない
  const [youtubeVideoId, setYoutubeVideoId] = useState<string>("jfKfPfyJRdk");
  const [isPaused, setIsPaused] = useState(false);
  const [volume, setVolume] = useState(0.5); // Default volume 50%
  const [currentTrack, setCurrentTrack] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const playerRef = useRef<HTMLDivElement>(null);
  const [youtubePlayerPosition, setYoutubePlayerPosition] = useState({
    x: 0,
    y: 0,
  });
  const [isDraggingYoutube, setIsDraggingYoutube] = useState(false);
  const [youtubeDragOffset, setYoutubeDragOffset] = useState({ x: 0, y: 0 });
  const youtubePlayerRef = useRef<HTMLDivElement>(null);

  // AI機能関連
  const aiPlannerRef = useRef<AIPlannerModule | null>(null);
  const reflectionModuleRef = useRef<ReflectionModule | null>(null);
  const [userMoodText, setUserMoodText] = useState("");
  const [enableAITimeline, setEnableAITimeline] = useState(false);
  const enableAITimelineRef = useRef(false); // render関数内で最新値を参照するため
  const {
    plan: aiPlan,
    isGenerating: isAIGenerating,
    error: aiError,
  } = useAIPlanStore();
  const aiPlanRef = useRef(aiPlan); // render関数内で最新値を参照するため

  // Reflection state
  const [currentReflection, setCurrentReflection] = useState<Reflection | null>(
    null
  );
  const [isGeneratingReflection, setIsGeneratingReflection] = useState(false);

  // aiPlanが変更されたらrefを更新
  useEffect(() => {
    aiPlanRef.current = aiPlan;
    if (aiPlan) {
      console.log("[FerrofluidVisualizer] AI plan ref updated:", {
        sections: aiPlan.sections.length,
        overallMood: aiPlan.overallMood,
      });
    }
  }, [aiPlan]);
  const timelineFramesRef = useRef<AudioFrame[]>([]);
  const timelineStartTimeRef = useRef<number>(0);
  const [timelineFrameCount, setTimelineFrameCount] = useState(0); // UI更新用

  const [savedAudioFiles, setSavedAudioFiles] = useState<
    { name: string; data: string }[]
  >(() => {
    // Load saved audio files from localStorage on mount
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ferroAudioFiles");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Error loading saved audio files:", e);
        }
      }
    }
    return [];
  });
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    group: THREE.Group;
    ball: THREE.Mesh;
    plane: THREE.Mesh;
    plane2: THREE.Mesh;
    analyser: AnalyserNode | null;
    audioContext: AudioContext | null;
    dataArray: Uint8Array | null;
    clock: THREE.Clock;
    mousePosition: THREE.Vector3;
    mouseActive: boolean;
    animationId: number;
    ferrofluidMaterial?: THREE.MeshPhysicalMaterial;
    backgroundMaterial?: THREE.ShaderMaterial; // AIプランのカラーを適用するため
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return;

    // Use full viewport size, accounting for mobile browser UI
    const getViewportSize = () => {
      // Use visualViewport if available (better for mobile)
      if (window.visualViewport) {
        return {
          width: window.visualViewport.width,
          height: window.visualViewport.height,
        };
      }
      // Fallback to window size
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    };

    const { width, height } = getViewportSize();

    // Scene setup
    const scene = new THREE.Scene();
    // Set background to null so CSS gradient shows through
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    // Make canvas fill the container
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    containerRef.current.appendChild(renderer.domElement);

    // Group for all objects
    const group = new THREE.Group();
    scene.add(group);

    // Enhanced lighting for metallic ferrofluid look
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Main light (reduced intensity for HDRI compatibility)
    const spotLight = new THREE.SpotLight(0xffffff, 1.2);
    spotLight.position.set(-10, 40, 20);
    spotLight.lookAt(0, 0, 0);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.3;
    scene.add(spotLight);

    // Additional lights for better reflections (reduced intensity)
    const pointLight1 = new THREE.PointLight(0xffffff, 0.8, 100);
    pointLight1.position.set(15, 15, 15);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.6, 100);
    pointLight2.position.set(-15, -15, 15);
    scene.add(pointLight2);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Plane 1
    const planeGeometry = new THREE.PlaneGeometry(800, 800, 20, 20);
    const planeMaterial = new THREE.MeshLambertMaterial({
      color: 0x6904ce,
      side: THREE.DoubleSide,
      wireframe: true,
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -0.5 * Math.PI;
    plane.position.set(0, 30, 0);
    // group.add(plane);

    // Plane 2
    const plane2 = new THREE.Mesh(planeGeometry, planeMaterial);
    plane2.rotation.x = -0.5 * Math.PI;
    plane2.position.set(0, -30, 0);
    // group.add(plane2); // Wireframe plane disabled for cleaner look

    // Ball - Ferrofluid style with glossy black texture
    // Use SphereGeometry instead of IcosahedronGeometry for smooth appearance
    const ballGeometry = new THREE.SphereGeometry(10, 128, 128);

    // AIプランのカラーパレットを適用するためのマテリアル参照を保存
    const ferrofluidMaterial = new THREE.MeshPhysicalMaterial({
      // Black-gray color for better visibility of mouse interaction
      color: 0xb3b3b3, // Dark gray instead of pure black
      metalness: 0.9,
      roughness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.9,
      // Slight emissive to prevent pure black
      emissive: 0x0a0a0a,
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
    });

    // マテリアル参照をsceneRefに保存（AIプランの色を適用するため）
    // Note: ferrofluidMaterial is stored in sceneRef for AI plan color application
    // const ferrofluidMaterial = new THREE.MeshPhysicalMaterial({
    //   color: 0xffffff, // 少し明るめのグレー
    //   metalness: 0.25, // ★ 0.9 → 0.25 に大きく下げる
    //   roughness: 0.35, // 表面のテカりを少し柔らかく
    //   clearcoat: 0.8, // コートは少しだけ
    //   clearcoatRoughness: 0.2,
    //   reflectivity: 0.6, // 反射も少し控えめ
    //   emissive: 0x101010, // 薄く自発光
    //   emissiveIntensity: 0.25,
    //   side: THREE.DoubleSide,
    // });

    const ball = new THREE.Mesh(ballGeometry, ferrofluidMaterial);
    ball.position.set(0, 0, 0);
    group.add(ball);

    // Create animated gradient background
    const backgroundPlane = createAnimatedGradientBackground(width, height);
    scene.add(backgroundPlane);

    // 背景のマテリアルへの参照を保存（AIプランのカラーを適用するため）
    const backgroundMaterial = backgroundPlane.material as THREE.ShaderMaterial;

    // Setup HDRI environment map for realistic reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Try to load HDRI, fallback gracefully if not found
    const rgbeLoader = new RGBELoader();
    rgbeLoader.setPath("/hdr/").load(
      "studio.hdr",
      (hdrTexture) => {
        const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
        scene.environment = envMap;
        ferrofluidMaterial.envMap = envMap;
        ferrofluidMaterial.envMapIntensity = 1.2;
        ferrofluidMaterial.needsUpdate = true;
        hdrTexture.dispose();
        pmremGenerator.dispose();
      },
      undefined,
      () => {
        // Silently handle HDR file not found - it's optional
        // Continue without HDRI - existing lights will work
        pmremGenerator.dispose();
      }
    );

    // Clock for time-based animations
    const clock = new THREE.Clock();

    // Mouse position for magnetic attraction
    const mousePosition = new THREE.Vector3(0, 0, 0);
    const mouseActiveRef = { value: false };

    sceneRef.current = {
      scene,
      camera,
      renderer,
      group,
      ball,
      plane,
      plane2,
      analyser: null,
      audioContext: null,
      dataArray: null,
      clock,
      mousePosition,
      mouseActive: mouseActiveRef.value,
      animationId: 0,
      ferrofluidMaterial,
      backgroundMaterial, // AIプランのカラーを適用するため
    };

    // Mouse interaction - convert mouse position to 3D space
    const containerElement = containerRef.current;
    const handleMouseMove = (event: MouseEvent) => {
      if (!containerElement || !sceneRef.current) return;

      const rect = containerElement.getBoundingClientRect();
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast from camera to find 3D position
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      // Intersect with a plane at z=0 (where the ball center is)
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const pointOnPlane = new THREE.Vector3();
      ray.ray.intersectPlane(plane, pointOnPlane);

      sceneRef.current.mousePosition.copy(pointOnPlane);
      mouseActiveRef.value = true;
      sceneRef.current.mouseActive = true;
    };

    const handleMouseLeave = () => {
      if (sceneRef.current) {
        mouseActiveRef.value = false;
        sceneRef.current.mouseActive = false;
      }
    };

    containerElement.addEventListener("mousemove", handleMouseMove);
    containerElement.addEventListener("mouseleave", handleMouseLeave);

    // Direction vector for single spike pointing at 8 o'clock
    // 8 o'clock is 30 degrees counterclockwise from downward (6 o'clock)
    const SPIKE_DIR = new THREE.Vector3(
      -Math.sin(Math.PI / 6), // x: -0.5 (left)
      -Math.cos(Math.PI / 6), // y: -√3/2 ≈ -0.866 (downward)
      0 // z: 0
    ).normalize();
    const TMP_NORMAL = new THREE.Vector3(); // Reusable vector

    // Make rough ball function with magnetic mouse attraction and AI plan support
    const makeRoughBall = (
      mesh: THREE.Mesh,
      bassFr: number,
      treFr: number,
      mousePos: THREE.Vector3,
      mouseActive: boolean,
      aiPlanParams?: {
        energy: number;
        tension: number;
        spikeAmount: number;
        noiseAmount: number;
        motionStyle: string;
      }
      // spikeAngle: number
    ) => {
      const geometry = mesh.geometry as THREE.SphereGeometry;
      const vertices = geometry.attributes.position as THREE.BufferAttribute;
      const time = window.performance.now();

      // Magnetic attraction parameters
      const magnetStrength = 40.0; // Strength of magnetic pull
      const magnetRange = 60.0; // Range of magnetic influence

      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i);
        const y = vertices.getY(i);
        const z = vertices.getZ(i);

        const length = Math.sqrt(x * x + y * y + z * z);
        const nx = x / length;
        const ny = y / length;
        const nz = z / length;

        // Smoother parameters for liquid-like deformations
        // AIプランのパラメータを適用（あれば）
        const aiEnergy = aiPlanParams?.energy ?? 0.5;
        const aiTension = aiPlanParams?.tension ?? 0.5;
        const aiSpikeAmount = aiPlanParams?.spikeAmount ?? 0;
        const aiNoiseAmount = aiPlanParams?.noiseAmount ?? 1.0;
        const motionStyle = aiPlanParams?.motionStyle ?? "default";

        // 音声データとAIプランをブレンド（AIプランの影響を強める）
        // AIプランがある場合は、AIプランを優先的に使用
        const aiWeight = aiPlanParams ? 0.9 : 0.0; // AIプランがある場合は90%の重み
        const audioWeight = aiPlanParams ? 0.1 : 1.0; // AIプランがある場合は10%の重み
        const blendedBass = bassFr * audioWeight + aiEnergy * aiWeight;
        const blendedTreble = treFr * audioWeight + aiTension * aiWeight;

        // デバッグ：AIプランパラメータが使われているか確認
        if (aiPlanParams) {
          const aiUsageLogCount = (window as any).__aiUsageLogCount || 0;
          if (aiUsageLogCount < 3) {
            (window as any).__aiUsageLogCount = aiUsageLogCount + 1;
            console.log(
              "[FerrofluidVisualizer] Using AI plan params in makeRoughBall:",
              {
                aiEnergy,
                aiTension,
                aiSpikeAmount,
                aiNoiseAmount,
                motionStyle,
                blendedBass: blendedBass.toFixed(3),
                blendedTreble: blendedTreble.toFixed(3),
              }
            );
          }
        }

        // モーションスタイルに応じた時間スケール
        let timeScale = 0.3;
        if (
          motionStyle.includes("slow") ||
          motionStyle.includes("breathing") ||
          motionStyle.includes("calm")
        ) {
          timeScale = 0.15; // ゆっくり
        } else if (
          motionStyle.includes("fast") ||
          motionStyle.includes("spikes") ||
          motionStyle.includes("intense") ||
          motionStyle.includes("激") ||
          motionStyle.includes("激しい") ||
          motionStyle.includes("激し")
        ) {
          timeScale = 0.6; // 激しく速く
        }

        // AIプランがある場合は、より大きな変化を適用
        const baseAmp = aiPlanParams ? 3.0 : 2.0; // AIプランがある場合は振幅を大きく
        const amp = baseAmp * (1.0 + aiNoiseAmount * 0.8); // AIノイズ量で振幅を調整
        const offset = 10; // sphere radius
        const noiseValue = noise3D(
          nx * 1.5 + time * timeScale,
          ny * 1.5 + time * (timeScale * 1.15),
          nz * 1.5 + time * (timeScale * 1.3)
        );
        // More subtle modulation for liquid appearance
        // AIプランのパラメータを反映
        // spikeAmountを適用してスパイクを追加
        const spikeNoise = noise3D(
          nx * 8.0 + time * timeScale * 2.0,
          ny * 8.0 + time * timeScale * 2.0,
          nz * 8.0 + time * timeScale * 2.0
        );
        const spikeDeformation =
          Math.max(0, spikeNoise - 0.3) * aiSpikeAmount * 4.0; // スパイクの影響を4倍に

        // AIプランがある場合は、より大きな変形を適用
        const bassMultiplier = aiPlanParams ? 1.5 : 0.8;
        const trebleMultiplier = aiPlanParams ? 1.2 : 1.0;

        let distance =
          offset +
          blendedBass * bassMultiplier +
          noiseValue * amp * blendedTreble * trebleMultiplier +
          spikeDeformation;

        // Apply magnetic attraction if mouse is active
        if (mouseActive) {
          const vertexWorldPos = new THREE.Vector3(
            nx * offset,
            ny * offset,
            nz * offset
          );
          const toMouse = new THREE.Vector3().subVectors(
            mousePos,
            vertexWorldPos
          );
          const distToMouse = toMouse.length();

          if (distToMouse < magnetRange && distToMouse > 0.1) {
            // Inverse square law for magnetic force
            const force = magnetStrength / (distToMouse * distToMouse + 1.0);
            const pullDirection = toMouse.normalize();

            // Pull vertex towards mouse
            const pullAmount = force * 0.1; // Scale factor
            distance +=
              pullAmount *
              Math.max(0, pullDirection.dot(new THREE.Vector3(nx, ny, nz)));
          }
        }

        // --- Add single downward spike ---
        // AIプランのspikeAmountを反映
        if (aiSpikeAmount > 0) {
          TMP_NORMAL.set(nx, ny, nz);
          // How aligned with spikeDir (closer to 1 = more downward)
          const alignment = Math.max(0, TMP_NORMAL.dot(SPIKE_DIR));
          // Spike sharpness and height (AIプランのspikeAmountで調整)
          const spikeSharpness = 300.0; // Larger = sharper, more localized
          const spikeHeight = 2.5 * aiSpikeAmount; // AIプランのspikeAmountで高さを調整
          // alignment^sharpness to focus on almost one point
          const spikeFactor = Math.pow(alignment, spikeSharpness);
          // Add spike to radius
          distance += spikeHeight * spikeFactor;
        } else {
          // デフォルトのスパイク（AIプランがない場合）
          TMP_NORMAL.set(nx, ny, nz);
          const alignment = Math.max(0, TMP_NORMAL.dot(SPIKE_DIR));
          const spikeSharpness = 300.0;
          const spikeHeight = 2.5;
          const spikeFactor = Math.pow(alignment, spikeSharpness);
          distance += spikeHeight * spikeFactor;
        }

        vertices.setXYZ(i, nx * distance, ny * distance, nz * distance);
      }

      vertices.needsUpdate = true;
      geometry.computeVertexNormals();
    };

    // Make rough ground function
    const makeRoughGround = (mesh: THREE.Mesh, distortionFr: number) => {
      const geometry = mesh.geometry as THREE.PlaneGeometry;
      const vertices = geometry.attributes.position;
      const time = Date.now();
      const amp = 2;

      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i);
        const y = vertices.getY(i);

        const noiseValue = noise3D(x + time * 0.0003, y + time * 0.0001, 0);
        const distance = (noiseValue + 0) * distortionFr * amp;

        vertices.setZ(i, distance);
      }

      vertices.needsUpdate = true;
      geometry.computeVertexNormals();
    };

    // Render function
    const render = () => {
      if (!sceneRef.current) return;

      const {
        analyser,
        dataArray,
        ball,
        plane,
        plane2,
        group,
        scene: currentScene,
        clock,
        mousePosition,
        mouseActive: mouseActiveValue,
      } = sceneRef.current;

      // Update mouseActive from ref
      const mouseActive = mouseActiveRef.value || mouseActiveValue;

      // Update background gradient time using clock
      const elapsedTime = clock.getElapsedTime();
      currentScene.children.forEach((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.ShaderMaterial
        ) {
          if (child.material.uniforms.uTime) {
            child.material.uniforms.uTime.value = elapsedTime;
          }
        }
      });

      if (analyser && dataArray) {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buffer);

        const lowerHalfLength = Math.floor(buffer.length / 2) - 1;
        const upperHalfLength = buffer.length - lowerHalfLength - 1;

        const lowerHalfArray = new Uint8Array(lowerHalfLength);
        const upperHalfArray = new Uint8Array(upperHalfLength);

        for (let i = 0; i < lowerHalfLength; i++) {
          lowerHalfArray[i] = buffer[i];
        }
        for (let i = 0; i < upperHalfLength; i++) {
          upperHalfArray[i] = buffer[lowerHalfLength + i];
        }

        const lowerMax = max(lowerHalfArray);
        const upperAvg = avg(upperHalfArray);

        const lowerMaxFr = lowerMax / lowerHalfArray.length;
        const upperAvgFr = upperAvg / upperHalfArray.length;

        // AIタイムライン収集（有効な場合）
        // enableAITimelineRefを使用して最新の値を参照
        if (enableAITimelineRef.current && analyser && dataArray) {
          // ファイル再生の場合はaudioRef.current.currentTimeを使用
          // それ以外はaudioContext.currentTimeを使用
          let timeSinceStart: number;

          // audioRef.currentが存在する場合はファイル再生と判断
          // isPlayingFileの状態に依存せず、audioRef.currentの存在で判断する
          if (audioRef.current) {
            // ファイル再生時は、実際の再生時間を使用（一時停止も考慮）
            // audio.currentTimeは一時停止中でも現在の再生位置を保持する
            timeSinceStart = audioRef.current.currentTime;
          } else if (sceneRef.current?.audioContext) {
            // マイクやシステムオーディオの場合は、audioContextの時間を使用
            timeSinceStart =
              sceneRef.current.audioContext.currentTime -
              timelineStartTimeRef.current;
          } else {
            // audioContextがない場合はスキップ
            timeSinceStart = 0;
          }

          // 0.5秒ごとにフレームを記録
          // 前回のフレームから0.5秒以上経過しているかチェック
          const lastFrameTime =
            timelineFramesRef.current.length > 0
              ? timelineFramesRef.current[timelineFramesRef.current.length - 1]
                  .time
              : -0.5; // 最初のフレームは必ず追加されるように

          const timeDiff = timeSinceStart - lastFrameTime;

          if (timeDiff >= 0.5) {
            const volumeRms = Math.sqrt(avg(buffer) / 255);
            timelineFramesRef.current.push({
              time: timeSinceStart,
              volumeRms,
              bass: lowerMaxFr,
              treble: upperAvgFr,
            });
            // UI更新のためにフレーム数を更新
            setTimelineFrameCount(timelineFramesRef.current.length);
            console.log("[FerrofluidVisualizer] Timeline frame added:", {
              frameNumber: timelineFramesRef.current.length,
              time: timeSinceStart.toFixed(2),
              volumeRms: volumeRms.toFixed(3),
              hasAudioRef: !!audioRef.current,
              audioPaused: audioRef.current?.paused,
              audioCurrentTime: audioRef.current?.currentTime,
            });
          } else {
            // デバッグ用：最初のフレームが追加されない場合の詳細ログ
            if (timelineFramesRef.current.length === 0) {
              // 最初のフレームが追加されない場合のみログ出力（スパムを防ぐため、5秒ごとに1回）
              const lastDebugTime =
                (window as any).__lastTimelineDebugTime || 0;
              const now = Date.now();
              if (now - lastDebugTime > 5000) {
                (window as any).__lastTimelineDebugTime = now;
                console.log(
                  "[FerrofluidVisualizer] Timeline collection check (first frame):",
                  {
                    enableAITimeline: enableAITimelineRef.current,
                    hasAnalyser: !!analyser,
                    hasDataArray: !!dataArray,
                    hasAudioRef: !!audioRef.current,
                    audioPaused: audioRef.current?.paused,
                    audioCurrentTime: audioRef.current?.currentTime,
                    timeSinceStart: timeSinceStart.toFixed(3),
                    lastFrameTime: lastFrameTime.toFixed(3),
                    timeDiff: timeDiff.toFixed(3),
                    shouldAdd: timeDiff >= 0.5,
                    bufferLength: buffer.length,
                    bufferSample: Array.from(buffer).slice(0, 5), // 最初の5つの値を確認
                  }
                );
              }
            }
          }
        } else {
          // デバッグ用：条件が満たされていない場合
          if (enableAITimelineRef.current) {
            // 最初の数回のみログ出力（スパムを防ぐ）
            const debugCount = (window as any).__timelineDebugCount || 0;
            if (debugCount < 5) {
              (window as any).__timelineDebugCount = debugCount + 1;
              console.warn(
                "[FerrofluidVisualizer] Timeline collection conditions not met:",
                {
                  enableAITimeline: enableAITimelineRef.current,
                  hasAnalyser: !!analyser,
                  hasDataArray: !!dataArray,
                  hasAudioContext: !!sceneRef.current?.audioContext,
                  hasAudioRef: !!audioRef.current,
                  audioPaused: audioRef.current?.paused,
                  audioCurrentTime: audioRef.current?.currentTime,
                }
              );
            }
          }
        }

        // Update planes only if they are added to the scene
        if (plane && plane2) {
          makeRoughGround(plane, modulate(upperAvgFr, 0, 1, 0.5, 4));
          makeRoughGround(plane2, modulate(lowerMaxFr, 0, 1, 0.5, 4));
        }

        // AIプランの現在のセクションを取得
        let currentAIPlanParams:
          | {
              energy: number;
              tension: number;
              spikeAmount: number;
              noiseAmount: number;
              motionStyle: string;
            }
          | undefined = undefined;

        // render関数内ではrefを使用して最新のaiPlanを取得
        const currentAIPlan = aiPlanRef.current;

        // デバッグ：AIプランの存在を確認
        if (!currentAIPlan) {
          // AIプランがない場合は背景をデフォルトに戻す
          if (sceneRef.current?.backgroundMaterial) {
            sceneRef.current.backgroundMaterial.uniforms.uUseAIColors.value = 0.0;
          }

          // AIプランがない場合のログ（最初の数回のみ）
          const noPlanLogCount = (window as any).__noPlanLogCount || 0;
          if (noPlanLogCount < 3) {
            (window as any).__noPlanLogCount = noPlanLogCount + 1;
            console.warn(
              "[FerrofluidVisualizer] AI plan is null or undefined in render"
            );
          }
        }

        if (currentAIPlan && sceneRef.current?.audioContext) {
          // 現在の再生時間を取得（ファイル再生の場合はaudioRefから、それ以外はaudioContextから）
          let currentTime = 0;
          if (audioRef.current) {
            // audioRef.currentが存在する場合はファイル再生と判断
            currentTime = audioRef.current.currentTime;
          } else if (sceneRef.current.audioContext) {
            currentTime =
              sceneRef.current.audioContext.currentTime -
              timelineStartTimeRef.current;
          }

          // デバッグログ：AIプランが存在することを確認（毎回詳細を表示）
          console.log("[FerrofluidVisualizer] AI plan active:", {
            hasPlan: !!currentAIPlan,
            sections: currentAIPlan.sections.length,
            currentTime: currentTime.toFixed(2),
            sectionsInfo: currentAIPlan.sections.map((s, index) => {
              const isLastSection = index === currentAIPlan.sections.length - 1;
              const inRange = isLastSection
                ? currentTime >= s.startTime && currentTime <= s.endTime
                : currentTime >= s.startTime && currentTime < s.endTime;
              return {
                name: s.name,
                index: index,
                start: s.startTime.toFixed(2),
                end: s.endTime.toFixed(2),
                duration: (s.endTime - s.startTime).toFixed(2),
                isLastSection,
                inRange,
              };
            }),
          });

          // 現在の時間に対応するセクションを見つける
          // セクション検索：startTime <= currentTime < endTime または最後のセクションの場合は endTime まで含む
          let currentSection = currentAIPlan.sections.find((section, index) => {
            const isLastSection = index === currentAIPlan.sections.length - 1;
            if (isLastSection) {
              // 最後のセクションは endTime まで含む
              return (
                currentTime >= section.startTime &&
                currentTime <= section.endTime
              );
            } else {
              // それ以外は endTime を含まない
              return (
                currentTime >= section.startTime &&
                currentTime < section.endTime
              );
            }
          });

          // デバッグ：セクションが見つからない場合（毎回ログ出力）
          if (!currentSection) {
            console.warn(
              "[FerrofluidVisualizer] No section found for current time:",
              {
                currentTime: currentTime.toFixed(2),
                sections: currentAIPlan.sections.map((s, index) => {
                  const isLastSection =
                    index === currentAIPlan.sections.length - 1;
                  const inRange = isLastSection
                    ? currentTime >= s.startTime && currentTime <= s.endTime
                    : currentTime >= s.startTime && currentTime < s.endTime;
                  return {
                    name: s.name,
                    index: index,
                    start: s.startTime.toFixed(2),
                    end: s.endTime.toFixed(2),
                    duration: (s.endTime - s.startTime).toFixed(2),
                    isLastSection,
                    inRange,
                    beforeStart: currentTime < s.startTime,
                    afterEnd: currentTime > s.endTime,
                    timeDiff:
                      currentTime < s.startTime
                        ? (s.startTime - currentTime).toFixed(2)
                        : currentTime > s.endTime
                        ? (currentTime - s.endTime).toFixed(2)
                        : "0.00",
                  };
                }),
                totalDuration:
                  currentAIPlan.sections.length > 0
                    ? currentAIPlan.sections[
                        currentAIPlan.sections.length - 1
                      ].endTime.toFixed(2)
                    : "unknown",
              }
            );
          }

          if (currentSection) {
            currentAIPlanParams = {
              energy: currentSection.energy,
              tension: currentSection.tension,
              spikeAmount: currentSection.spikeAmount,
              noiseAmount: currentSection.noiseAmount,
              motionStyle: currentSection.motionStyle,
            };

            // デバッグログ：AIプランが適用されていることを確認（毎回ログ出力）
            console.log("[FerrofluidVisualizer] AI plan section applied:", {
              sectionName: currentSection.name,
              currentTime: currentTime.toFixed(2),
              sectionStart: currentSection.startTime.toFixed(2),
              sectionEnd: currentSection.endTime.toFixed(2),
              energy: currentSection.energy,
              tension: currentSection.tension,
              spikeAmount: currentSection.spikeAmount,
              noiseAmount: currentSection.noiseAmount,
              motionStyle: currentSection.motionStyle,
              hasColorPalette:
                !!currentSection.colorPalette &&
                currentSection.colorPalette.length > 0,
            });

            // 背景にもカラーパレットを適用
            if (
              currentSection.colorPalette &&
              currentSection.colorPalette.length > 0 &&
              sceneRef.current?.backgroundMaterial
            ) {
              const bgMaterial = sceneRef.current.backgroundMaterial;
              const colors = currentSection.colorPalette;

              // カラーパレットから3色を取得（足りない場合は繰り返す）
              const getColor = (index: number) => {
                const colorHex = colors[index % colors.length];
                return new THREE.Color(
                  colorHex?.startsWith("#") ? colorHex : `#${colorHex}`
                );
              };

              const color1 = getColor(0);
              const color2 = getColor(1);
              const color3 = getColor(2);

              bgMaterial.uniforms.uColor1.value.set(
                color1.r,
                color1.g,
                color1.b
              );
              bgMaterial.uniforms.uColor2.value.set(
                color2.r,
                color2.g,
                color2.b
              );
              bgMaterial.uniforms.uColor3.value.set(
                color3.r,
                color3.g,
                color3.b
              );
              bgMaterial.uniforms.uUseAIColors.value = 1.0;

              console.log(
                "[FerrofluidVisualizer] Background colors applied (section):",
                {
                  sectionName: currentSection.name,
                  colors: [
                    color1.getHexString(),
                    color2.getHexString(),
                    color3.getHexString(),
                  ],
                  rgb1: { r: color1.r, g: color1.g, b: color1.b },
                  rgb2: { r: color2.r, g: color2.g, b: color2.b },
                  rgb3: { r: color3.r, g: color3.g, b: color3.b },
                  uUseAIColors: bgMaterial.uniforms.uUseAIColors.value,
                }
              );
            } else {
              // デバッグ：背景カラーが適用されない理由をログ出力
              console.warn(
                "[FerrofluidVisualizer] Background colors NOT applied (section):",
                {
                  sectionName: currentSection.name,
                  hasColorPalette: !!currentSection.colorPalette,
                  colorPaletteLength: currentSection.colorPalette?.length || 0,
                  hasBackgroundMaterial: !!sceneRef.current?.backgroundMaterial,
                  colorPalette: currentSection.colorPalette,
                }
              );
            }

            // カラーパレットをマテリアルに適用
            if (
              currentSection.colorPalette &&
              currentSection.colorPalette.length > 0
            ) {
              if (!sceneRef.current?.ferrofluidMaterial) {
                console.warn(
                  "[FerrofluidVisualizer] ferrofluidMaterial is not set"
                );
              } else {
                const material = sceneRef.current.ferrofluidMaterial;
                // 複数の色がある場合は時間に基づいてブレンド
                if (currentSection.colorPalette.length > 1) {
                  const time = sceneRef.current.clock.getElapsedTime();
                  const colorIndex =
                    Math.floor(time * 0.5) % currentSection.colorPalette.length;
                  const nextColorIndex =
                    (colorIndex + 1) % currentSection.colorPalette.length;
                  const t = (time * 0.5) % 1.0;

                  try {
                    const color1Hex = currentSection.colorPalette[colorIndex];
                    const color2Hex =
                      currentSection.colorPalette[nextColorIndex];
                    const color1Value = color1Hex.startsWith("#")
                      ? parseInt(color1Hex.substring(1), 16)
                      : parseInt(color1Hex, 16);
                    const color2Value = color2Hex.startsWith("#")
                      ? parseInt(color2Hex.substring(1), 16)
                      : parseInt(color2Hex, 16);

                    const color1 = new THREE.Color(color1Value);
                    const color2 = new THREE.Color(color2Value);
                    material.color.lerpColors(color1, color2, t);
                    // より鮮やかに見えるように、明度を上げる
                    material.color.multiplyScalar(1.3);
                    // clampは存在しないので、手動で値を制限
                    material.color.r = Math.max(
                      0,
                      Math.min(1, material.color.r)
                    );
                    material.color.g = Math.max(
                      0,
                      Math.min(1, material.color.g)
                    );
                    material.color.b = Math.max(
                      0,
                      Math.min(1, material.color.b)
                    );
                    material.needsUpdate = true;

                    // デバッグログ：カラーが変更されたことを確認（1秒ごとに1回）
                    if (Math.floor(time * 2) % 2 === 0) {
                      console.log(
                        "[FerrofluidVisualizer] Color updated (section):",
                        {
                          color1: color1Hex,
                          color2: color2Hex,
                          currentColor: material.color.getHexString(),
                        }
                      );
                    }
                  } catch (e) {
                    console.warn("Invalid color hex:", e);
                  }
                } else {
                  // 単一の色の場合
                  const colorHex = currentSection.colorPalette[0];
                  try {
                    const colorValue = colorHex.startsWith("#")
                      ? parseInt(colorHex.substring(1), 16)
                      : parseInt(colorHex, 16);
                    material.color.setHex(colorValue);
                    // より鮮やかに見えるように、明度を上げる
                    material.color.multiplyScalar(1.3);
                    // clampは存在しないので、手動で値を制限
                    material.color.r = Math.max(
                      0,
                      Math.min(1, material.color.r)
                    );
                    material.color.g = Math.max(
                      0,
                      Math.min(1, material.color.g)
                    );
                    material.color.b = Math.max(
                      0,
                      Math.min(1, material.color.b)
                    );
                    material.needsUpdate = true;

                    // デバッグログ：カラーが変更されたことを確認
                    console.log(
                      "[FerrofluidVisualizer] Single color applied (section):",
                      {
                        color: colorHex,
                        hexValue: material.color.getHexString(),
                      }
                    );
                  } catch (e) {
                    console.warn("Invalid color hex:", colorHex);
                  }
                }
              }
            } else {
              console.warn(
                "[FerrofluidVisualizer] No color palette in current section"
              );
            }
          } else if (currentAIPlan.global) {
            // セクションが見つからない場合はグローバル設定を使用
            currentAIPlanParams = {
              energy: currentAIPlan.global.baseEnergy,
              tension: currentAIPlan.global.baseTension,
              spikeAmount: 0,
              noiseAmount: 1.0,
              motionStyle: "default",
            };

            console.log("[FerrofluidVisualizer] Using global AI plan params:", {
              currentTime: currentTime.toFixed(2),
              baseEnergy: currentAIPlan.global.baseEnergy,
              baseTension: currentAIPlan.global.baseTension,
              hasColorPalette: !!currentAIPlan.global.colorPalette,
              colorPaletteLength:
                currentAIPlan.global.colorPalette?.length || 0,
              hasBackgroundMaterial: !!sceneRef.current?.backgroundMaterial,
            });

            // 背景にもグローバルカラーパレットを適用
            if (
              currentAIPlan.global.colorPalette &&
              currentAIPlan.global.colorPalette.length > 0 &&
              sceneRef.current?.backgroundMaterial
            ) {
              const bgMaterial = sceneRef.current.backgroundMaterial;
              const colors = currentAIPlan.global.colorPalette;

              // カラーパレットから3色を取得（足りない場合は繰り返す）
              const getColor = (index: number) => {
                const colorHex = colors[index % colors.length];
                return new THREE.Color(
                  colorHex?.startsWith("#") ? colorHex : `#${colorHex}`
                );
              };

              const color1 = getColor(0);
              const color2 = getColor(1);
              const color3 = getColor(2);

              bgMaterial.uniforms.uColor1.value.set(
                color1.r,
                color1.g,
                color1.b
              );
              bgMaterial.uniforms.uColor2.value.set(
                color2.r,
                color2.g,
                color2.b
              );
              bgMaterial.uniforms.uColor3.value.set(
                color3.r,
                color3.g,
                color3.b
              );
              bgMaterial.uniforms.uUseAIColors.value = 1.0;
              bgMaterial.needsUpdate = true; // シェーダーの更新を確実にする

              console.log(
                "[FerrofluidVisualizer] Background colors applied (global):",
                {
                  colors: [
                    color1.getHexString(),
                    color2.getHexString(),
                    color3.getHexString(),
                  ],
                  rgb1: { r: color1.r, g: color1.g, b: color1.b },
                  rgb2: { r: color2.r, g: color2.g, b: color2.b },
                  rgb3: { r: color3.r, g: color3.g, b: color3.b },
                  uUseAIColors: bgMaterial.uniforms.uUseAIColors.value,
                }
              );
            } else {
              // デバッグ：背景カラーが適用されない理由をログ出力
              console.warn(
                "[FerrofluidVisualizer] Background colors NOT applied (global):",
                {
                  hasColorPalette: !!currentAIPlan.global.colorPalette,
                  colorPaletteLength:
                    currentAIPlan.global.colorPalette?.length || 0,
                  hasBackgroundMaterial: !!sceneRef.current?.backgroundMaterial,
                  colorPalette: currentAIPlan.global.colorPalette,
                }
              );
            }

            // グローバルカラーパレットをマテリアルに適用
            if (
              currentAIPlan.global.colorPalette &&
              currentAIPlan.global.colorPalette.length > 0 &&
              sceneRef.current?.ferrofluidMaterial
            ) {
              const material = sceneRef.current.ferrofluidMaterial;
              // 複数の色がある場合は時間に基づいてブレンド
              if (currentAIPlan.global.colorPalette.length > 1) {
                const time = sceneRef.current.clock.getElapsedTime();
                const colorIndex =
                  Math.floor(time * 0.5) %
                  currentAIPlan.global.colorPalette.length;
                const nextColorIndex =
                  (colorIndex + 1) % currentAIPlan.global.colorPalette.length;
                const t = (time * 0.5) % 1.0;

                try {
                  const color1Hex =
                    currentAIPlan.global.colorPalette[colorIndex];
                  const color2Hex =
                    currentAIPlan.global.colorPalette[nextColorIndex];
                  const color1Value = color1Hex.startsWith("#")
                    ? parseInt(color1Hex.substring(1), 16)
                    : parseInt(color1Hex, 16);
                  const color2Value = color2Hex.startsWith("#")
                    ? parseInt(color2Hex.substring(1), 16)
                    : parseInt(color2Hex, 16);

                  const color1 = new THREE.Color(color1Value);
                  const color2 = new THREE.Color(color2Value);
                  material.color.lerpColors(color1, color2, t);
                  // より鮮やかに見えるように、明度を上げる
                  material.color.multiplyScalar(1.3);
                  // clampは存在しないので、手動で値を制限
                  material.color.r = Math.max(0, Math.min(1, material.color.r));
                  material.color.g = Math.max(0, Math.min(1, material.color.g));
                  material.color.b = Math.max(0, Math.min(1, material.color.b));
                  material.needsUpdate = true;

                  // デバッグログ：カラーが変更されたことを確認（1秒ごとに1回）
                  if (Math.floor(time * 2) % 2 === 0) {
                    console.log(
                      "[FerrofluidVisualizer] Color updated (global):",
                      {
                        color1: color1Hex,
                        color2: color2Hex,
                        currentColor: material.color.getHexString(),
                      }
                    );
                  }
                } catch (e) {
                  console.warn("Invalid color hex:", e);
                }
              } else {
                // 単一の色の場合
                const colorHex = currentAIPlan.global.colorPalette[0];
                try {
                  // より正確に色を適用
                  material.color.set(
                    colorHex.startsWith("#") ? colorHex : `#${colorHex}`
                  );
                  // より鮮やかに見えるように、明度を上げる（ただし、色のバランスを保つ）
                  material.color.multiplyScalar(1.2);
                  // clampは存在しないので、手動で値を制限
                  material.color.r = Math.max(0, Math.min(1, material.color.r));
                  material.color.g = Math.max(0, Math.min(1, material.color.g));
                  material.color.b = Math.max(0, Math.min(1, material.color.b));
                  material.needsUpdate = true;

                  // デバッグログ：適用された色を確認
                  console.log(
                    "[FerrofluidVisualizer] Single color applied (section):",
                    {
                      colorHex,
                      finalColor: `#${material.color.getHexString()}`,
                      rgb: {
                        r: material.color.r.toFixed(3),
                        g: material.color.g.toFixed(3),
                        b: material.color.b.toFixed(3),
                      },
                    }
                  );

                  // デバッグログ：カラーが変更されたことを確認
                  console.log(
                    "[FerrofluidVisualizer] Single color applied (global):",
                    {
                      color: colorHex,
                      hexValue: material.color.getHexString(),
                    }
                  );
                } catch (e) {
                  console.warn("Invalid color hex:", colorHex);
                }
              }
            }
          }
        }

        // デバッグ：AIプランパラメータが渡されているか確認
        if (currentAIPlanParams) {
          const aiParamLogCount = (window as any).__aiParamLogCount || 0;
          if (aiParamLogCount < 3) {
            (window as any).__aiParamLogCount = aiParamLogCount + 1;
            console.log(
              "[FerrofluidVisualizer] Passing AI plan params to makeRoughBall:",
              currentAIPlanParams
            );
          }
        }

        makeRoughBall(
          ball,
          modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8),
          modulate(upperAvgFr, 0, 1, 0, 4),
          mousePosition,
          mouseActive,
          currentAIPlanParams
        );
      } else {
        // Even without audio, apply mouse attraction and AI plan if available
        let currentAIPlanParams:
          | {
              energy: number;
              tension: number;
              spikeAmount: number;
              noiseAmount: number;
              motionStyle: string;
            }
          | undefined = undefined;

        if (aiPlan && aiPlan.global) {
          // グローバル設定を使用
          currentAIPlanParams = {
            energy: aiPlan.global.baseEnergy,
            tension: aiPlan.global.baseTension,
            spikeAmount: 0,
            noiseAmount: 1.0,
            motionStyle: "default",
          };

          // グローバルカラーパレットをマテリアルに適用
          if (
            aiPlan.global.colorPalette &&
            aiPlan.global.colorPalette.length > 0 &&
            sceneRef.current?.ferrofluidMaterial
          ) {
            const material = sceneRef.current.ferrofluidMaterial;
            const colorHex = aiPlan.global.colorPalette[0];
            try {
              const colorValue = colorHex.startsWith("#")
                ? parseInt(colorHex.substring(1), 16)
                : parseInt(colorHex, 16);
              material.color.setHex(colorValue);
              material.needsUpdate = true;
            } catch (e) {
              console.warn("Invalid color hex:", colorHex);
            }
          }
        }

        makeRoughBall(
          ball,
          0,
          0,
          mousePosition,
          mouseActive,
          currentAIPlanParams
        );
      }

      group.rotation.y += 0.005;
      sceneRef.current.renderer.render(
        sceneRef.current.scene,
        sceneRef.current.camera
      );
      sceneRef.current.animationId = requestAnimationFrame(render);
    };

    sceneRef.current.animationId = requestAnimationFrame(render);

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !sceneRef.current) return;
      // Use full viewport size, accounting for mobile browser UI
      const getViewportSize = () => {
        // Use visualViewport if available (better for mobile)
        if (window.visualViewport) {
          return {
            width: window.visualViewport.width,
            height: window.visualViewport.height,
          };
        }
        // Fallback to window size
        return {
          width: window.innerWidth,
          height: window.innerHeight,
        };
      };

      const { width, height } = getViewportSize();

      sceneRef.current.camera.aspect = width / height;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(width, height);

      // Update background plane size and resolution
      sceneRef.current.scene.children.forEach((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.ShaderMaterial
        ) {
          if (child.material.uniforms.uResolution) {
            child.material.uniforms.uResolution.value.set(width, height);
          }
          if (child.geometry instanceof THREE.PlaneGeometry) {
            // Make background plane large enough to cover camera view
            const size = Math.max(width, height) * 3;
            child.geometry.dispose();
            child.geometry = new THREE.PlaneGeometry(size, size);
          }
        }
      });
    };

    window.addEventListener("resize", handleResize);
    // Also listen to visualViewport changes for mobile browsers
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      // Cleanup visualViewport listeners
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      }
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        if (sceneRef.current.audioContext) {
          sceneRef.current.audioContext.close();
        }
        // Clean up audio file if playing
        if (audioRef.current) {
          audioRef.current.pause();
          if (audioRef.current.src.startsWith("blob:")) {
            URL.revokeObjectURL(audioRef.current.src);
          }
        }
        // Clean up system audio stream
        if (systemAudioStreamRef.current) {
          systemAudioStreamRef.current.getTracks().forEach((track) => {
            track.stop();
          });
        }
        if (
          containerElement &&
          containerElement.contains(sceneRef.current.renderer.domElement)
        ) {
          containerElement.removeChild(sceneRef.current.renderer.domElement);
        }
        sceneRef.current.renderer.dispose();
      }
    };
  }, []);

  const startMicrophone = async () => {
    try {
      setError(null);

      // Stop other audio sources
      if (isPlayingFile) {
        stopAudioFile();
      }
      if (isSystemAudio) {
        stopSystemAudio();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!sceneRef.current) return;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      source.connect(analyser);
      // analyser.connect(audioContext.destination);
      analyser.fftSize = 512;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      sceneRef.current.analyser = analyser;
      sceneRef.current.audioContext = audioContext;
      sceneRef.current.dataArray = dataArray;

      // AIタイムライン収集を開始
      if (enableAITimelineRef.current) {
        timelineFramesRef.current = [];
        timelineStartTimeRef.current = audioContext.currentTime;
        setTimelineFrameCount(0);
        console.log(
          "[FerrofluidVisualizer] AI timeline collection started (mic)"
        );
      }

      setIsRecording(true);
    } catch (err) {
      // Silently handle errors - don't show error message
      console.error("Error accessing microphone:", err);
      setIsRecording(false);
    }
  };

  const startSystemAudio = async () => {
    try {
      setError(null);

      // Stop other audio sources
      if (isRecording) {
        stopMicrophone();
      }
      if (isPlayingFile) {
        stopAudioFile();
      }

      // Request screen share with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      if (!sceneRef.current) return;

      // Store stream reference for cleanup
      systemAudioStreamRef.current = stream;

      // Handle stream end (user stops sharing)
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopSystemAudio();
      });

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      source.connect(analyser);
      // Don't connect to destination to avoid double playback
      // analyser.connect(audioContext.destination);
      analyser.fftSize = 512;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      sceneRef.current.analyser = analyser;
      sceneRef.current.audioContext = audioContext;
      sceneRef.current.dataArray = dataArray;

      // AIタイムライン収集を開始
      if (enableAITimelineRef.current) {
        timelineFramesRef.current = [];
        timelineStartTimeRef.current = audioContext.currentTime;
        setTimelineFrameCount(0);
        console.log(
          "[FerrofluidVisualizer] AI timeline collection started (system audio)"
        );
      }

      setIsSystemAudio(true);

      // Auto-start PiP when screen sharing starts
      if (!isPiPActive && document.pictureInPictureEnabled) {
        try {
          await startPictureInPicture();
        } catch {
          // Silently fail - don't show error
        }
      }
    } catch (err) {
      // Silently handle errors on mobile - system audio is often not supported
      console.error("Error accessing system audio:", err);
      setIsSystemAudio(false);

      // Only show error on desktop, not on mobile
      if (window.innerWidth >= 768) {
        setError(
          "Screen share audio access was denied. Please check your browser settings."
        );
        // Auto-clear error after 3 seconds
        setTimeout(() => {
          setError(null);
        }, 3000);
      }
    }
  };

  const stopSystemAudio = () => {
    // Stop all tracks in the stream
    if (systemAudioStreamRef.current) {
      systemAudioStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      systemAudioStreamRef.current = null;
    }

    if (sceneRef.current?.audioContext) {
      sceneRef.current.audioContext.close();
      sceneRef.current.analyser = null;
      sceneRef.current.audioContext = null;
      sceneRef.current.dataArray = null;
    }

    // 停止時にAIプランを生成（タイムラインが収集されている場合）
    if (enableAITimelineRef.current && timelineFramesRef.current.length > 0) {
      console.log(
        "[FerrofluidVisualizer] Stopping system audio, generating AI plan with",
        timelineFramesRef.current.length,
        "frames"
      );
      generateAIPlanFromTimeline();
    }

    setIsSystemAudio(false);
  };

  const startPictureInPicture = useCallback(async () => {
    if (!sceneRef.current?.renderer?.domElement) {
      setError("Canvas not available for Picture-in-Picture");
      return;
    }

    const canvas = sceneRef.current.renderer.domElement;

    // Check if Picture-in-Picture API is supported
    if (!document.pictureInPictureEnabled) {
      setError("Picture-in-Picture is not supported in this browser");
      return;
    }

    try {
      // Create a video element to use for PiP
      const video = document.createElement("video");
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = `${canvas.width}px`;
      video.style.height = `${canvas.height}px`;

      // Capture canvas stream and set it to video
      const stream = canvas.captureStream(60); // 60 FPS
      video.srcObject = stream;
      video.play();

      // Store video reference
      pipVideoRef.current = video;

      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve).catch(resolve);
        };
      });

      // Request Picture-in-Picture
      await video.requestPictureInPicture();
      setIsPiPActive(true);
      setError(null); // Clear any previous errors

      // Listen for when PiP is closed
      video.addEventListener(
        "leavepictureinpicture",
        () => {
          setIsPiPActive(false);
          // Cleanup
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
          video.srcObject = null;
          pipVideoRef.current = null;
        },
        { once: true }
      );
    } catch (err) {
      // Silently handle errors without showing to user or console
      const error = err as Error;

      // Only log non-permission errors for debugging
      if (
        error.name !== "NotAllowedError" &&
        !error.message.includes("Permission denied") &&
        !error.message.includes("denied by user")
      ) {
        console.error("Picture-in-Picture error:", err);
      }

      setIsPiPActive(false);

      // Cleanup on error
      if (pipVideoRef.current) {
        if (pipVideoRef.current.srcObject) {
          const stream = pipVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }
        pipVideoRef.current.srcObject = null;
        pipVideoRef.current = null;
      }

      // Don't show error message to user - fail silently
    }
  }, []);

  // Auto-start PiP when user leaves the page/tab
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // If page becomes hidden and PiP is not already active, start PiP
      if (document.hidden && !isPiPActive) {
        // Check if PiP is supported
        if (document.pictureInPictureEnabled) {
          try {
            await startPictureInPicture();
          } catch {
            // Silently fail - don't show error
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPiPActive, startPictureInPicture]);

  const stopPictureInPicture = async () => {
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
        // Cleanup video element
        if (pipVideoRef.current) {
          if (pipVideoRef.current.srcObject) {
            const stream = pipVideoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
          }
          pipVideoRef.current.srcObject = null;
          pipVideoRef.current = null;
        }
      } catch (err) {
        setError("Failed to stop Picture-in-Picture");
        console.error("Picture-in-Picture exit error:", err);
      }
    }
  };

  const playAudioFromSource = async (audioSrc: string) => {
    // Stop other audio sources
    if (isRecording) {
      stopMicrophone();
    }
    if (isSystemAudio) {
      stopSystemAudio();
    }

    // Stop and cleanup previous audio if exists
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (sceneRef.current?.audioContext) {
      try {
        await sceneRef.current.audioContext.close();
      } catch {
        // Ignore errors when closing
      }
      sceneRef.current.analyser = null;
      sceneRef.current.audioContext = null;
      sceneRef.current.dataArray = null;
    }

    setError(null);

    // Create audio element
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = audioSrc;
    // Don't mute - we'll use WebAudio for analysis but let audio element play
    // audio.muted = true;

    audioRef.current = audio;

    try {
      // Wait for audio to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Audio loading timeout"));
        }, 10000); // 10 second timeout

        audio.addEventListener(
          "loadeddata",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );
        audio.addEventListener(
          "error",
          (e) => {
            clearTimeout(timeout);
            reject(e);
          },
          { once: true }
        );
        // Start loading
        audio.load();
      });

      if (!sceneRef.current) {
        throw new Error("Scene not initialized");
      }

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      // Create new AudioContext
      const audioContext = new AudioContextClass();

      // Resume AudioContext if suspended (required for user interaction)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Create media element source - this connects audio element to WebAudio
      const source = audioContext.createMediaElementSource(audio);
      const analyser = audioContext.createAnalyser();

      // Connect: source -> analyser -> destination
      // This allows both analysis and playback
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      analyser.fftSize = 512;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      sceneRef.current.analyser = analyser;
      sceneRef.current.audioContext = audioContext;
      sceneRef.current.dataArray = dataArray;

      setIsPlayingFile(true);
      setIsModalOpen(false);
      setIsPaused(false);

      // Set default volume (50%)
      audio.volume = volume;

      // Update duration when metadata is loaded
      audio.addEventListener("loadedmetadata", () => {
        if (
          audio.duration &&
          !isNaN(audio.duration) &&
          audio.duration !== Infinity
        ) {
          setDuration(audio.duration);
        }
      });

      // Also try to get duration after canplay event
      audio.addEventListener("canplay", () => {
        if (
          audio.duration &&
          !isNaN(audio.duration) &&
          audio.duration !== Infinity
        ) {
          setDuration(audio.duration);
        }
      });

      // Update current time
      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);
      });

      // Update track info
      const trackName =
        currentTrack?.name || audioSrc.split("/").pop() || "Unknown";
      setCurrentTrack({ name: trackName, url: audioSrc });

      // AIタイムライン収集を開始（再生開始時に）
      // playイベントでタイムライン収集を開始する
      const startTimelineCollection = () => {
        if (enableAITimelineRef.current) {
          timelineFramesRef.current = [];
          // ファイル再生の場合は、audio.currentTimeが0から始まるので、timelineStartTimeRefは0に設定
          timelineStartTimeRef.current = 0;
          setTimelineFrameCount(0);
          console.log(
            "[FerrofluidVisualizer] AI timeline collection started (file - on play)",
            {
              audioDuration: audio.duration,
              audioReady: !audio.paused,
              currentTime: audio.currentTime,
            }
          );
        }
      };

      // playイベントでタイムライン収集を開始
      audio.addEventListener("play", startTimelineCollection, { once: true });

      // Play audio
      await audio.play();
      console.log("Audio playing:", audioSrc);

      // 再生開始後にもタイムライン収集を開始（playイベントが発火しない場合に備える）
      // ただし、playイベントで既に開始されている場合はスキップ
      // このフォールバックは不要になったので削除（playイベントで確実に開始される）
    } catch (err) {
      console.error("Error loading/playing audio file:", err);
      setError(
        `Failed to load or play audio file: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      setIsPlayingFile(false);
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    }

    audio.addEventListener("ended", () => {
      setIsPlayingFile(false);
      setIsPaused(false);

      // 再生終了時にAIプランを生成（タイムラインが収集されている場合）
      if (enableAITimelineRef.current && timelineFramesRef.current.length > 0) {
        console.log(
          "[FerrofluidVisualizer] Audio ended, generating AI plan with",
          timelineFramesRef.current.length,
          "frames"
        );
        generateAIPlanFromTimeline();
      }
    });

    // Handle pause/play events
    audio.addEventListener("pause", () => {
      setIsPaused(true);
    });
    audio.addEventListener("play", () => {
      setIsPaused(false);
    });
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB to avoid localStorage quota issues)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError(`File size exceeds 5MB limit. Please use a smaller file.`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    // Extract metadata from audio file
    let trackTitle = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    let artistName = "";

    try {
      const metadata = await parseBlob(file);
      if (metadata.common.title) {
        trackTitle = metadata.common.title;
      }
      if (metadata.common.artist) {
        artistName = metadata.common.artist;
      }
    } catch (err) {
      console.warn("Could not extract metadata:", err);
      // Fallback to filename
    }

    // Convert file to base64 and save to localStorage
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const base64Data = e.target?.result as string;
        const displayName = artistName
          ? `${artistName} - ${trackTitle}`
          : trackTitle;
        const newFile = {
          name: displayName,
          data: base64Data,
        };

        // Limit saved files to 3 most recent to avoid quota issues
        const maxSavedFiles = 3;
        const updatedFiles = [...savedAudioFiles, newFile].slice(
          -maxSavedFiles
        );

        // Try to save to localStorage
        try {
          localStorage.setItem("ferroAudioFiles", JSON.stringify(updatedFiles));
          setSavedAudioFiles(updatedFiles);
        } catch (storageError) {
          // If storage quota exceeded, remove oldest files and try again
          if (
            storageError instanceof DOMException &&
            storageError.name === "QuotaExceededError"
          ) {
            // Keep only the newest file
            const newestFiles = [newFile];
            try {
              localStorage.setItem(
                "ferroAudioFiles",
                JSON.stringify(newestFiles)
              );
              setSavedAudioFiles(newestFiles);
              setError(
                "Storage limit reached. Only the most recent file is saved."
              );
              setTimeout(() => setError(null), 5000);
            } catch (retryError) {
              // If still fails, don't save but still play the file
              console.warn("Could not save file to localStorage:", retryError);
              setError("Could not save file, but playing it now.");
              setTimeout(() => setError(null), 3000);
            }
          } else {
            throw storageError;
          }
        }

        // Play the uploaded file
        playAudioFromSource(base64Data);
      } catch (error) {
        console.error("Error processing file:", error);
        setError("Failed to process audio file.");
        setTimeout(() => setError(null), 5000);
      }
    };

    reader.onerror = () => {
      setError("Failed to read audio file.");
      setTimeout(() => setError(null), 5000);
    };

    reader.readAsDataURL(file);
  };

  const handleSampleSelect = (url: string, name: string) => {
    setCurrentTrack({ name, url });
    playAudioFromSource(url);
  };

  const handleSavedFileSelect = (data: string, name: string) => {
    setCurrentTrack({ name, url: data });
    playAudioFromSource(data);
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPaused) {
      audioRef.current.play();
      setIsPaused(false);
    } else {
      audioRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle player dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPlayerPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Handle YouTube player dragging
  useEffect(() => {
    if (!isDraggingYoutube) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - youtubeDragOffset.x;
      const newY = e.clientY - youtubeDragOffset.y;

      // ウィンドウの境界内に制限
      const maxX =
        window.innerWidth - (youtubePlayerRef.current?.offsetWidth || 320);
      const maxY =
        window.innerHeight - (youtubePlayerRef.current?.offsetHeight || 240);

      setYoutubePlayerPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDraggingYoutube(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingYoutube, youtubeDragOffset]);

  const handlePlayerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't start dragging if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.closest("button") ||
      target.closest("input")
    ) {
      return;
    }

    if (!playerRef.current) return;
    const rect = playerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    e.preventDefault();
  };

  const stopAudioFile = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (audioRef.current.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
    if (sceneRef.current?.audioContext) {
      sceneRef.current.audioContext.close();
      sceneRef.current.analyser = null;
      sceneRef.current.audioContext = null;
      sceneRef.current.dataArray = null;
    }

    // 停止時にAIプランを生成（タイムラインが収集されている場合）
    if (enableAITimelineRef.current && timelineFramesRef.current.length > 0) {
      console.log(
        "[FerrofluidVisualizer] Stopping audio file, generating AI plan with",
        timelineFramesRef.current.length,
        "frames"
      );
      generateAIPlanFromTimeline();
    }

    setIsPlayingFile(false);
  };

  // AudioSummaryを作成する関数（Reflection生成用）
  const createAudioSummary = (): AudioSummary | null => {
    if (timelineFramesRef.current.length === 0) {
      return null;
    }

    const frames = timelineFramesRef.current;
    const duration = frames[frames.length - 1]?.time || 0;

    // 統計を計算
    let sumRms = 0;
    let maxRms = 0;
    let sumBass = 0;
    let sumMid = 0;
    let sumTreble = 0;
    let sumFlux = 0;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      sumRms += frame.volumeRms;
      maxRms = Math.max(maxRms, frame.volumeRms);
      sumBass += frame.bass;
      sumTreble += frame.treble;

      // Midはbassとtrebleの中間として近似
      sumMid += (frame.bass + frame.treble) / 2;

      // Flux: 前フレームとの差分
      if (i > 0) {
        const prevFrame = frames[i - 1];
        const rmsDiff = Math.abs(frame.volumeRms - prevFrame.volumeRms);
        sumFlux += rmsDiff;
      }
    }

    const avgRms = sumRms / frames.length;
    const avgBass = sumBass / frames.length;
    const avgMid = sumMid / frames.length;
    const avgTreble = sumTreble / frames.length;
    const flux = frames.length > 1 ? sumFlux / (frames.length - 1) : 0;

    // UI言語を判定（userMoodTextから推測、デフォルトは英語）
    const uiLanguage: "en" | "ja" =
      userMoodText &&
      /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(userMoodText)
        ? "ja"
        : "en";

    return {
      duration,
      avgRms,
      maxRms,
      avgBass,
      avgMid,
      avgTreble,
      flux,
      userMoodText: userMoodText || undefined,
      uiLanguage,
    };
  };

  // Reflectionを生成する関数（スタブ実装）
  const generateReflection = async () => {
    const summary = createAudioSummary();
    if (!summary) {
      console.warn(
        "[FerrofluidVisualizer] Cannot generate reflection: no audio summary"
      );
      return;
    }

    if (!reflectionModuleRef.current) {
      reflectionModuleRef.current = new ReflectionModule();
    }

    if (!reflectionModuleRef.current.isAvailable()) {
      console.warn(
        "[FerrofluidVisualizer] ReflectionModule is not available (no API key)"
      );
      return;
    }

    setIsGeneratingReflection(true);
    try {
      const reflection = await reflectionModuleRef.current.generateReflection(
        summary
      );
      console.log("[FerrofluidVisualizer] Reflection generated:", reflection);
      setCurrentReflection(reflection);
    } catch (error) {
      console.error(
        "[FerrofluidVisualizer] Error generating reflection:",
        error
      );
    } finally {
      setIsGeneratingReflection(false);
    }
  };

  // AIプランを生成する関数
  const generateAIPlanFromTimeline = async () => {
    console.log("[FerrofluidVisualizer] generateAIPlanFromTimeline called");
    console.log(
      "[FerrofluidVisualizer] Timeline frames count:",
      timelineFramesRef.current.length
    );

    if (timelineFramesRef.current.length === 0) {
      const errorMsg =
        "タイムラインデータがありません。音声を再生してタイムラインを収集してください。";
      useAIPlanStore.getState().setError(errorMsg);
      console.warn("[FerrofluidVisualizer]", errorMsg);
      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (!aiPlannerRef.current) {
      console.log("[FerrofluidVisualizer] Creating new AIPlannerModule");
      aiPlannerRef.current = new AIPlannerModule();
    }

    // Check if AI planner is available
    if (!aiPlannerRef.current.isAvailable()) {
      const errorMsg =
        "OpenAI APIキーが設定されていません。.env.localファイルにNEXT_PUBLIC_OPENAI_API_KEYを設定し、開発サーバーを再起動してください。";
      useAIPlanStore.getState().setError(errorMsg);
      console.warn("[FerrofluidVisualizer]", errorMsg);
      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      // タイムラインを作成
      const sourceType: "file" | "mic" = isPlayingFile ? "file" : "mic";
      const timeline = {
        trackInfo: {
          duration:
            timelineFramesRef.current.length > 0
              ? timelineFramesRef.current[timelineFramesRef.current.length - 1]
                  .time
              : undefined,
          source: sourceType,
        },
        frames: timelineFramesRef.current,
      };

      console.log("[FerrofluidVisualizer] Generating AI plan with timeline:", {
        frames: timeline.frames.length,
        duration: timeline.trackInfo.duration,
        source: timeline.trackInfo.source,
        userMoodText,
      });

      const plan = await aiPlannerRef.current.generatePlan(
        timeline,
        userMoodText
      );

      console.log("[FerrofluidVisualizer] AI plan generated successfully:", {
        overallMood: plan.overallMood,
        sections: plan.sections.length,
        global: plan.global,
      });

      // 成功メッセージを表示
      setError(null);
    } catch (err) {
      const error = err as Error;
      console.error("[FerrofluidVisualizer] AI plan generation error:", error);
      const errorMsg = `AIプランの生成に失敗しました: ${error.message}`;
      useAIPlanStore.getState().setError(errorMsg);
      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
    }
  };

  const stopMicrophone = () => {
    if (sceneRef.current?.audioContext) {
      sceneRef.current.audioContext.close();
      sceneRef.current.analyser = null;
      sceneRef.current.audioContext = null;
      sceneRef.current.dataArray = null;
    }

    // 停止時にAIプランを生成（タイムラインが収集されている場合）
    if (enableAITimelineRef.current && timelineFramesRef.current.length > 0) {
      console.log(
        "[FerrofluidVisualizer] Stopping microphone, generating AI plan with",
        timelineFramesRef.current.length,
        "frames"
      );
      generateAIPlanFromTimeline();
    }

    setIsRecording(false);
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black"
      style={{ height: "100dvh" }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Simple control panel - Center */}
      <div className="absolute bottom-3 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-10 flex gap-2 sm:gap-3 items-center flex-wrap justify-center max-w-[calc(100%-8rem)] sm:max-w-none">
        {/* Sample Music button */}
        <div className="relative group">
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={isSystemAudio}
            className={`w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 backdrop-blur-md border border-white/20 ${
              isSystemAudio
                ? "cursor-not-allowed opacity-50 bg-blue-600/30"
                : "bg-blue-600/40 hover:bg-blue-600/50"
            } text-white drop-shadow-lg`}
          >
            <FaMusic className="drop-shadow-md text-xs sm:text-base" />
            <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
              Sample
            </span>
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/80 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 ease-out pointer-events-none z-50 backdrop-blur-sm">
            Select sample music or upload
            {/* Arrow pointing down to the button */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/80"></div>
          </div>
        </div>

        {/* Microphone button */}
        {!isRecording ? (
          <div className="relative group">
            <button
              onClick={startMicrophone}
              disabled={isPlayingFile || isSystemAudio}
              className={`w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 backdrop-blur-md border border-white/20 ${
                isPlayingFile || isSystemAudio
                  ? "cursor-not-allowed opacity-50 bg-purple-600/30"
                  : "bg-purple-600/40 hover:bg-purple-600/50"
              } text-white drop-shadow-lg`}
            >
              <FaMicrophone className="drop-shadow-md text-xs sm:text-base" />
              <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
                Mic
              </span>
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/80 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 ease-out pointer-events-none z-50 backdrop-blur-sm">
              Moves with sound. Enable microphone permission.
              {/* Arrow pointing down to the button */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/80"></div>
            </div>
          </div>
        ) : (
          <button
            onClick={stopMicrophone}
            className="w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full backdrop-blur-md bg-red-500/30 hover:bg-red-500/40 border border-red-400/30 text-white drop-shadow-lg shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <FaMicrophoneSlash className="drop-shadow-md text-xs sm:text-base" />
            <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
              Stop
            </span>
          </button>
        )}

        {/* System audio button */}
        {!isSystemAudio ? (
          <div className="relative group">
            <button
              onClick={() => setIsSystemModalOpen(true)}
              disabled={isPlayingFile || isRecording}
              className={`w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 backdrop-blur-md border border-white/20 ${
                isPlayingFile || isRecording
                  ? "cursor-not-allowed opacity-50 bg-green-600/30"
                  : "bg-green-600/40 hover:bg-green-600/50"
              } text-white drop-shadow-lg`}
            >
              <FaDesktop className="drop-shadow-md text-xs sm:text-base" />
              <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
                System
              </span>
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/80 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 ease-out pointer-events-none z-50 backdrop-blur-sm">
              Select audio source
              {/* Arrow pointing down to the button */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/80"></div>
            </div>
          </div>
        ) : (
          <button
            onClick={stopSystemAudio}
            className="w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full backdrop-blur-md bg-red-500/30 hover:bg-red-500/40 border border-red-400/30 text-white drop-shadow-lg shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <FaStop className="drop-shadow-md text-xs sm:text-base" />
            <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
              Stop
            </span>
          </button>
        )}

        {/* Stop audio file button */}
        {isPlayingFile && (
          <button
            onClick={stopAudioFile}
            className="w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full backdrop-blur-md bg-red-500/30 hover:bg-red-500/40 border border-red-400/30 text-white drop-shadow-lg shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <FaStop className="drop-shadow-md text-xs sm:text-base" />
            <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
              Stop
            </span>
          </button>
        )}
      </div>

      {/* Picture-in-Picture button - Right side */}
      {!isPiPActive ? (
        <div className="absolute bottom-3 sm:bottom-6 right-3 sm:right-6 z-10 group">
          <button
            onClick={startPictureInPicture}
            className="w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full backdrop-blur-md bg-indigo-600/40 hover:bg-indigo-600/50 border border-white/20 text-white drop-shadow-lg shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <FaExpand className="drop-shadow-md text-xs sm:text-base" />
            <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
              PiP
            </span>
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black/80 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 ease-out pointer-events-none z-50 backdrop-blur-sm">
            Open in floating window
            {/* Arrow pointing down to the button */}
            <div className="absolute top-full right-4 transform border-4 border-transparent border-t-black/80"></div>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-3 sm:bottom-6 right-3 sm:right-6 z-10 group">
          <button
            onClick={stopPictureInPicture}
            className="w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full backdrop-blur-md bg-indigo-500/30 hover:bg-indigo-500/40 border border-indigo-400/30 text-white drop-shadow-lg shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <FaCompress className="drop-shadow-md text-xs sm:text-base" />
            <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
              Exit
            </span>
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black/80 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 ease-out pointer-events-none z-50 backdrop-blur-sm">
            Close floating window
            {/* Arrow pointing down to the button */}
            <div className="absolute top-full right-4 transform border-4 border-transparent border-t-black/80"></div>
          </div>
        </div>
      )}

      {/* Reflection Display */}
      <ReflectionDisplay reflection={currentReflection} />

      {/* Error message */}
      {error && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {error}
        </div>
      )}

      {/* AI Error message */}
      {aiError && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-10 bg-yellow-600/90 text-white px-4 py-2 rounded-lg text-sm shadow-lg max-w-md">
          AI Analysis: {aiError}
        </div>
      )}

      {/* AI Generating Indicator */}
      {isAIGenerating && (
        <div className="absolute top-6 right-6 z-10 bg-blue-600/90 text-white px-4 py-2 rounded-lg text-sm shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          Analyzing mood...
        </div>
      )}

      {/* AI Plan Info */}
      {aiPlan && !isAIGenerating && (
        <div className="absolute top-6 right-6 z-10 bg-green-600/90 text-white px-4 py-2 rounded-lg text-sm shadow-lg max-w-xs">
          <div className="font-semibold mb-1">Mood: {aiPlan.overallMood}</div>
          <div className="text-xs">Sections: {aiPlan.sections.length}</div>
        </div>
      )}

      {/* AI Controls Panel */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white min-w-[280px] max-w-[320px]">
        <h3 className="text-lg font-semibold mb-3">AI Features</h3>

        {/* Enable AI Timeline Toggle */}
        <div className="mb-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={enableAITimeline}
              onChange={(e) => {
                const checked = e.target.checked;
                setEnableAITimeline(checked);
                enableAITimelineRef.current = checked; // refも更新
              }}
              disabled={
                isRecording || isPlayingFile || isSystemAudio || isAIGenerating
              }
              className="w-4 h-4"
            />
            <span>Enable AI Timeline Collection</span>
          </label>
        </div>

        {/* User Mood Text Input */}
        <div className="mb-3">
          <label className="block text-sm mb-1">
            Your mood or situation (optional)
          </label>
          <textarea
            value={userMoodText}
            onChange={(e) => setUserMoodText(e.target.value)}
            placeholder="e.g., I want to focus but I'm tired"
            className="w-full px-3 py-2 bg-white/10 border border-white/20 text-white rounded text-sm resize-none"
            rows={2}
            disabled={
              isRecording || isPlayingFile || isSystemAudio || isAIGenerating
            }
          />
        </div>

        {/* Manual Generate Button */}
        <button
          onClick={generateAIPlanFromTimeline}
          className="w-full px-4 py-2 bg-blue-600/40 hover:bg-blue-600/50 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            !enableAITimelineRef.current ||
            timelineFrameCount === 0 ||
            isAIGenerating
          }
        >
          {isAIGenerating
            ? "Generating AI Plan..."
            : timelineFrameCount === 0
            ? "Please collect timeline first"
            : `Generate AI Plan (${timelineFrameCount} frames)`}
        </button>

        {/* Reflection Test Button (Stub) */}
        {timelineFrameCount > 0 && (
          <button
            onClick={generateReflection}
            className="w-full mt-2 px-4 py-2 bg-purple-600/40 hover:bg-purple-600/50 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            disabled={isGeneratingReflection || timelineFrameCount === 0}
          >
            {isGeneratingReflection
              ? "Generating Reflection..."
              : "Generate Reflection (Test)"}
          </button>
        )}

        {/* Timeline Info */}
        {enableAITimeline && (
          <div className="mt-3 p-2 bg-white/5 rounded text-xs">
            <div>Frames collected: {timelineFrameCount}</div>
            {timelineFrameCount > 0 && (
              <div>
                Collection time:{" "}
                {timelineFramesRef.current[
                  timelineFrameCount - 1
                ]?.time.toFixed(1) || "0.0"}
                s
              </div>
            )}
            {timelineFrameCount === 0 && (
              <div className="text-yellow-400 mt-1">
                ⚠️ Please play audio to collect timeline
                {isPlayingFile && audioRef.current && (
                  <div className="text-xs mt-1">
                    {audioRef.current.paused ? "(Paused)" : "(Playing)"}
                  </div>
                )}
              </div>
            )}
            {timelineFrameCount > 0 && (
              <div className="text-green-400 mt-1">
                {isPlayingFile || isRecording || isSystemAudio ? (
                  <>
                    ✓ Collecting timeline...
                    {isPlayingFile &&
                      audioRef.current &&
                      audioRef.current.paused && (
                        <span className="text-yellow-400 ml-1">(Paused)</span>
                      )}
                  </>
                ) : (
                  <>
                    ✓ Timeline collection complete ({timelineFrameCount} frames)
                  </>
                )}
              </div>
            )}
            {/* Debug info */}
            {isPlayingFile && audioRef.current && (
              <div className="text-xs mt-1 text-white/40">
                Playback: {audioRef.current.currentTime.toFixed(1)}s /{" "}
                {audioRef.current.duration.toFixed(1)}s
              </div>
            )}
          </div>
        )}

        {/* AI Plan Info */}
        {aiPlan && !isAIGenerating && (
          <div className="mt-3 p-2 bg-green-500/20 border border-green-400/30 rounded text-xs">
            <div className="font-semibold mb-1">✓ AI Plan Generated</div>
            <div>Mood: {aiPlan.overallMood}</div>
            <div>Sections: {aiPlan.sections.length}</div>
            {aiPlan.global.colorPalette &&
              aiPlan.global.colorPalette.length > 0 && (
                <div className="mt-1">
                  Colors: {aiPlan.global.colorPalette.join(", ")}
                </div>
              )}
            {(aiPlan.explanation || aiPlan.encouragement) && (
              <div className="mt-2 pt-2 border-t border-green-400/20">
                <div className="text-green-300 font-medium mb-1">
                  💭 Message
                </div>
                <div className="text-white/90 text-xs leading-relaxed">
                  {aiPlan.explanation && (
                    <div className="mb-2">{aiPlan.explanation}</div>
                  )}
                  {aiPlan.encouragement && <div>{aiPlan.encouragement}</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Music Player */}
      {isPlayingFile && audioRef.current && (
        <div
          ref={playerRef}
          className="absolute z-10 w-full max-w-md px-4 cursor-move select-none"
          style={{
            left: playerPosition.x === 0 ? "50%" : `${playerPosition.x}px`,
            top: playerPosition.y === 0 ? "1rem" : `${playerPosition.y}px`,
            transform:
              playerPosition.x === 0 && playerPosition.y === 0
                ? "translateX(-50%)"
                : "none",
          }}
          onMouseDown={handlePlayerMouseDown}
        >
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-4">
            {/* Header with drag handle and close button */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <div
                className="flex items-center gap-2 cursor-move text-white/60 hover:text-white/80 transition-colors"
                onMouseDown={handlePlayerMouseDown}
              >
                <FaGripVertical className="text-sm" />
                <span className="text-xs">Drag to move</span>
              </div>
              <button
                onClick={stopAudioFile}
                className="w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            {/* Track Info */}
            <div className="flex items-center gap-4 mb-4">
              {/* Artwork Placeholder */}
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center shrink-0">
                <FaMusic className="text-white text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm truncate">
                  {currentTrack?.name || "Unknown Track"}
                </h3>
                <p className="text-white/70 text-xs truncate">
                  {formatTime(currentTime)} /{" "}
                  {duration > 0 ? formatTime(duration) : "--:--"}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 100}
                value={currentTime}
                onChange={(e) => {
                  const newTime = parseFloat(e.target.value);
                  if (audioRef.current) {
                    audioRef.current.currentTime = newTime;
                    setCurrentTime(newTime);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white/50"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0"
                type="button"
              >
                {isPaused ? (
                  <FaPlay className="text-lg ml-0.5" />
                ) : (
                  <FaPause className="text-lg" />
                )}
              </button>

              {/* Volume Control */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => handleVolumeChange(volume > 0 ? 0 : 0.5)}
                  className="text-white/80 hover:text-white transition-colors flex-shrink-0"
                  type="button"
                >
                  {volume === 0 ? (
                    <FaVolumeMute className="text-lg" />
                  ) : volume < 0.5 ? (
                    <FaVolumeDown className="text-lg" />
                  ) : (
                    <FaVolumeUp className="text-lg" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    handleVolumeChange(newVolume);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white/50 min-w-0"
                />
                <span className="text-white/70 text-xs w-10 text-right flex-shrink-0">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Player (always visible when YouTube is selected)
          Note: This player is shown to ensure YouTube continues playing even when modal is open */}
      {selectedSource === "youtube" && youtubeVideoId && (
        <div
          ref={youtubePlayerRef}
          className="fixed z-[60] w-80 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden cursor-move select-none"
          style={{
            left:
              youtubePlayerPosition.x > 0
                ? `${youtubePlayerPosition.x}px`
                : "auto",
            right: youtubePlayerPosition.x === 0 ? "1rem" : "auto",
            top:
              youtubePlayerPosition.y > 0
                ? `${youtubePlayerPosition.y}px`
                : "auto",
            bottom: youtubePlayerPosition.y === 0 ? "1rem" : "auto",
          }}
          onMouseDown={(e) => {
            // 閉じるボタンやその他のインタラクティブ要素をクリックした場合はドラッグを開始しない
            const target = e.target as HTMLElement;
            if (
              target.tagName === "BUTTON" ||
              target.tagName === "IFRAME" ||
              target.closest("button") ||
              target.closest("iframe")
            ) {
              return;
            }

            if (!youtubePlayerRef.current) return;
            const rect = youtubePlayerRef.current.getBoundingClientRect();
            setYoutubeDragOffset({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
            setIsDraggingYoutube(true);
            e.preventDefault();
          }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FaGripVertical className="text-white/40 text-xs" />
                <h4 className="text-sm font-semibold text-white">
                  YouTube Player
                </h4>
                {/* Audio capture status indicator */}
                {isSystemAudio && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-400/30">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="text-xs text-green-300">
                      Capturing audio
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedSource(null);
                  setYoutubeVideoId("");
                }}
                className="w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
            <div
              className="relative w-full"
              style={{ paddingBottom: "56.25%" }}
            >
              <iframe
                key={youtubeVideoId} // keyを追加して、videoIdが変わった時に再マウント
                src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="absolute top-0 left-0 w-full h-full rounded-lg pointer-events-auto"
                style={{ border: "none" }}
              />
            </div>
            {/* Hint when audio capture is not started */}
            {!isSystemAudio && (
              <p className="text-white/60 text-xs mt-2 text-center">
                Click "Capture this window's audio" in the modal to capture
                audio
              </p>
            )}
          </div>
        </div>
      )}

      {/* System Audio Source Selection Modal */}
      {isSystemModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => {
            // YouTubeが選択されている場合は、モーダルを閉じてもYouTubeの状態を保持
            if (selectedSource === "youtube" && youtubeVideoId) {
              // YouTubeが再生中の場合は、モーダルだけを閉じる（YouTubeは別の場所に表示される）
              setIsSystemModalOpen(false);
            } else {
              // それ以外の場合は、すべてリセット
              setIsSystemModalOpen(false);
              setSelectedSource(null);
              setYoutubeVideoId("");
            }
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

          {/* Modal Content */}
          <div
            className="relative w-full max-w-6xl max-h-[90vh] bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                // YouTubeが選択されている場合は、モーダルを閉じてもYouTubeの状態を保持
                if (selectedSource === "youtube" && youtubeVideoId) {
                  // YouTubeが再生中の場合は、モーダルだけを閉じる（YouTubeは別の場所に表示される）
                  setIsSystemModalOpen(false);
                } else {
                  // それ以外の場合は、すべてリセット
                  setIsSystemModalOpen(false);
                  setSelectedSource(null);
                  setYoutubeVideoId("");
                }
              }}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
            >
              <FaTimes className="text-sm" />
            </button>

            {/* Modal Body */}
            <div className="flex flex-col sm:flex-row h-full">
              {/* Left Side - Source Selection Buttons */}
              <div className="w-full sm:w-80 p-6 sm:p-8 border-b sm:border-b-0 sm:border-r border-white/20 flex-shrink-0">
                <h3 className="text-xl font-bold text-white mb-6 drop-shadow-md">
                  Select Audio Source
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setSelectedSource("youtube");
                      // Set default video ID if not already set
                      if (!youtubeVideoId) {
                        setYoutubeVideoId("jfKfPfyJRdk");
                      }
                    }}
                    className={`w-full p-4 rounded-lg text-white text-left transition-colors backdrop-blur-sm border flex items-center gap-4 ${
                      selectedSource === "youtube"
                        ? "bg-white/20 border-white/30"
                        : "bg-white/10 hover:bg-white/20 border-white/10"
                    }`}
                  >
                    <FaYoutube className="text-2xl text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">YouTube</div>
                      <div className="text-xs text-white/70">
                        Play YouTube video
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedSource("applemusic")}
                    className={`w-full p-4 rounded-lg text-white text-left transition-colors backdrop-blur-sm border flex items-center gap-4 ${
                      selectedSource === "applemusic"
                        ? "bg-white/20 border-white/30"
                        : "bg-white/10 hover:bg-white/20 border-white/10"
                    }`}
                  >
                    <SiApplemusic className="text-2xl text-white flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">Apple Music</div>
                      <div className="text-xs text-white/70">
                        Play Apple Music
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedSource("spotify")}
                    className={`w-full p-4 rounded-lg text-white text-left transition-colors backdrop-blur-sm border flex items-center gap-4 ${
                      selectedSource === "spotify"
                        ? "bg-white/20 border-white/30"
                        : "bg-white/10 hover:bg-white/20 border-white/10"
                    }`}
                  >
                    <FaSpotify className="text-2xl text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">Spotify</div>
                      <div className="text-xs text-white/70">Play Spotify</div>
                    </div>
                  </button>

                  <button
                    onClick={async () => {
                      // まずモーダルを閉じる（YouTubeの状態は保持）
                      if (selectedSource === "youtube" && youtubeVideoId) {
                        // YouTubeの状態は保持する
                        setIsSystemModalOpen(false);
                      } else {
                        // YouTube以外の場合は、すべてリセット
                        setIsSystemModalOpen(false);
                        setSelectedSource(null);
                        setYoutubeVideoId("");
                      }
                      // モーダルが閉じるのを待ってからブラウザの共有ダイアログを表示
                      setTimeout(async () => {
                        try {
                          await startSystemAudio();
                        } catch (err) {
                          // エラーは既にstartSystemAudio内で処理されている
                        }
                      }, 300); // モーダルのアニメーションが完了するまで待つ
                    }}
                    className="w-full p-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-left transition-colors backdrop-blur-sm border border-white/10 flex items-center gap-4"
                  >
                    <FaDesktop className="text-2xl text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">Browser</div>
                      <div className="text-xs text-white/70">
                        Capture audio from browser window
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Right Side - Player/iframe */}
              <div className="flex-1 p-6 sm:p-8 overflow-auto">
                {selectedSource === "youtube" && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white mb-4">
                      YouTube Player
                    </h4>
                    {/* Video ID Input */}
                    <div className="mb-4">
                      <label className="block text-sm text-white/80 mb-2">
                        YouTube Video ID or URL
                      </label>
                      <input
                        type="text"
                        placeholder="Enter video ID (e.g., dQw4w9WgXcQ) or full URL"
                        value={youtubeVideoId}
                        onChange={(e) => {
                          let videoId = e.target.value;
                          // Extract video ID from URL if full URL is provided
                          const urlMatch = videoId.match(
                            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
                          );
                          if (urlMatch) {
                            videoId = urlMatch[1];
                          }
                          // Validate video ID format (alphanumeric, hyphens, underscores, 11 characters)
                          if (
                            videoId &&
                            !/^[a-zA-Z0-9_-]{11}$/.test(videoId) &&
                            videoId.length > 0
                          ) {
                            // If it's not a valid format but looks like a URL, try to extract
                            if (
                              videoId.includes("youtube.com") ||
                              videoId.includes("youtu.be")
                            ) {
                              const extracted = videoId.match(
                                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
                              );
                              if (extracted && extracted[1]) {
                                videoId = extracted[1];
                              }
                            }
                          }
                          setYoutubeVideoId(videoId);
                          // Clear error if video ID looks valid
                          if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
                            setError(null);
                          }
                        }}
                        onBlur={(e) => {
                          // Validate on blur
                          const videoId = e.target.value;
                          if (videoId && !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
                            setError(
                              "Please enter a valid YouTube video ID (11 alphanumeric characters)"
                            );
                            setTimeout(() => setError(null), 5000);
                          }
                        }}
                        className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                      />
                    </div>
                    {/* YouTube iframe - モーダル内のプレビュー */}
                    {youtubeVideoId && (
                      <>
                        <div
                          className="relative w-full"
                          style={{ paddingBottom: "56.25%" }}
                        >
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`}
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                            className="absolute top-0 left-0 w-full h-full rounded-lg"
                            style={{ border: "none" }}
                          />
                        </div>
                        <p className="text-white/60 text-xs mt-2 text-center">
                          ※ When you close the modal, the YouTube player will
                          move to the bottom right and continue playing
                        </p>
                        {/* Capture Audio Button */}
                        <div className="mt-4 p-4 bg-blue-600/20 rounded-lg border border-blue-400/30">
                          <p className="text-white/80 text-sm mb-2">
                            To reflect this window's audio in ferro, click the
                            button below and select the "Window" tab in the
                            browser's sharing dialog, then select this browser
                            window.
                          </p>
                          <p className="text-white/60 text-xs mb-3">
                            ※モーダルを閉じてから共有ダイアログが表示されます。YouTubeプレーヤーは画面右下に表示され続けます。
                          </p>
                          <button
                            onClick={async () => {
                              try {
                                // まず、モーダル外のYouTubeプレーヤーが表示されるようにする
                                // モーダルを閉じる前に、YouTubeの状態を保持する
                                // モーダルを閉じずに、そのままブラウザの共有ダイアログを表示してみる
                                // これにより、YouTubeの再生が止まらない
                                await startSystemAudio();
                                // 共有が成功したら、モーダルを閉じる（YouTubeはモーダル外に表示される）
                                // 少し待ってからモーダルを閉じることで、iframeの切り替えをスムーズにする
                                setTimeout(() => {
                                  setIsSystemModalOpen(false);
                                }, 200);
                              } catch (err) {
                                // エラーが発生した場合（ウィンドウが表示されないなど）、モーダルを閉じてから再試行
                                const error = err as Error;
                                if (
                                  error.name === "NotAllowedError" ||
                                  error.name === "AbortError"
                                ) {
                                  // ユーザーがキャンセルした場合
                                  setError(
                                    "共有がキャンセルされました。もう一度お試しください。"
                                  );
                                  setTimeout(() => setError(null), 3000);
                                } else {
                                  // その他のエラーの場合、モーダルを閉じてから再試行
                                  setIsSystemModalOpen(false);
                                  setTimeout(async () => {
                                    try {
                                      await startSystemAudio();
                                    } catch (retryErr) {
                                      // エラーは既にstartSystemAudio内で処理されている
                                    }
                                  }, 500);
                                }
                              }
                            }}
                            className="w-full px-4 py-3 rounded-lg bg-blue-600/40 hover:bg-blue-600/50 text-white font-semibold transition-colors backdrop-blur-sm border border-blue-400/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSystemAudio}
                          >
                            <FaDesktop className="text-lg" />
                            <span>
                              {isSystemAudio
                                ? "Capturing audio..."
                                : "Capture this window's audio"}
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                    {!youtubeVideoId && (
                      <div className="flex items-center justify-center h-64 bg-white/5 rounded-lg border border-white/10">
                        <p className="text-white/60 text-sm">
                          Enter a YouTube video ID or URL above
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedSource === "applemusic" && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white mb-4">
                      Apple Music
                    </h4>
                    <div
                      className="relative w-full"
                      style={{ paddingBottom: "56.25%" }}
                    >
                      <iframe
                        src="https://music.apple.com/embed"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        className="absolute top-0 left-0 w-full h-full rounded-lg"
                        style={{ border: "none" }}
                      />
                    </div>
                    {/* Capture Audio Button */}
                    <div className="mt-4 p-4 bg-blue-600/20 rounded-lg border border-blue-400/30">
                      <p className="text-white/80 text-sm mb-2">
                        To reflect this window's audio in ferro, click the
                        button below and select the "Window" tab in the
                        browser's sharing dialog, then select this browser
                        window.
                      </p>
                      <p className="text-white/60 text-xs mb-3">
                        ※ The sharing dialog will appear after closing the
                        modal.
                      </p>
                      <button
                        onClick={async () => {
                          // まずモーダルを閉じる
                          setIsSystemModalOpen(false);
                          setSelectedSource(null);
                          // モーダルが閉じるのを待ってからブラウザの共有ダイアログを表示
                          setTimeout(async () => {
                            try {
                              await startSystemAudio();
                            } catch (err) {
                              // エラーは既にstartSystemAudio内で処理されている
                            }
                          }, 300); // モーダルのアニメーションが完了するまで待つ
                        }}
                        className="w-full px-4 py-3 rounded-lg bg-blue-600/40 hover:bg-blue-600/50 text-white font-semibold transition-colors backdrop-blur-sm border border-blue-400/30 flex items-center justify-center gap-2"
                      >
                        <FaDesktop className="text-lg" />
                        <span>Capture this window's audio</span>
                      </button>
                    </div>
                  </div>
                )}

                {selectedSource === "spotify" && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white mb-4">
                      Spotify
                    </h4>
                    <div
                      className="relative w-full"
                      style={{ paddingBottom: "56.25%" }}
                    >
                      <iframe
                        src="https://open.spotify.com/embed"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        className="absolute top-0 left-0 w-full h-full rounded-lg"
                        style={{ border: "none" }}
                      />
                    </div>
                    {/* Capture Audio Button */}
                    <div className="mt-4 p-4 bg-blue-600/20 rounded-lg border border-blue-400/30">
                      <p className="text-white/80 text-sm mb-2">
                        To reflect this window's audio in ferro, click the
                        button below and select the "Window" tab in the
                        browser's sharing dialog, then select this browser
                        window.
                      </p>
                      <p className="text-white/60 text-xs mb-3">
                        ※ The sharing dialog will appear after closing the
                        modal.
                      </p>
                      <button
                        onClick={async () => {
                          // まずモーダルを閉じる
                          setIsSystemModalOpen(false);
                          setSelectedSource(null);
                          // モーダルが閉じるのを待ってからブラウザの共有ダイアログを表示
                          setTimeout(async () => {
                            try {
                              await startSystemAudio();
                            } catch (err) {
                              // エラーは既にstartSystemAudio内で処理されている
                            }
                          }, 300); // モーダルのアニメーションが完了するまで待つ
                        }}
                        className="w-full px-4 py-3 rounded-lg bg-blue-600/40 hover:bg-blue-600/50 text-white font-semibold transition-colors backdrop-blur-sm border border-blue-400/30 flex items-center justify-center gap-2"
                      >
                        <FaDesktop className="text-lg" />
                        <span>Capture this window's audio</span>
                      </button>
                    </div>
                  </div>
                )}

                {!selectedSource && (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <p className="text-white/60 text-center">
                      Select an audio source from the left to get started
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Music Selection Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

          {/* Modal Content */}
          <div
            className="relative w-full max-w-4xl max-h-[80vh] bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
            >
              <FaTimes className="text-sm" />
            </button>

            {/* Modal Body */}
            <div className="flex flex-col sm:flex-row h-full">
              {/* Left Half - Sample Music */}
              <div className="flex-1 p-6 sm:p-8 border-b sm:border-b-0 sm:border-r border-white/20">
                <h3 className="text-xl font-bold text-white mb-4 drop-shadow-md">
                  Sample Music
                </h3>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {SAMPLE_MUSIC.map((sample, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        handleSampleSelect(sample.url, sample.name)
                      }
                      className="w-full p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-left transition-colors backdrop-blur-sm border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <FaMusic className="text-lg" />
                        <span className="font-medium">{sample.name}</span>
                      </div>
                    </button>
                  ))}
                  {savedAudioFiles.length > 0 && (
                    <>
                      <div className="pt-4 mt-4 border-t border-white/20">
                        <h4 className="text-sm font-semibold text-white/80 mb-2">
                          Saved Files
                        </h4>
                        {savedAudioFiles.map((file, index) => (
                          <button
                            key={index}
                            onClick={() =>
                              handleSavedFileSelect(file.data, file.name)
                            }
                            className="w-full p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-left transition-colors backdrop-blur-sm border border-white/10 mb-2"
                          >
                            <div className="flex items-center gap-3">
                              <FaMusic className="text-lg" />
                              <span className="font-medium truncate">
                                {file.name}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Half - Upload */}
              <div className="flex-1 p-6 sm:p-8">
                <h3 className="text-xl font-bold text-white mb-4 drop-shadow-md">
                  Upload Music
                </h3>
                <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
                  <label className="w-full p-8 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors backdrop-blur-sm border-2 border-dashed border-white/30 flex flex-col items-center justify-center gap-4">
                    <FaUpload className="text-4xl" />
                    <span className="font-medium">
                      Click to upload audio file
                    </span>
                    <span className="text-sm text-white/70">
                      MP3, WAV, OGG, etc.
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isSystemAudio}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
