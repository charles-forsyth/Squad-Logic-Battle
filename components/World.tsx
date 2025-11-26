import React, { useMemo, useRef } from 'react';
import { usePlane, useBox } from '@react-three/cannon';
import { Instance, Instances, Environment, Sky, Stars, Cloud, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Team } from '../types';

// Deterministic Tree Generation
const generateTrees = () => {
    const pos: [number, number, number][] = [];
    // Seeded-like generation logic (using fixed loop for consistency across renders)
    for (let i = 0; i < 40; i++) {
        // Pseudo-random distribution based on index to keep it static without a seed lib
        const angle = (i * 137.5) * (Math.PI / 180); // Golden angle
        const radius = 15 + (i * 1.5); // Spiral out
        
        // Convert to Cartesian, but flatten to map bounds
        let x = Math.cos(angle) * radius;
        let z = Math.sin(angle) * radius;

        // Clamp to map
        x = ((x + 50) % 80) - 40;
        z = ((z + 50) % 60) - 30;

        // Keep clear of center spawn/fight area (radius 10)
        if (Math.abs(x) < 12 && Math.abs(z) < 8) {
            x += 20; // Push out
        }
        // Keep clear of bases
        if (Math.abs(x) > 32) continue; 

        pos.push([x, 0, z]);
    }
    return pos;
};

export const TREE_POSITIONS = generateTrees();

export const Water = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial 
        color="#006994" 
        roughness={0.1} 
        metalness={0.8}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
};

export const Terrain = () => {
  // Simple flat ground for physics stability, but visually we can add hills
  const [ref] = usePlane(() => ({ 
    rotation: [-Math.PI / 2, 0, 0], 
    position: [0, 0, 0],
    material: { friction: 0.1 }
  }));

  return (
    <group>
      <mesh ref={ref as any} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#3b5e2b" roughness={0.8} />
      </mesh>
      
      {/* Decorative Hills - Visual Only */}
      <mesh position={[-20, -1, -20]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <sphereGeometry args={[15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2d4a21" />
      </mesh>
      <mesh position={[25, -2, 15]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <sphereGeometry args={[12, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2d4a21" />
      </mesh>
    </group>
  );
};

export const Base = ({ team, position }: { team: Team, position: [number, number, number] }) => {
    const color = team === 'RED' ? '#ff3333' : '#3388ff';
    const [ref] = useBox(() => ({
        type: 'Static',
        position: [position[0], 0.5, position[2]],
        args: [6, 1, 6]
    }));

    const iconRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (iconRef.current) {
            iconRef.current.rotation.y += 0.02;
            iconRef.current.position.y = 3 + Math.sin(state.clock.elapsedTime * 2) * 0.5;
        }
    });

    return (
        <group>
            {/* Physics Base */}
            <mesh ref={ref as any} castShadow receiveShadow>
                <boxGeometry args={[6, 1, 6]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            
            {/* Visual glow area */}
            <mesh position={[position[0], 0.6, position[2]]} rotation={[-Math.PI/2, 0, 0]}>
                 <planeGeometry args={[5, 5]} />
                 <meshBasicMaterial color={color} transparent opacity={0.3} />
            </mesh>

            {/* Medic Icon */}
            <group position={[position[0], 3, position[2]]} ref={iconRef}>
                 <Float speed={2} rotationIntensity={0} floatIntensity={1}>
                    <mesh>
                        <boxGeometry args={[0.5, 2, 0.5]} />
                        <meshBasicMaterial color="#00ff00" />
                    </mesh>
                    <mesh>
                        <boxGeometry args={[2, 0.5, 0.5]} />
                        <meshBasicMaterial color="#00ff00" />
                    </mesh>
                 </Float>
            </group>
        </group>
    );
}

export const Trees = () => {
  return (
    <Instances range={100} castShadow receiveShadow>
      <cylinderGeometry args={[0.5, 1, 3, 8]} />
      <meshStandardMaterial color="#4a3c31" />
      
      {TREE_POSITIONS.map((pos, i) => (
        <group key={i} position={[pos[0] as number, 1.5, pos[2] as number]}>
           {/* Trunk */}
           <Instance />
           {/* Leaves */}
           <mesh position={[0, 2, 0]} castShadow>
             <coneGeometry args={[2.5, 5, 8]} />
             <meshStandardMaterial color="#1e4d2b" />
           </mesh>
           <mesh position={[0, 4, 0]} castShadow>
             <coneGeometry args={[1.8, 4, 8]} />
             <meshStandardMaterial color="#266e34" />
           </mesh>
        </group>
      ))}
    </Instances>
  );
};

export const Env = () => {
    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight 
                position={[50, 50, 25]} 
                intensity={1.5} 
                castShadow 
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-50}
                shadow-camera-right={50}
                shadow-camera-top={50}
                shadow-camera-bottom={-50}
            />
            <Sky sunPosition={[100, 20, 100]} turbidity={8} rayleigh={6} />
            <Cloud opacity={0.5} speed={0.4} width={10} depth={1.5} segments={20} position={[0, 20, 0]} />
            <fog attach="fog" args={['#ccdae8', 10, 80]} />
        </>
    )
}