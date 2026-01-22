import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      setup: { bg: '#fef3c7', color: '#92400e' },
      in_progress: { bg: '#dbeafe', color: '#1e40af' },
      finished: { bg: '#d1fae5', color: '#065f46' },
    }
    const style = styles[status] || styles.setup
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
      }}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ fontSize: 16, color: '#64748b' }}>Loading tournaments...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px 24px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 700, color: '#0f172a' }}>Tournaments</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: 15 }}>Manage and view your golf tournaments</p>
          </div>
          <button 
            onClick={() => navigate('/create')}
            style={{ 
              padding: '12px 24px', 
              borderRadius: 10, 
              background: '#3B82F6', 
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 15,
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.target.style.background = '#2563eb'
              e.target.style.transform = 'translateY(-1px)'
              e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
            }}
            onMouseLeave={e => {
              e.target.style.background = '#3B82F6'
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}
          >
            + New Tournament
          </button>
        </div>

        {err && (
          <div style={{ 
            background: '#fef2f2', 
            border: '1px solid #fecaca',
            padding: 16, 
            borderRadius: 12, 
            marginBottom: 24,
            color: '#991b1b',
            fontSize: 14
          }}>
            {err}
          </div>
        )}

        {tournaments.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 40px',
            background: 'white',
            borderRadius: 16,
            border: '2px dashed #e2e8f0',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⛳</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, color: '#334155' }}>No tournaments yet</h2>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 15 }}>Get started by creating your first tournament</p>
            <button 
              onClick={() => navigate('/create')}
              style={{ 
                padding: '12px 28px', 
                borderRadius: 10, 
                background: '#3B82F6', 
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 15,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.target.style.background = '#2563eb'}
              onMouseLeave={e => e.target.style.background = '#3B82F6'}
            >
              Create Your First Tournament
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {tournaments.map(t => (
              <div 
                key={t.id}
                onClick={() => navigate(`/t/${t.id}`)}
                style={{
                  padding: 24,
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'white',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3B82F6'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.12)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>{t.name}</h3>
                      {getStatusBadge(t.status)}
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      gap: 16, 
                      color: '#64748b', 
                      fontSize: 14,
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>Round {t.current_round}</span> of 4
                      </span>
                      <span>•</span>
                      <span>{t.entries?.length || 0} players</span>
                      <span>•</span>
                      <span>{formatDate(t.start_time)}</span>
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 20, 
                    color: '#3B82F6',
                    transition: 'transform 0.2s',
                  }}>
                    →
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
