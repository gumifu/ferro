"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaUpload,
  FaStop,
  FaDesktop,
  FaExpand,
  FaCompress,
} from "react-icons/fa";

// Initialize Simplex noise for smooth, liquid-like deformations
const noise3D = createNoise3D();

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

      // Apple-style multi-color gradient
      vec3 col1 = vec3(0.05, 0.02, 0.18);  // deep purple (top)
      vec3 col2 = vec3(1.00, 0.60, 0.30);  // warm orange (middle)
      vec3 col3 = vec3(0.10, 0.35, 0.95);  // blue (bottom)

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
      (error) => {
        console.log("HDRI not found, using default lighting:", error);
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

    // Make rough ball function with magnetic mouse attraction
    const makeRoughBall = (
      mesh: THREE.Mesh,
      bassFr: number,
      treFr: number,
      mousePos: THREE.Vector3,
      mouseActive: boolean
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
        const amp = 2.0; // smaller amplitude for rounded spikes
        const offset = 10; // sphere radius
        const noiseValue = noise3D(
          nx * 1.5 + time * 0.3,
          ny * 1.5 + time * 0.35,
          nz * 1.5 + time * 0.4
        );
        // More subtle modulation for liquid appearance
        let distance = offset + bassFr * 0.8 + noiseValue * amp * treFr;

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
        TMP_NORMAL.set(nx, ny, nz);
        // How aligned with spikeDir (closer to 1 = more downward)
        const alignment = Math.max(0, TMP_NORMAL.dot(SPIKE_DIR));
        // Spike sharpness and height
        const spikeSharpness = 300.0; // Larger = sharper, more localized
        const spikeHeight = 2.5; // Spike length (adjust to preference)
        // alignment^sharpness to focus on almost one point
        const spikeFactor = Math.pow(alignment, spikeSharpness);
        // Add spike to radius
        distance += spikeHeight * spikeFactor;

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

        // Update planes only if they are added to the scene
        if (plane && plane2) {
          makeRoughGround(plane, modulate(upperAvgFr, 0, 1, 0.5, 4));
          makeRoughGround(plane2, modulate(lowerMaxFr, 0, 1, 0.5, 4));
        }

        makeRoughBall(
          ball,
          modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8),
          modulate(upperAvgFr, 0, 1, 0, 4),
          mousePosition,
          mouseActive
        );
      } else {
        // Even without audio, apply mouse attraction
        makeRoughBall(ball, 0, 0, mousePosition, mouseActive);
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

      setIsRecording(true);
    } catch (err) {
      setError(
        "Microphone access was denied. Please check your browser settings."
      );
      console.error("Error accessing microphone:", err);
    }
  };

  const stopMicrophone = () => {
    if (sceneRef.current?.audioContext) {
      sceneRef.current.audioContext.close();
      sceneRef.current.analyser = null;
      sceneRef.current.audioContext = null;
      sceneRef.current.dataArray = null;
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

      setIsSystemAudio(true);
    } catch (err) {
      setError(
        "Screen share audio access was denied. Please check your browser settings."
      );
      console.error("Error accessing system audio:", err);
      setIsSystemAudio(false);
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
    setIsSystemAudio(false);
  };

  const startPictureInPicture = async () => {
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
  };

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Stop other audio sources
    if (isRecording) {
      stopMicrophone();
    }
    if (isSystemAudio) {
      stopSystemAudio();
    }

    setError(null);

    // Create audio element
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = URL.createObjectURL(file);
    // Mute the audio element to avoid double playback
    // Sound will only come from WebAudio destination
    audio.muted = true;

    audioRef.current = audio;

    // Setup audio context when audio is ready
    audio.addEventListener("loadeddata", () => {
      if (!sceneRef.current) return;

      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const audioContext = new AudioContextClass();
        const source = audioContext.createMediaElementSource(audio);
        const analyser = audioContext.createAnalyser();

        source.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 512;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        sceneRef.current.analyser = analyser;
        sceneRef.current.audioContext = audioContext;
        sceneRef.current.dataArray = dataArray;

        setIsPlayingFile(true);
      } catch (err) {
        setError("Failed to load audio file.");
        console.error("Error loading audio file:", err);
      }
    });

    audio.addEventListener("error", () => {
      setError("オーディオファイルの読み込みに失敗しました。");
      setIsPlayingFile(false);
    });

    audio.addEventListener("ended", () => {
      setIsPlayingFile(false);
    });

    // Play audio
    audio.play().catch((err) => {
      setError("Failed to play audio. User interaction may be required.");
      console.error("Error playing audio:", err);
    });
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
    setIsPlayingFile(false);
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black"
      style={{ height: "100dvh" }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Simple control panel - Center */}
      <div className="absolute bottom-3 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-10 flex gap-2 sm:gap-3 items-center flex-wrap justify-center max-w-[calc(100%-8rem)] sm:max-w-none">
        {/* File upload */}
        <label
          className={`w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 backdrop-blur-md border border-white/20 ${
            isSystemAudio
              ? "cursor-not-allowed opacity-50 bg-blue-600/30"
              : "bg-blue-600/40 hover:bg-blue-600/50"
          } text-white drop-shadow-lg`}
        >
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isSystemAudio}
          />
          <FaUpload className="drop-shadow-md text-xs sm:text-base" />
          <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
            {isPlayingFile ? "Change" : "Upload"}
          </span>
        </label>

        {/* Microphone button */}
        {!isRecording ? (
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
          <button
            onClick={startSystemAudio}
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
        <button
          onClick={startPictureInPicture}
          className="absolute bottom-3 sm:bottom-6 right-3 sm:right-6 z-10 w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full backdrop-blur-md bg-indigo-600/40 hover:bg-indigo-600/50 border border-white/20 text-white drop-shadow-lg shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2"
          title="Start Picture-in-Picture"
        >
          <FaExpand className="drop-shadow-md text-xs sm:text-base" />
          <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
            PiP
          </span>
        </button>
      ) : (
        <button
          onClick={stopPictureInPicture}
          className="absolute bottom-3 sm:bottom-6 right-3 sm:right-6 z-10 w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 rounded-full backdrop-blur-md bg-indigo-500/30 hover:bg-indigo-500/40 border border-indigo-400/30 text-white drop-shadow-lg shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2"
          title="Stop Picture-in-Picture"
        >
          <FaCompress className="drop-shadow-md text-xs sm:text-base" />
          <span className="text-xs sm:text-sm font-semibold drop-shadow-md hidden sm:inline">
            Exit
          </span>
        </button>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
