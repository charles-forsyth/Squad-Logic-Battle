import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSphere } from '@react-three/cannon';
import * as THREE from 'three';
import { UnitState, Team } from '../types';
import { useGameStore } from '../store';
import { Html } from '@react-three/drei';
import { TREE_POSITIONS } from './World';

// --- CONSTANTS ---
const DETECT_RANGE = 50; 
const ATTACK_RANGE_RANGED = 14;
const ATTACK_RANGE_MELEE = 1.8;
const MOVE_SPEED = 6;
const PROJECTILE_SPEED = 25; 
const MELEE_DAMAGE = 15;
const RANGED_DAMAGE = 8;
const ATTACK_COOLDOWN_MELEE = 1000;
const ATTACK_COOLDOWN_RANGED = 1200;

// Base Locations
const RED_BASE = new THREE.Vector3(-40, 0, 0);
const BLUE_BASE = new THREE.Vector3(40, 0, 0);
const RETREAT_THRESHOLD = 0.35; // Retreat if HP < 35%
const HEAL_RANGE = 4; // Distance to base to start healing

interface UnitProps {
  id: string;
  team: Team;
  startPosition: [number, number, number];
  onFire: (pos: [number, number, number], vel: [number, number, number]) => void;
}

const MuzzleFlash = () => {
    return (
       <group position={[0, 0, 0.6]}>
           <pointLight intensity={3} distance={4} color="#ffffaa" decay={1} />
           <mesh rotation={[Math.random() * Math.PI, Math.random() * Math.PI, 0]}>
               <dodecahedronGeometry args={[0.2, 0]} />
               <meshBasicMaterial color="#ffffaa" transparent opacity={0.9} />
           </mesh>
       </group>
    );
};

const UnitHealthBar = ({ id, team }: { id: string, team: Team }) => {
    const hp = useGameStore(s => s.units.find(u => u.id === id)?.hp || 0);
    const maxHp = useGameStore(s => s.units.find(u => u.id === id)?.maxHp || 100);
    const state = useGameStore(s => s.units.find(u => u.id === id)?.state);
    
    if (hp <= 0) return null;

    return (
        <Html position={[0, 1.8, 0]} center distanceFactor={12} zIndexRange={[100, 0]}>
             <div className="flex flex-col items-center">
                 {state === 'HEALING' && <div className="text-green-400 font-bold text-xs mb-1 animate-pulse">+ HEALING</div>}
                 {state === 'RETREATING' && <div className="text-yellow-400 font-bold text-xs mb-1">! RETREAT !</div>}
                 <div className="w-16 h-2 bg-gray-900/80 border border-white/20 rounded overflow-hidden">
                     <div 
                        className={`h-full transition-all duration-300 ${team === 'RED' ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${(hp / maxHp) * 100}%` }}
                     />
                 </div>
             </div>
        </Html>
    )
}

