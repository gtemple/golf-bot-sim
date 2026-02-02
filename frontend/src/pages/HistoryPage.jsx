import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Calendar, MapPin, Medal } from 'lucide-react'
import { api } from '../api/client'

export default function HistoryPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getHistory()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium animate-pulse">Loading history...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">Error: {error}</div>
        <Link to="/" className="inline-block mt-4 text-blue-600 hover:align-baseline">Back Home</Link>
      </div>
    )
  }

  const { tournaments, career_wins } = data

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
                <div>
                   <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                      <Medal className="w-8 h-8 text-yellow-500" />
                      Historical Records
                   </h1>
                   <p className="mt-2 text-gray-500">Hall of fame and past tournament results.</p>
                </div>
                <Link 
                  to="/" 
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  ← Back to Home
                </Link>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Champions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2 mb-2">
               <Trophy className="w-5 h-5 text-gray-400" />
               <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider">Past Champions</h2>
            </div>

            {tournaments.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500">
                    No tournaments recorded yet.
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Tournament</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Winner</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tournaments.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{t.name}</div>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                                <MapPin className="w-3 h-3" />
                                                {t.course}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                {new Date(t.date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                               <Medal className={`w-4 h-4 ${t.rounds >= 4 ? 'text-yellow-500' : 'text-gray-300'}`} />
                                               <span className="font-bold text-gray-900">{t.winner}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <span className={`font-mono font-bold ${
                                                t.to_par < 0 ? 'text-green-600' : 
                                                t.to_par > 0 ? 'text-gray-900' : 'text-gray-500'
                                            }`}>
                                                {t.to_par === 0 ? 'E' : t.to_par > 0 ? `+${t.to_par}` : t.to_par}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                ({t.score})
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
          </div>

          {/* Career Wins Sidebar */}
          <div className="space-y-6">
             <div className="flex items-center gap-2 mb-2">
               <Medal className="w-5 h-5 text-gray-400" />
               <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider">Career Titles</h2>
             </div>
             
             {career_wins.length === 0 ? (
                 <div className="bg-white p-6 rounded-xl border border-gray-200 text-center text-gray-500">
                     No wins recorded.
                 </div>
             ) : (
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="divide-y divide-gray-100">
                         {career_wins.map((p, idx) => (
                             <div key={p.name} className="px-5 py-3 flex items-center justify-between hover:bg-yellow-50/50 transition-colors">
                                 <div className="flex items-center gap-3">
                                     <span className={`
                                        w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                                        ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                                          idx === 1 ? 'bg-gray-100 text-gray-700' : 
                                          idx === 2 ? 'bg-orange-100 text-orange-800' : 'text-gray-400'}
                                     `}>
                                         {idx + 1}
                                     </span>
                                     <span className={`text-sm ${idx < 3 ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                                         {p.name}
                                     </span>
                                 </div>
                                 <div className="flex items-center gap-1.5">
                                     <span className="font-bold text-gray-900">{p.wins}</span>
                                     <Trophy className="w-3 h-3 text-yellow-500" />
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}
          </div>

        </div>
      </div>
    </div>
  )
}
