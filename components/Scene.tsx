"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { FerroObject } from "./FerroObject";

export function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 75 }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 3, 3]} intensity={1.5} />
      <pointLight position={[-3, -3, -3]} intensity={0.8} />
      <FerroObject />
      <OrbitControls enableZoom={true} enablePan={false} />
      <Environment preset="night" />
    </Canvas>
  );
}

