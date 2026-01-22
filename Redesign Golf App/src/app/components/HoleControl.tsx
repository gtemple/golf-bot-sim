import { Play, ChevronUp, ChevronDown, Target } from 'lucide-react';

interface Player {
  name: string;
  country: string;
  position: string;
  score: number;
}

const players: Player[] = [
  { name: 'Giordano', country: 'CAN', position: 'L', score: 4 },
  { name: 'ryan', country: 'CAN', position: 'R', score: 4 }
];

export function HoleControl() {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-br from-green-600 to-green-700 px-5 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
            <Target className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-white text-lg">Hole Control</h3>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-green-50">
            Next hole <span className="font-bold text-white">15</span> (Par 4) • Group size 4
          </p>
          <span className="text-xs text-green-100 bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">
            Defaults to par
          </span>
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        {players.map((player, index) => (
          <div 
            key={index}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full bg-green-500`}></div>
              <div>
                <h4 className="font-bold text-gray-900">{player.name}</h4>
                <p className="text-xs text-gray-600">
                  {player.country} • {player.position}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 flex items-center justify-center rounded-md bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-300 transition-colors">
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="w-12 h-10 flex items-center justify-center bg-white rounded-lg border-2 border-gray-300">
                <span className="text-gray-900 font-bold">{player.score}</span>
              </div>
              <button className="w-8 h-8 flex items-center justify-center rounded-md bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-300 transition-colors">
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="px-4 pb-4">
        <button className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
          <Play className="w-4 h-4" />
          Submit & Advance
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Time advances based on par + group size
        </p>
      </div>
    </div>
  );
}