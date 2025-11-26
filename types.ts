export type Team = 'RED' | 'BLUE';

export type UnitType = 'SOLDIER';

export type CameraMode = 'FREE' | 'TPS' | 'FPS';

export interface UnitState {
  id: string;
  team: Team;
  hp: number;
  maxHp: number;
  position: [number, number, number];
  targetId: string | null;
  state: 'IDLE' | 'MOVING' | 'ATTACKING_RANGED' | 'ATTACKING_MELEE' | 'RETREATING' | 'HEALING' | 'DEAD';
  lastAttackTime: number;
}

export interface ProjectileState {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  team: Team;
  damage: number;
}