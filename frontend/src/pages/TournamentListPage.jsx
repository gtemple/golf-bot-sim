import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Calendar, Plus, Users, Play, Clock, CheckCircle, ArrowRight } from 'lucide-react'
import { api } from '../api/client'

export default function TournamentListPage() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [tData, sData] = await Promise.all([
          api.listTournaments(),
          api.listSeasons() // Assume api.listSeasons is available
        ])
        if (!alive) return
        // Filter out tournaments that belong to a season (they are shown in the season card)
        setTournaments(tData.filter(t => !t.season))
        setSeasons(sData || [])
      } catch (e) {
        if (!alive) return
        setErr(e.message || String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status) => {
    const styles = {
      setup: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Play },
      finished: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
    }
    const style = styles[status] || styles.setup
    const Icon = style.icon
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  const handleCreateSeason = async () => {
    navigate('/season/create')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex items-center justify-center">
        <div className="text-gray-700 text-lg font-medium">Loading tournaments...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-green-900 text-white">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 20px 20px, #fff 2px, transparent 0)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="relative px-6 py-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <h1 className="text-4xl font-bold">Tournaments</h1>
            </div>
            <p className="text-green-100 text-lg">
              Manage and view your golf tournaments
            </p>
          </div>
          
          <div className="flex gap-3">
             <button 
                onClick={handleCreateSeason}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all hover:transform hover:scale-105 flex items-center gap-2"
             >
                <Calendar className="w-5 h-5" />
                New Season
             </button>
             <button 
                onClick={() => navigate('/history')}
                className="px-6 py-3 bg-green-700/50 hover:bg-green-700 hover:text-white text-green-100 rounded-xl font-bold shadow-lg transition-all hover:transform hover:scale-105 flex items-center gap-2 border border-green-600"
              >
                <Trophy className="w-5 h-5" />
                History
              </button>
              <button 
                onClick={() => navigate('/create')}
                className="px-6 py-3 bg-white hover:bg-gray-100 text-green-900 rounded-xl font-bold shadow-lg transition-all hover:transform hover:scale-105 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Tournament
              </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Seasons Section */}
        {seasons.length > 0 && (
            <div className="mb-12">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Calendar className="text-blue-600"/> Active Seasons
                </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {seasons.map(season => {
                     const events = season.tournaments || []
                     const finishedCount = events.filter(e => e.status === 'finished').length
                     const currentEvent = events.find(e => e.status !== 'finished')
                     
                     let statusText = "Season Finished"
                     if (currentEvent) {
                        const roundInfo = currentEvent.status === 'in_progress' ? `(Round ${currentEvent.current_round})` : ''
                        statusText = `Event ${currentEvent.season_order} of ${events.length}: ${currentEvent.name} ${roundInfo}`
                     } else if (events.length === 0) {
                        statusText = "Setup In Progress"
                     }

                     return (
                         <div key={season.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                            <div className="p-6 flex-grow">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{season.name}</h3>
                                        <p className="text-sm text-blue-600 font-medium mt-1">
                                            {statusText}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-gray-800">{Math.round((finishedCount / Math.max(events.length, 1)) * 100)}%</span>
                                        <div className="text-xs text-gray-500 uppercase font-bold">Complete</div>
                                    </div>
                                </div>
                                
                                {season.leaders && season.leaders.length > 0 && (
                                    <div className="mb-6 bg-gray-50 rounded-lg p-3">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Season Leaders</h4>
                                        <div className="space-y-2">
                                            {season.leaders.map((l, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${idx===0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-600'}`}>
                                                            {idx + 1}
                                                        </span>
                                                        <span className="font-medium text-gray-900">{l.name}</span>
                                                    </div>
                                                    <span className="font-bold text-gray-600">{l.points} pts</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={() => navigate(`/season/${season.id}`)}
                                    className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    Continue Season
                                </button>
                            </div>
                         </div>
                     )
                 })}
                 </div>
            </div>
        )}

        {err && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {err}
          </div>
        )}

        {tournaments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="text-6xl mb-6">⛳</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No tournaments yet</h2>
            <p className="text-gray-600 mb-8">Get started by creating your first tournament</p>
            <button 
              onClick={() => navigate('/create')}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              Create Your First Tournament
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map(t => (
              <div 
                key={t.id}
                onClick={() => navigate(t.format === 'match' ? `/ryder/${t.id}` : `/t/${t.id}`)}
                className="group bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden cursor-pointer hover:shadow-xl hover:border-green-300 transition-all duration-200"
              >
                <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1">
                        {t.name}
                      </h3>
                      {t.format === 'match' && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full uppercase tracking-wide">
                          Ryder Cup Mode
                        </span>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(t.status)}
                </div>
                
                <div className="px-6 py-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-2">
                       <Play className="w-4 h-4 text-green-600" />
                       Round {t.current_round} of 4
                    </span>
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      {t.entries?.length || 0} players
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(t.start_time)}
                    </span>
                    <span className="text-green-600 text-sm font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      View <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}