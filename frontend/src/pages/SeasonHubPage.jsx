import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Trophy, Calendar, Play, CheckCircle, Clock } from 'lucide-react'
import { api } from '../api/client'

export default function SeasonHubPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [season, setSeason] = useState(null)
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      const [s, st] = await Promise.all([
        api.getSeason(id),
        api.getSeasonStandings(id)
      ])
      setSeason(s)
      setStandings(st)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-10 text-center">Loading Season...</div>
  
  if (!season) return <div className="p-10 text-center">Season not found.</div>

  const nextEvent = season.tournaments.find(t => t.status !== 'finished')
  const completedCount = season.tournaments.filter(t => t.status === 'finished').length
  const progressPercent = (completedCount / season.tournaments.length) * 100

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white pt-10 pb-20 px-6">
         <div className="max-w-7xl mx-auto flex justify-between items-end">
             <div>
                 <h4 className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-2">Season Mode</h4>
                 <h1 className="text-4xl font-black mb-2">{season.name}</h1>
                 <div className="flex items-center gap-4 text-blue-100 text-sm">
                    <span className="flex items-center gap-1"><Calendar size={14}/> {season.tournaments.length} Events</span>
                    <span>•</span>
                    <span>{standings.length} Active Players</span>
                 </div>
             </div>
             
             {nextEvent && (
                 <button 
                    onClick={() => navigate(`/tournaments/${nextEvent.id}`)}
                    className="bg-white text-blue-900 px-6 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors shadow-lg flex items-center gap-2"
                 >
                     <Play size={20} fill="currentColor" />
                     Play Next Event
                 </button>
             )}
         </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 -mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column: Standings */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* Leaderboard Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h2 className="font-bold text-gray-800 flex items-center gap-2">
                          <Trophy className="text-yellow-500" size={20} /> Season Standings (FedEx Cup)
                      </h2>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                              <tr>
                                  <th className="px-6 py-3">Rank</th>
                                  <th className="px-6 py-3">Player</th>
                                  <th className="px-6 py-3 text-center">Wins</th>
                                  <th className="px-6 py-3 text-center">Top 10</th>
                                  <th className="px-6 py-3 text-right">Points</th>
                              </tr>
                          </thead>
                          <tbody>
                              {standings.slice(0, 50).map((p, idx) => (
                                  <tr key={idx} className={`border-b border-gray-50 hover:bg-gray-50 ${p.is_human ? 'bg-blue-50' : ''}`}>
                                      <td className="px-6 py-4 font-medium text-gray-900">{idx + 1}</td>
                                      <td className="px-6 py-4 font-bold text-gray-800 flex items-center gap-2">
                                          {p.is_human && <span className="bg-blue-600 text-white text-[10px] px-1 rounded">YOU</span>}
                                          {p.name}
                                          {p.wins > 0 && <Trophy size={12} className="text-yellow-500 ml-1"/>}
                                      </td>
                                      <td className="px-6 py-4 text-center text-gray-500">{p.wins}</td>
                                      <td className="px-6 py-4 text-center text-gray-500">{p.top10}</td>
                                      <td className="px-6 py-4 text-right font-bold text-blue-800">{p.points.toLocaleString()}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  {standings.length === 0 && <div className="p-8 text-center text-gray-400">No events completed yet.</div>}
              </div>
          </div>
          
          {/* Sidebar: Schedule */}
          <div className="space-y-6">
             <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                 <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                     <h3 className="font-bold text-gray-800">Season Schedule</h3>
                 </div>
                 <div className="divide-y divide-gray-100">
                     {season.tournaments.map((t, i) => {
                         const isNext = nextEvent && t.id === nextEvent.id
                         const isDone = t.status === 'finished'
                         
                         return (
                             <div 
                                key={t.id} 
                                className={`p-4 flex items-center justify-between ${isNext ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}
                             >
                                 <div>
                                     <div className="text-xs text-gray-400 font-bold uppercase mb-1">Event #{t.season_order}</div>
                                     <h4 className={`font-bold text-sm leading-tight mb-1 ${isNext ? 'text-blue-900' : 'text-gray-900'}`}>
                                         {t.name}
                                     </h4>
                                     <p className="text-xs text-gray-500">{t.course_name}</p>
                                     {t.winner && <p className="text-xs text-green-600 font-medium mt-1">Winner: {t.winner}</p>}
                                 </div>
                                 
                                 <div>
                                     {isDone ? (
                                         <CheckCircle className="text-green-500" size={20} />
                                     ) : isNext ? (
                                          <Link 
                                            to={`/tournaments/${t.id}`}
                                            className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-700 transition-colors"
                                          >
                                              PLAY
                                          </Link>
                                     ) : (
                                         <Clock className="text-gray-300" size={20} />
                                     )}
                                 </div>
                             </div>
                         )
                     })}
                 </div>
             </div>
          </div>
      </div>
    </div>
  )
}
