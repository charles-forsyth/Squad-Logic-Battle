import React, { useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { Unit } from './Unit';
import { Projectile } from './Projectile';
import { Terrain, Env, Water, Trees, Base } from './World';
import { v4 as uuidv4 } from 'uuid';
import { CameraMode } from '../types';

const CameraController = () => {
    const { cameraMode, followedUnitId, units } = useGameStore();
    const { camera } = useThree();
    
    useFrame(() => {
        if (cameraMode === 'FREE') return;

        const targetUnit = units.find(u => u.id === followedUnitId);
        if (!targetUnit) return;

        const targetPos = new THREE.Vector3(...targetUnit.position);

        if (cameraMode === 'TPS') {
            // Smooth follow
            const camPos = targetPos.clone().add(new THREE.Vector3(0, 5, 8));
            camera.position.lerp(camPos, 0.1);
            camera.lookAt(targetPos);
        } else if (cameraMode === 'FPS') {
            const headPos = targetPos.clone().add(new THREE.Vector3(0, 1.6, 0));
            camera.position.copy(headPos);
            
            if (targetUnit.targetId) {
                const enemy = units.find(u => u.id === targetUnit.targetId);
                if (enemy) {
                    camera.lookAt(new THREE.Vector3(...enemy.position).add(new THREE.Vector3(0,1,0)));
                } else {
                    camera.rotation.set(0,0,0);
                }
            } else {
                 camera.lookAt(0, 1, 0);
            }
        }
    });

    return null;
}

const GameContent = () => {
   const { units, cameraMode, setFollowedUnit, followedUnitId, gameVersion } = useGameStore();
   const [activeProjectiles, setActiveProjectiles] = useState<any[]>([]);

   useEffect(() => {
       if ((cameraMode === 'FPS' || cameraMode === 'TPS') && !followedUnitId && units.length > 0) {
           const living = units.find(u => u.hp > 0);
           if(living) setFollowedUnit(living.id);
       }
   }, [cameraMode, followedUnitId, units, setFollowedUnit]);

   const handleFire = (pos: [number, number, number], vel: [number, number, number], team: string) => {
      const id = uuidv4();
      setActiveProjectiles(prev => [...prev, { id, position: pos, velocity: vel, team, damage: 8 }]);
   };

   const removeProjectile = (id: string) => {
      setActiveProjectiles(prev => prev.filter(p => p.id !== id));
   };

   const livingUnits = units.filter(u => u.hp > 0);

   return (
    <>
      <CameraController />
      {cameraMode === 'FREE' && <OrbitControls target={[0,0,0]} maxPolarAngle={Math.PI / 2.1} />}
      
      <Env />
      
      <Physics gravity={[0, -9.81, 0]}>
        <Terrain />
        <Water />
        <Trees />
        
        {/* Bases / Medic Stations */}
        <Base team="RED" position={[-40, 0, 0]} />
        <Base team="BLUE" position={[40, 0, 0]} />
        
        {livingUnits.map(unit => (
            <Unit 
                key={`${unit.id}-${gameVersion}`} 
                id={unit.id}
                team={unit.team}
                startPosition={unit.position} 
                onFire={(pos, vel) => handleFire(pos, vel, unit.team)}
            />
        ))}

        {activeProjectiles.map(proj => (
            <Projectile 
                key={proj.id}
                {...proj}
                onHit={(tid, dmg) => {
                     useGameStore.getState().damageUnit(tid, dmg);
                     removeProjectile(proj.id);
                }}
                onFizzle={() => removeProjectile(proj.id)}
            />
        ))}
      </Physics>
    </>
   )
}

export const GameScene = () => {
  return (
    <div className="w-full h-full relative">
      <Canvas shadows camera={{ position: [0, 15, 25], fov: 50 }}>
         <GameContent />
      </Canvas>
    </div>
  );
};