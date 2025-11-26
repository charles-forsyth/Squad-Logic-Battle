import React from 'react';
import { useSphere } from '@react-three/cannon';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import { Team } from '../types';

interface ProjectileProps {
  position: [number, number, number];
  velocity: [number, number, number];
  team: Team;
  damage: number;
  onHit: (targetId: string, damage: number) => void;
  onFizzle: () => void;
}

export const Projectile: React.FC<ProjectileProps> = ({ position, velocity, team, damage, onHit, onFizzle }) => {
  const [ref] = useSphere(() => ({
    mass: 0.1,
    position,
    velocity,
    args: [0.8], // Large hit radius to prevent tunneling and improve game feel
    isTrigger: true, // Don't physically bounce off units, just detect
    userData: { type: 'PROJECTILE' },
    onCollide: (e) => {
      // Safety check: e.body can be undefined in some cases
      if (!e.body) return;

      const targetData = e.body.userData as any;
      
      // Check collision with units
      if (targetData && targetData.type === 'UNIT') {
        if (targetData.team !== team) {
           onHit(targetData.id, damage);
           onFizzle();
        }
      } else {
        // Hit something else (Ground or another Projectile)
        
        // Ignore collision with other projectiles to prevent mid-air explosions
        if (targetData && targetData.type === 'PROJECTILE') {
            return;
        }

        // Hit terrain or obstacles -> Destroy projectile
        onFizzle();
      }
    }
  }));

  // Clean up if it flies too far
  useFrame(() => {
    const pos = ref.current?.position;
    if (pos) {
        if (pos.y < -5 || Math.abs(pos.x) > 100 || Math.abs(pos.z) > 100) {
            onFizzle();
        }
    }
  });

  const trailColor = team === 'RED' ? '#ff5500' : '#0055ff';
  const coreColor = team === 'RED' ? '#ffaa00' : '#00aaff';
  const emissiveColor = team === 'RED' ? '#ff0000' : '#0000ff';

  return (
    <group ref={ref as any}>
      <Trail 
        width={0.6} 
        length={8} 
        color={trailColor} 
        attenuation={(t) => t * t}
      >
        <mesh castShadow>
          <sphereGeometry args={[0.2]} />
          <meshStandardMaterial 
            color={coreColor} 
            emissive={emissiveColor} 
            emissiveIntensity={3} 
            toneMapped={false}
          />
        </mesh>
      </Trail>
    </group>
  );
};