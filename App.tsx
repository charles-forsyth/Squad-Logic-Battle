import React, { useEffect } from 'react';
import { GameScene } from './components/GameScene';
import { useGameStore } from './store';
import { CameraMode, Team } from './types';
import { Activity, Sword, Users, Eye, RefreshCw } from 'lucide-react';

const App = () => {
  const { 
      gameStatus, 
      winner, 
      units, 
      timeRemaining, 
      cameraMode, 
      setCameraMode, 
      resetGame, 
      setFollowedUnit, 
      followedUnitId,
      tickTimer 
  } = useGameStore();

  useEffect(() => {
      const interval = setInterval(() => {
          tickTimer(1);
      }, 1000);
      return () => clearInterval(interval);
  }, []);

  const redUnits = units.filter(u => u.team === 'RED');
  const blueUnits = units.filter(u => u.team === 'BLUE');

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-screen bg-black text-white relative font-sans overflow-hidden">
      <GameScene />

      {/* HUD Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-4 flex flex-col justify-between">
        
        {/* Top Bar */}
        <div className="flex justify-between items-start pointer-events-auto">
             {/* Team Red Stats */}
             <div className="bg-black/60 backdrop-blur-md p-4 rounded-lg border-l-4 border-red-500 w-64">
                <h2 className="text-red-500 font-bold text-xl mb-2 flex items-center"><Users className="mr-2"/> Red Team</h2>
                <div className="space-y-2">
                    {redUnits.map(u => (
                        <div key={u.id} className="flex justify-between items-center text-sm cursor-pointer hover:bg-white/10 p-1 rounded" onClick={() => {
                            if(cameraMode !== 'FREE') setFollowedUnit(u.id);
                        }}>
                             <span className={u.hp <= 0 ? 'text-gray-500 line-through' : ''}>Unit {u.id.slice(0,2)}</span>
                             <div className="w-24 h-2 bg-gray-800 rounded">
                                 <div className="h-full bg-red-500 rounded" style={{width: `${(u.hp/u.maxHp)*100}%`}}></div>
                             </div>
                        </div>
                    ))}
                </div>
             </div>

             {/* Game Status / Timer */}
             <div className="bg-black/80 p-3 rounded-lg flex flex-col items-center">
                 <div className="text-3xl font-mono font-bold">{formatTime(timeRemaining)}</div>
                 <div className="text-xs text-gray-400 uppercase tracking-widest">{gameStatus}</div>
             </div>

             {/* Team Blue Stats */}
             <div className="bg-black/60 backdrop-blur-md p-4 rounded-lg border-r-4 border-blue-500 w-64 text-right">
                <h2 className="text-blue-500 font-bold text-xl mb-2 flex items-center justify-end">Blue Team <Users className="ml-2"/></h2>
                <div className="space-y-2">
                    {blueUnits.map(u => (
                        <div key={u.id} className="flex justify-between items-center text-sm cursor-pointer hover:bg-white/10 p-1 rounded" onClick={() => {
                            if(cameraMode !== 'FREE') setFollowedUnit(u.id);
                        }}>
                             <div className="w-24 h-2 bg-gray-800 rounded">
                                 <div className="h-full bg-blue-500 rounded" style={{width: `${(u.hp/u.maxHp)*100}%`}}></div>
                             </div>
                             <span className={u.hp <= 0 ? 'text-gray-500 line-through' : ''}>Unit {u.id.slice(0,2)}</span>
                        </div>
                    ))}
                </div>
             </div>
        </div>

        {/* Bottom Bar: Controls */}
        <div className="flex justify-center items-end pointer-events-auto gap-4">
             {/* Camera Controls */}
             <div className="bg-gray-900/90 p-2 rounded-xl flex gap-2 shadow-2xl border border-gray-700">
                {(['FREE', 'TPS', 'FPS'] as CameraMode[]).map(mode => (
                    <button 
                        key={mode}
                        onClick={() => setCameraMode(mode)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all text-sm flex items-center ${cameraMode === mode ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        <Eye className="w-4 h-4 mr-2" />
                        {mode}
                    </button>
                ))}
             </div>
             
             <button 
                onClick={resetGame}
                className="bg-green-700 hover:bg-green-600 text-white p-3 rounded-xl font-bold shadow-lg flex items-center transition-transform active:scale-95"
             >
                <RefreshCw className="mr-2 w-5 h-5"/> RESTART
             </button>
        </div>
      </div>

      {/* End Screen Modal */}
      {gameStatus === 'FINISHED' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border-2 border-white/20 p-8 rounded-2xl text-center max-w-md shadow-2xl transform scale-110">
                <h1 className="text-4xl font-black mb-4 tracking-tighter uppercase">
                    {winner ? `${winner} TEAM WINS` : 'DRAW'}
                </h1>
                <p className="text-gray-400 mb-8">The simulation has concluded.</p>
                <button 
                    onClick={resetGame}
                    className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors w-full"
                >
                    PLAY AGAIN
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
