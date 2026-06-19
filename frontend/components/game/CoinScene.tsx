"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "@/stores/gameStore";

function CoinMesh({ isSpinning, result }: { isSpinning: boolean; result: "HEADS" | "TAILS" | null }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    if (isSpinning) {
      meshRef.current.rotation.x += delta * 15;
      meshRef.current.rotation.y += delta * 10;
    } else if (result) {
      const targetX = result === "HEADS" ? 0 : Math.PI;
      const targetY = 0;
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        targetX,
        delta * 3
      );
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y,
        targetY,
        delta * 3
      );
    }
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <cylinderGeometry args={[1.5, 1.5, 0.2, 64]} />
      <meshStandardMaterial
        color="#d4af37"
        metalness={0.9}
        roughness={0.2}
      />
      <Text
        position={[0, 0.11, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.5}
        color="#1a1a1a"
        fontWeight="bold"
      >
        H
      </Text>
      <Text
        position={[0, -0.11, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        fontSize={0.5}
        color="#1a1a1a"
        fontWeight="bold"
      >
        T
      </Text>
    </mesh>
  );
}

function CoinScene() {
  const { isSpinning, lastResult } = useGameStore();

  return (
    <div className="w-full h-[400px] bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-700/50 overflow-hidden">
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={1.2}
          castShadow
        />
        <pointLight position={[-5, 5, -5]} intensity={0.5} color="#f59e0b" />
        <CoinMesh isSpinning={isSpinning} result={lastResult} />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -1.5, 0]}
          receiveShadow
        >
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#0f172a" opacity={0.8} transparent />
        </mesh>
      </Canvas>
    </div>
  );
}

export default CoinScene;
