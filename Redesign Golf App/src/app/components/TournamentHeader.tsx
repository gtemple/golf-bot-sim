import { MapPin, Calendar, Users, Trophy, Scissors } from 'lucide-react';

export function TournamentHeader() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-green-900 text-white">
      {/* Golf course pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20px 20px, #fff 2px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>
      
      <div className="relative px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <h1 className="text-4xl font-bold">Shadow Tourney</h1>
            </div>
            <div className="flex items-center gap-2 text-green-100 mb-4">
              <span className="text-sm">Round 6</span>
              <span className="text-green-400">•</span>
              <span className="text-sm">Fairways United at Southbreeze</span>
              <span className="text-green-400">•</span>
              <span className="text-sm">Sep 30, 10:21</span>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg transition-colors flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>Advance Face</span>
            </button>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              Network
            </button>
          </div>
        </div>
        
        {/* Projected Cut Line */}
        <div className="mt-6 p-4 bg-yellow-500/20 rounded-lg border border-yellow-400/40 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <Scissors className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-yellow-100 mb-1">Projected Cut Line (36 holes)</h3>
              <p className="text-sm text-yellow-50">
                <span className="font-bold text-lg">-69</span> <span className="text-yellow-200">(Top 65 + ties)</span>
                <span className="text-yellow-300 mx-2">•</span>
                <span className="text-yellow-100">60 inside, 13 at the line</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}