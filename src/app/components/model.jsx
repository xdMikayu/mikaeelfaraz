"use client";

import { useGLTF } from '@react-three/drei';
import { useRef, Suspense } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Leva } from 'leva';

export default function Model() {
  const { nodes } = useGLTF('/bowl/bowl.gltf');
  const { camera } = useThree();
  const mesh = useRef();
  const groupRef = useRef();

  // Set camera properties
  useFrame(() => {
    camera.focalLength = 200;
  });

  // Handle responsive scaling in real-time
  useFrame(() => {
    if (groupRef.current) {
      const scaleFactor = window.innerWidth >= 1024 ? 200 : 150;
      groupRef.current.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
  });

  // Rotate the mesh along its local Y-axis
  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotateY(delta * 0.5); // Apply local Y-axis rotation
    }
  });

  return (
    <group ref={groupRef} scale={10}> {/* Default scale to prevent blank model */}
      <Leva hidden />
      <Suspense>
        <mesh ref={mesh} geometry={nodes.Sphere.geometry} position={[0, 0, 0]} rotation={[-0.5, 0, 0.1]}>
          <meshStandardMaterial {...nodes.Sphere.material} />
        </mesh>
      </Suspense>
    </group>
  );
}

useGLTF.preload('/bowl.gltf');