const UnitComponent: React.FC<UnitProps> = ({ id, team, startPosition, onFire }) => {
  const { updateUnit, damageUnit, healUnit } = useGameStore.getState();

  const [ref, api] = useSphere(() => ({
    mass: 1,
    position: startPosition,
    args: [0.7], 
    fixedRotation: true, 
    linearDamping: 0.5,
    material: { friction: 0.0, restitution: 0.0 }, 
    userData: { type: 'UNIT', id, team },
    allowSleep: false 
  }), []);

  useEffect(() => {
      api.wakeUp();
  }, [api]);

  const velocity = useRef([0, 0, 0]);
  useEffect(() => api.velocity.subscribe((v) => (velocity.current = v)), [api.velocity]);
  
  const position = useRef([0, 0, 0]);
  useEffect(() => api.position.subscribe((v) => (position.current = v)), [api.position]);

  const state = useRef({
      lastAttackTime: 0,
      isMoving: false,
      isMelee: false,
      isShooting: false,
      flashFrames: 0,
      healTick: 0
  });

  const meshRef = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Group>(null);

  // --- BRAIN ---
  useFrame((ctx) => {
    const store = useGameStore.getState();
    const me = store.units.find(u => u.id === id);
    if (!me || me.hp <= 0) return;

    const myPos = new THREE.Vector3(position.current[0], position.current[1], position.current[2]);
    const now = Date.now();
    let moveVec = new THREE.Vector3(0, 0, 0);
    let nextStateVal: any = me.state; 

    // --- DECISION TREE ---

    // 1. CHECK RETREAT / HEAL CONDITION
    const myBasePos = team === 'RED' ? RED_BASE : BLUE_BASE;
    const hpPercent = me.hp / me.maxHp;
    
    // Trigger Retreat
    if (hpPercent < RETREAT_THRESHOLD && nextStateVal !== 'HEALING') {
        nextStateVal = 'RETREATING';
    }

    // Logic per state
    if (nextStateVal === 'RETREATING') {
        // Move to Base
        const distToBase = myPos.distanceTo(myBasePos);
        if (distToBase < HEAL_RANGE) {
            nextStateVal = 'HEALING';
        } else {
            const dir = myBasePos.clone().sub(myPos).normalize();
            moveVec = dir;
            // Face base
            const angle = Math.atan2(dir.x, dir.z);
            if (meshRef.current) meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, angle, 0.2);
        }
    } else if (nextStateVal === 'HEALING') {
        // Stay still and heal
        moveVec.set(0, 0, 0);
        
        // Healing tick every 20 frames approx
        state.current.healTick++;
        if (state.current.healTick > 30) {
            healUnit(id, 5);
            state.current.healTick = 0;
        }

        // Exit condition
        if (me.hp >= me.maxHp) {
            nextStateVal = 'IDLE'; // Back to fight
        }
    } else {
        // --- NORMAL COMBAT LOGIC ---
        
        // SMART TARGETING: Score enemies based on distance AND health
        // Prefer closer enemies, but also prefer low HP enemies (Kill Confirm)
        let target = store.units.find(u => u.id === me.targetId && u.hp > 0);
        
        // Re-evaluate target periodically or if current is dead
        if (!target || ctx.clock.frame % 30 === 0) {
            let bestScore = -Infinity;
            let bestUnit = null;
            
            store.units.forEach(u => {
                if (u.team !== team && u.hp > 0) {
                    const dist = myPos.distanceTo(new THREE.Vector3(...u.position));
                    if (dist < DETECT_RANGE) {
                        // Score formula: Higher is better
                        // - Distance penalty (closer is better)
                        // - Low HP bonus (finish them off)
                        const distScore = (DETECT_RANGE - dist);
                        const hpScore = (100 - u.hp) * 0.5; // Weight HP slightly less than distance
                        const score = distScore + hpScore;

                        if (score > bestScore) {
                            bestScore = score;
                            bestUnit = u;
                        }
                    }
                }
            });
            
            if (bestUnit) {
                target = bestUnit;
            }
        }

        if (target) {
            const targetPos = new THREE.Vector3(...target.position);
            const dist = myPos.distanceTo(targetPos);
            const dir = targetPos.clone().sub(myPos).normalize();
            
            // Face Target
            const angle = Math.atan2(dir.x, dir.z);
            if (meshRef.current) meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, angle, 0.2);

            if (dist < ATTACK_RANGE_MELEE) {
                // MELEE
                nextStateVal = 'ATTACKING_MELEE';
                moveVec.set(0,0,0); // Stop to swing
                if (now - state.current.lastAttackTime > ATTACK_COOLDOWN_MELEE) {
                    damageUnit(target.id, MELEE_DAMAGE);
                    state.current.lastAttackTime = now;
                    state.current.isMelee = true; 
                    setTimeout(() => { state.current.isMelee = false; }, 300);
                }
            } else if (dist < ATTACK_RANGE_RANGED) {
                // RANGED
                nextStateVal = 'ATTACKING_RANGED';
                
                // TACTICAL MOVEMENT: Don't just stand still between shots
                // If on cooldown, move towards cover (Trees) or Strafe
                const onCooldown = now - state.current.lastAttackTime < ATTACK_COOLDOWN_RANGED;
                
                if (onCooldown) {
                     // Find nearest tree
                     let nearestTree = null;
                     let treeDist = Infinity;
                     TREE_POSITIONS.forEach(tPos => {
                         const d = myPos.distanceTo(new THREE.Vector3(...tPos));
                         if (d < treeDist) {
                             treeDist = d;
                             nearestTree = tPos;
                         }
                     });

                     if (nearestTree && treeDist < 8) {
                         // Move to cover
                         const coverPos = new THREE.Vector3(...nearestTree);
                         moveVec = coverPos.sub(myPos).normalize().multiplyScalar(0.5); // Slower movement
                     } else {
                         // Strafe (Side step relative to enemy)
                         const side = new THREE.Vector3(0,1,0).cross(dir).normalize();
                         // Oscillate strafe
                         const strafeDir = Math.sin(now * 0.002) > 0 ? 1 : -1;
                         moveVec = side.multiplyScalar(strafeDir * 0.4);
                     }
                } else {
                    // Stop to shoot accuracy
                    moveVec.set(0,0,0);
                    
                    // SHOOT LOGIC
                    const flightTime = dist / PROJECTILE_SPEED;
                    const gravityDrop = 0.5 * 9.81 * (flightTime * flightTime);
                    const aimTarget = targetPos.clone().add(new THREE.Vector3(0, gravityDrop, 0));
                    const fireOrigin = myPos.clone().add(new THREE.Vector3(0, 0.8, 0)).add(dir.clone().multiplyScalar(0.7));
                    const aimDir = aimTarget.sub(fireOrigin).normalize();
                    const fireVelocity = aimDir.multiplyScalar(PROJECTILE_SPEED);

                    onFire([fireOrigin.x, fireOrigin.y, fireOrigin.z], [fireVelocity.x, fireVelocity.y, fireVelocity.z]);
                    state.current.lastAttackTime = now;
                    
                    if (flashRef.current) {
                        flashRef.current.visible = true;
                        state.current.flashFrames = 5;
                    }
                }

            } else {
                // CHASE / SQUAD MOVEMENT
                moveVec = dir;
                nextStateVal = 'MOVING';
                
                // FLOCKING: SEPARATION & COHESION
                // Stay away from friends (Separation)
                // Stay somewhat close to friends (Cohesion)
                const friends = store.units.filter(u => u.team === team && u.id !== id && u.hp > 0);
                if (friends.length > 0) {
                    let separation = new THREE.Vector3();
                    let cohesion = new THREE.Vector3();
                    let count = 0;

                    friends.forEach(f => {
                         const fPos = new THREE.Vector3(...f.position);
                         const d = myPos.distanceTo(fPos);
                         
                         // Separation: Push away if too close
                         if (d < 2.5) {
                             const push = myPos.clone().sub(fPos).normalize().multiplyScalar(2.5 / (d + 0.1));
                             separation.add(push);
                         }
                         
                         // Cohesion: Accumulate position
                         if (d < 15) {
                             cohesion.add(fPos);
                             count++;
                         }
                    });

                    if (count > 0) {
                        cohesion.divideScalar(count).sub(myPos).normalize().multiplyScalar(0.2); // Weak pull
                    }
                    
                    // Combine Forces
                    moveVec.add(separation.multiplyScalar(0.8)); // Strong separation
                    moveVec.add(cohesion);
                    moveVec.normalize();
                }
            }
        } else {
            // NO TARGET - ATTACK MOVE TO ENEMY BASE
            // If Blue (right), go Left (Red Base). If Red (left), go Right (Blue Base)
            const enemyBaseX = team === 'RED' ? 40 : -40; // Aim for their base center
            const dest = new THREE.Vector3(enemyBaseX, 0, 0);
            
            if (Math.abs(myPos.x - enemyBaseX) > 4) {
                 const dir = dest.sub(myPos).normalize();
                 moveVec = dir;
                 nextStateVal = 'MOVING';
                 const angle = Math.atan2(dir.x, dir.z);
                 if (meshRef.current) meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, angle, 0.1);
                 
                 // Apply basic separation even when marching
                 const friends = store.units.filter(u => u.team === team && u.id !== id && u.hp > 0);
                 friends.forEach(f => {
                     const fPos = new THREE.Vector3(...f.position);
                     if (myPos.distanceTo(fPos) < 2) {
                         const push = myPos.clone().sub(fPos).normalize().multiplyScalar(0.5);
                         moveVec.add(push).normalize();
                     }
                 });

            } else {
                nextStateVal = 'IDLE';
            }
        }
    }

    // --- APPLY PHYSICS ---
    const currentY = velocity.current[1];
    
    // If healing or attacking (stationary), don't slide
    // NOTE: Ranged units now move slightly (strafe/cover) so we allow velocity if magnitude > 0.1
    const isActuallyMoving = moveVec.lengthSq() > 0.01;
    const shouldFreeze = nextStateVal === 'ATTACKING_MELEE' || nextStateVal === 'HEALING' || (!isActuallyMoving && nextStateVal !== 'ATTACKING_RANGED');

    if (!shouldFreeze) {
        // Running speed or Retreating speed (retreating is faster)
        const speed = nextStateVal === 'RETREATING' ? MOVE_SPEED * 1.3 : MOVE_SPEED;
        // Dampen strafing speed
        const finalSpeed = (nextStateVal === 'ATTACKING_RANGED') ? speed * 0.5 : speed;
        api.velocity.set(moveVec.x * finalSpeed, currentY, moveVec.z * finalSpeed);
        state.current.isMoving = true;
    } else {
        api.velocity.set(0, currentY, 0); 
        state.current.isMoving = false;
    }

    // --- SYNC WITH STORE ---
    // Update store if state changes or periodically for position
    const targetId = (nextStateVal !== 'RETREATING' && nextStateVal !== 'HEALING' && me.targetId) ? me.targetId : null;
    
    if (me.state !== nextStateVal) {
        updateUnit(id, { state: nextStateVal, targetId, position: [myPos.x, myPos.y, myPos.z] });
    } else if (ctx.clock.getElapsedTime() % 0.5 < 0.05) {
        updateUnit(id, { position: [myPos.x, myPos.y, myPos.z] });
    }

    // --- VISUAL UPDATES ---
    if (state.current.flashFrames > 0) {
        state.current.flashFrames--;
        if (state.current.flashFrames <= 0 && flashRef.current) flashRef.current.visible = false;
    }

    const t = ctx.clock.elapsedTime * 10;
    
    // Leg Animation
    if (leftLeg.current && rightLeg.current) {
        if (state.current.isMoving) {
            const freq = nextStateVal === 'RETREATING' ? 1.5 : 1.0;
            leftLeg.current.rotation.x = Math.sin(t * freq) * 0.5;
            rightLeg.current.rotation.x = Math.sin(t * freq + Math.PI) * 0.5;
        } else {
            leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, 0.1);
            rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, 0.1);
        }
    }

    // Arm Animation
    if (rightArm.current && leftArm.current) {
        if (nextStateVal === 'ATTACKING_RANGED') {
            const recoil = state.current.flashFrames > 0 ? 0.2 : 0;
            rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -1.5 + recoil, 0.3);
            leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, -0.5, 0.1);
        } else if (nextStateVal === 'ATTACKING_MELEE') {
             if (state.current.isMelee) {
                 rightArm.current.rotation.x = -2.5; 
             } else {
                 rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -0.5, 0.1);
             }
        } else if (nextStateVal === 'RETREATING') {
            // Arms down, running
            rightArm.current.rotation.x = Math.sin(t * 1.5) * 0.5;
            leftArm.current.rotation.x = Math.sin(t * 1.5 + Math.PI) * 0.5;
        } else if (state.current.isMoving) {
            rightArm.current.rotation.x = Math.sin(t) * 0.5;
            leftArm.current.rotation.x = Math.sin(t + Math.PI) * 0.5;
        } else {
            // IDLE / HEALING
            rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, 0.1);
            leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, 0.1);
        }
    }
  });

  const color = team === 'RED' ? '#ff3333' : '#3388ff';

  return (
    <group ref={ref as any}>
        <UnitHealthBar id={id} team={team} />
        
        <group ref={meshRef}>
            {/* Body */}
            <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.5, 0.7, 0.35]} />
                <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            
            {/* Head */}
            <mesh position={[0, 1.3, 0]} castShadow>
                <boxGeometry args={[0.3, 0.3, 0.3]} />
                <meshStandardMaterial color="#222" />
                <mesh position={[0, 0, 0.16]}>
                    <planeGeometry args={[0.25, 0.08]} />
                    <meshBasicMaterial color={team === 'RED' ? '#ff9900' : '#00ffcc'} toneMapped={false} />
                </mesh>
            </mesh>

            {/* Arms */}
            <group position={[0.35, 1.0, 0]} ref={rightArm}>
                <mesh position={[0, -0.25, 0]} castShadow>
                    <boxGeometry args={[0.15, 0.6, 0.15]} />
                    <meshStandardMaterial color={color} />
                </mesh>
                {/* Weapon */}
                <group position={[0, -0.5, 0.1]} rotation={[Math.PI/2, 0, 0]}>
                    <mesh position={[0, 0.2, 0]} castShadow>
                        <boxGeometry args={[0.1, 0.6, 0.1]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                    <group ref={flashRef} visible={false}>
                        <MuzzleFlash />
                    </group>
                </group>
            </group>
            
            <group position={[-0.35, 1.0, 0]} ref={leftArm}>
                <mesh position={[0, -0.25, 0]} castShadow>
                    <boxGeometry args={[0.15, 0.6, 0.15]} />
                    <meshStandardMaterial color={color} />
                </mesh>
            </group>

            {/* Legs */}
            <mesh ref={leftLeg} position={[-0.15, 0.4, 0]} castShadow>
                <boxGeometry args={[0.18, 0.45, 0.2]} />
                <meshStandardMaterial color="#111" />
            </mesh>
            <mesh ref={rightLeg} position={[0.15, 0.4, 0]} castShadow>
                <boxGeometry args={[0.18, 0.45, 0.2]} />
                <meshStandardMaterial color="#111" />
            </mesh>
        </group>
    </group>
  );
};

export const Unit = React.memo(UnitComponent, (prev, next) => {
    return prev.id === next.id && prev.team === next.team; 
});