import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';

interface Player {
  rank: number;
  name: string;
  score: string | number;
  thru: string | number;
  today: string | number;
  status?: 'up' | 'down' | 'same';
}

const players: Player[] = [
  { rank: 1, name: 'Rigget Schmidt', score: '10:51 p.m.', thru: 0, today: -4 },
  { rank: 2, name: 'Alex Rogers', score: '10:50 p.m.', thru: 0, today: -3 },
  { rank: 3, name: 'Kian Maria Smith', score: '10:30 p.m.', thru: 0, today: -5 },
  { rank: 4, name: 'Aria Belize', score: '10:51 p.m.', thru: 0, today: -4 },
  { rank: 5, name: 'Darnell Garcia', score: 0, thru: -4, today: -5 },
  { rank: 6, name: 'Charlotta Bogdansdottir', score: 0, thru: 0, today: -5 },
  { rank: 7, name: 'Annegrete Blitz', score: 18, thru: -4, today: -4 },
  { rank: 8, name: 'Jonelle Jeperson', score: 0, thru: 0, today: -3 },
  { rank: 9, name: 'Hellen Maitland', score: '10:59 p.m.', thru: 0, today: -4 },
  { rank: 10, name: 'Jake Sawyer', score: '12:23 p.m.', thru: 0, today: -4 },
  { rank: 11, name: 'Bleu McGreary', score: 0, thru: 0, today: -4 },
  { rank: 12, name: 'Carmen Towring', score: '10:51 p.m.', thru: 0, today: -4 },
  { rank: 13, name: 'Brien Kresimirs', score: '10:21 p.m.', thru: 0, today: -4 },
  { rank: 14, name: 'Wendelin Clark', score: '10:46 p.m.', thru: 0, today: -5 },
  { rank: 15, name: 'Corey Cameron', score: '10:12 p.m.', thru: 0, today: -3 },
  { rank: 16, name: 'Lorena Jespersen', score: '11:21 p.m.', thru: 0, today: -3 },
  { rank: 17, name: 'JR. et. Shields', score: 0, thru: -1, today: -5 },
  { rank: 18, name: 'Saoirse Oleanna', score: 0, thru: -11, today: -3 },
  { rank: 19, name: 'Jason King', score: 18, thru: -1, today: -3 },
  { rank: 20, name: 'Wize Lee', score: 0, thru: -1, today: -3 },
  { rank: 21, name: 'Adeline', score: 18, thru: -1, today: -3 },
  { rank: 22, name: 'Matt Watkins', score: 16, thru: -1, today: -5 },
  { rank: 23, name: 'Michael Silva', score: '11:55 p.m.', thru: 0, today: -3 },
  { rank: 24, name: 'Patrick Rodriguez', score: '11:07 p.m.', thru: 0, today: -5 },
  { rank: 25, name: 'Lewis Casey', score: '10:33 p.m.', thru: 0, today: -3 },
  { rank: 26, name: 'Lewis Cardett', score: '10:29 p.m.', thru: 0, today: -4 },
  { rank: 27, name: 'Micaela Cisneros', score: 0, thru: 0, today: -3 },
  { rank: 28, name: 'Daniel Holder', score: '10:45 p.m.', thru: 0, today: -5 },
  { rank: 29, name: 'Kovin Roy', score: 0, thru: 0, today: -3 },
  { rank: 30, name: 'Tom Strega', score: '10:51 p.m.', thru: 0, today: -3 },
  { rank: 31, name: 'Jonathan Gallegos', score: 18, thru: 0, today: -3 },
  { rank: 32, name: 'Tayyaba', score: 0, thru: -1, today: -3 },
  { rank: 33, name: 'Shanna Roach', score: '10:29 p.m.', thru: 0, today: 0 },
  { rank: 34, name: 'Spyridon Thoti Gist', score: '11:31 p.m.', thru: 0, today: -3 },
  { rank: 35, name: 'Brian Gregory', score: 0, thru: -11, today: -3 },
  { rank: 36, name: 'Jacob Blackwell', score: 0, thru: 0, today: 0 },
  { rank: 37, name: 'Matthew Mulvoner', score: 0, thru: 0, today: -3 },
  { rank: 38, name: 'Ashley Hamer', score: '11:07 p.m.', thru: 0, today: -3 },
  { rank: 39, name: 'Shaun Moore', score: '10:42 p.m.', thru: 0, today: -3 },
  { rank: 40, name: 'Martin Castillo', score: 0, thru: -11, today: -4 },
  { rank: 41, name: 'Chris Guttenberg', score: '10:32 p.m.', thru: 0, today: 0 },
  { rank: 42, name: 'Jimmy Say', score: '10:31 p.m.', thru: 0, today: 0 },
  { rank: 43, name: 'Gregory Crockett', score: 0, thru: -1, today: -3 },
  { rank: 44, name: 'Justin Aindrindla', score: 12, thru: 0, today: 0 },
  { rank: 45, name: 'Iliana Lowery', score: 0, thru: -1, today: 0 },
  { rank: 46, name: 'Chris Gonzalez', score: '10:32 p.m.', thru: 0, today: 0 },
  { rank: 47, name: 'G. Operon', score: 0, thru: 0, today: -3 },
  { rank: 48, name: 'Caleb Sewell', score: '11:11 p.m.', thru: 0, today: -4 },
  { rank: 49, name: 'Ryan Bell', score: 0, thru: -11, today: -4 },
  { rank: 50, name: 'Rory Roscoe', score: '10:21 p.m.', thru: 0, today: -4 },
  { rank: 51, name: 'Tom McElhinlo', score: 0, thru: 0, today: -3 },
];

export function Leaderboard() {
  const getScoreColor = (score: number) => {
    if (score <= -5) return 'text-green-600 bg-green-50';
    if (score <= -3) return 'text-green-700 bg-green-50';
    if (score < 0) return 'text-green-800 bg-green-50';
    return 'text-gray-700 bg-gray-50';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-green-200">
        <h2 className="text-xl font-bold text-green-900">Leaderboard</h2>
        <p className="text-sm text-green-700 mt-1">137 players • Par 4 • Hole thru</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Thru
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Today
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {players.map((player, index) => (
              <tr 
                key={player.rank}
                className={`hover:bg-green-50/50 transition-colors ${
                  index < 3 ? 'bg-yellow-50/30' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${
                      index === 0 ? 'text-yellow-600' :
                      index === 1 ? 'text-gray-500' :
                      index === 2 ? 'text-orange-600' :
                      'text-gray-700'
                    }`}>
                      {player.rank}
                    </span>
                    {index < 3 && (
                      <Trophy className={`w-4 h-4 ${
                        index === 0 ? 'text-yellow-500' :
                        index === 1 ? 'text-gray-400' :
                        'text-orange-500'
                      }`} />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">{player.name}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="text-sm text-gray-700">{player.score}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${
                    typeof player.thru === 'number' && player.thru < 0
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {player.thru}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold ${
                    getScoreColor(player.today as number)
                  }`}>
                    {player.today}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}