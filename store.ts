import { create } from 'zustand';
import { CameraMode, UnitState, Team } from './types';
import { v4 as uuidv4 } from 'uuid';

interface GameStore {
  units: UnitState[];
  projectiles: any[];
  gameStatus: 'PLAYING' | 'FINISHED';
  winner: Team | null;
  cameraMode: CameraMode;
  followedUnitId: string | null;
  timeRemaining: number;
  gameVersion: number; // Used to force remounts on reset
  
  // Actions
  addUnit: (unit: UnitState) => void;
  updateUnit: (id: string, updates: Partial<UnitState>) => void;
  damageUnit: (id: string, amount: number) => void;
  healUnit: (id: string, amount: number) => void;
  removeUnit: (id: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setFollowedUnit: (id: string | null) => void;
  resetGame: () => void;
  tickTimer: (delta: number) => void;
}

const INITIAL_UNITS: UnitState[] = [
  // Red Team (Left)
  { id: 'r1', team: 'RED', hp: 100, maxHp: 100, position: [-25, 5, 0], targetId: null, state: 'IDLE', lastAttackTime: 0 },
  { id: 'r2', team: 'RED', hp: 100, maxHp: 100, position: [-22, 5, -5], targetId: null, state: 'IDLE', lastAttackTime: 0 },
  { id: 'r3', team: 'RED', hp: 100, maxHp: 100, position: [-22, 5, 5], targetId: null, state: 'IDLE', lastAttackTime: 0 },
  // Blue Team (Right)
  { id: 'b1', team: 'BLUE', hp: 100, maxHp: 100, position: [25, 5, 0], targetId: null, state: 'IDLE', lastAttackTime: 0 },
  { id: 'b2', team: 'BLUE', hp: 100, maxHp: 100, position: [22, 5, -5], targetId: null, state: 'IDLE', lastAttackTime: 0 },
  { id: 'b3', team: 'BLUE', hp: 100, maxHp: 100, position: [22, 5, 5], targetId: null, state: 'IDLE', lastAttackTime: 0 },
];

export const useGameStore = create<GameStore>((set, get) => ({
  units: JSON.parse(JSON.stringify(INITIAL_UNITS)),
  projectiles: [],
  gameStatus: 'PLAYING',
  winner: null,
  cameraMode: 'FREE',
  followedUnitId: null,
  timeRemaining: 300,
  gameVersion: 0,

  addUnit: (unit) => set((state) => ({ units: [...state.units, unit] })),
  
  updateUnit: (id, updates) => set((state) => ({
    units: state.units.map((u) => u.id === id ? { ...u, ...updates } : u)
  })),

  damageUnit: (id, amount) => set((state) => {
    const updatedUnits = state.units.map((u) => {
      if (u.id === id) {
        const newHp = Math.max(0, u.hp - amount);
        return { ...u, hp: newHp, state: newHp <= 0 ? 'DEAD' : u.state };
      }
      return u;
    });
    
    // Check win condition
    const redAlive = updatedUnits.some(u => u.team === 'RED' && u.hp > 0);
    const blueAlive = updatedUnits.some(u => u.team === 'BLUE' && u.hp > 0);
    
    let winner = state.winner;
    let gameStatus = state.gameStatus;

    if (!redAlive && blueAlive) {
      winner = 'BLUE';
      gameStatus = 'FINISHED';
    } else if (!blueAlive && redAlive) {
      winner = 'RED';
      gameStatus = 'FINISHED';
    } else if (!blueAlive && !redAlive) {
      gameStatus = 'FINISHED'; // Draw
    }

    return { units: updatedUnits, winner, gameStatus };
  }),

  healUnit: (id, amount) => set((state) => ({
    units: state.units.map((u) => {
      if (u.id === id && u.hp > 0) {
        const newHp = Math.min(u.maxHp, u.hp + amount);
        return { ...u, hp: newHp };
      }
      return u;
    })
  })),

  removeUnit: (id) => set((state) => ({
    units: state.units.filter((u) => u.id !== id)
  })),

  setCameraMode: (mode) => set({ cameraMode: mode }),
  setFollowedUnit: (id) => set({ followedUnitId: id }),

  resetGame: () => set((state) => ({
    units: JSON.parse(JSON.stringify(INITIAL_UNITS)),
    gameStatus: 'PLAYING',
    winner: null,
    timeRemaining: 300,
    cameraMode: 'FREE',
    followedUnitId: null,
    gameVersion: state.gameVersion + 1
  })),

  tickTimer: (delta) => set((state) => {
    if (state.gameStatus !== 'PLAYING') return {};
    const newTime = Math.max(0, state.timeRemaining - delta);
    if (newTime === 0) {
        return { timeRemaining: 0, gameStatus: 'FINISHED' };
    }
    return { timeRemaining: newTime };
  })
}));