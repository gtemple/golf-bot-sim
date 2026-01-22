import { Users } from 'lucide-react';

interface ScorecardPlayer {
  name: string;
  scores: (number | string)[];
  total: number;
}

const holes = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const players: ScorecardPlayer[] = [
  {
    name: 'Hlenodras',
    scores: ['--', '--', '--', '--', '--', '--', '--', '--', '--'],
    total: 50
  },
  {
    name: 'Daryl Freie',
    scores: ['--', '--', '--', '--', '--', '--', '--', '--', '--'],
    total: 39
  },
  {
    name: 'Nikolas Wohner',
    scores: ['--', '--', '--', '--', '--', '--', '--', '--', '--'],
    total: 39
  }
];

const holes10to18 = [10, 11, 12, 13, 14, 15, 16, 17, 18];

const playersBack9: ScorecardPlayer[] = [
  {
    name: 'Hlenodras',
    scores: [4, 5, 5, 5, 5, 5, 5, 5, 5],
    total: 50
  },
  {
    name: 'Daryl Freie',
    scores: [4, 4, 4, 4, 5, 4, 4, 5, 5],
    total: 39
  },
  {
    name: 'Nikolas Wohner',
    scores: [4, 4, 4, 5, 4, 5, 4, 4, 5],
    total: 39
  }
];

export function GroupScorecard() {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 py-3 border-b border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-green-900">Group Scorecard</h3>
          </div>
          <span className="text-xs text-green-700 font-medium">Playing #1</span>
        </div>
      </div>
      
      <div className="p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Frontup • Tee 18 R sts.</h4>
        </div>

        {/* Front 9 */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-semibold text-gray-600">Hole</th>
                {holes.map(hole => (
                  <th key={hole} className="text-center py-2 px-2 font-semibold text-gray-900">
                    {hole}
                  </th>
                ))}
                <th className="text-center py-2 px-2 font-semibold text-gray-900 bg-gray-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.name} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                  <td className="py-2 px-2 font-medium text-gray-900">{player.name}</td>
                  {player.scores.map((score, idx) => (
                    <td key={idx} className="text-center py-2 px-2 text-gray-600">
                      {score}
                    </td>
                  ))}
                  <td className="text-center py-2 px-2 font-bold text-gray-900 bg-gray-50">
                    {player.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Back 9 */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-semibold text-gray-600">Hole</th>
                {holes10to18.map(hole => (
                  <th key={hole} className="text-center py-2 px-2 font-semibold text-gray-900">
                    {hole}
                  </th>
                ))}
                <th className="text-center py-2 px-2 font-semibold text-gray-900 bg-gray-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {playersBack9.map((player, index) => (
                <tr key={player.name} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                  <td className="py-2 px-2 font-medium text-gray-900">{player.name}</td>
                  {player.scores.map((score, idx) => (
                    <td 
                      key={idx} 
                      className={`text-center py-2 px-2 font-medium ${
                        score === 4 ? 'text-green-600 bg-green-50' :
                        score === 5 ? 'text-blue-600 bg-blue-50' :
                        'text-gray-600'
                      }`}
                    >
                      {score}
                    </td>
                  ))}
                  <td className="text-center py-2 px-2 font-bold text-gray-900 bg-gray-50">
                    {player.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
