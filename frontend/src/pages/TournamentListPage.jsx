import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Calendar, Plus, Users, Play, Clock, CheckCircle, ArrowRight } from 'lucide-react'
import { api } from '../api/client'

export default function TournamentListPage() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const data = await api.listTournaments()
        if (!alive) return
        setTournaments(data)
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
          
          <button 
            onClick={() => navigate('/create')}
            className="px-6 py-3 bg-white hover:bg-gray-100 text-green-900 rounded-xl font-bold shadow-lg transition-all hover:transform hover:scale-105 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Tournament
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
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