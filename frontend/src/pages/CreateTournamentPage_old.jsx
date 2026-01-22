import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const countryOptions = [
  'USA', 'CAN', 'IRL', 'ENG', 'SCO', 'AUS', 'ESP', 'SWE', 'NOR', 'DEN', 'FRA', 'GER', 'ITA', 'JPN', 'KOR', 'CHN', 'MEX', 'RSA',
]

export default function CreateTournamentPage() {
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [golfers, setGolfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [name, setName] = useState('Shadow Tourney')
  const [courseId, setCourseId] = useState('')
  const [golferCount, setGolferCount] = useState(3)

  const [humans, setHumans] = useState([
    { name: 'Giordano', country: 'CAN', handedness: 'L', avatar_color: '#3B82F6' }

  ])
  const avatarColors = ['#3B82F6', '#22C55E', '#F97316', '#A855F7', '#EF4444', '#14B8A6', '#64748B']

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          setLoading(true)
          const [c, g] = await Promise.all([api.listCourses(), api.listGolfers()])
          if (!alive) return
          setCourses(c)
          setGolfers(g)
          setCourseId(String(c?.[0]?.id ?? ''))
          setGolferCount(Math.min(3, g.length))
        } catch (e) {
          setErr(e.message || String(e))
        } finally {
          setLoading(false)
        }
      })()
    return () => { alive = false }
  }, [])

  const selectedGolferIds = useMemo(() => {
    // v1: just take first N golfers
    return golfers.slice(0, golferCount).map(g => g.id)
  }, [golfers, golferCount])

  const addHuman = () =>
    setHumans(h => [...h, { name: '', country: 'CAN', handedness: 'R', avatar_color: avatarColors[0] }])

  const removeHuman = (idx) => setHumans(h => h.filter((_, i) => i !== idx))

  const updateHuman = (idx, patch) => {
    setHumans(h => h.map((u, i) => (i === idx ? { ...u, ...patch } : u)))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')

    const cleanHumans = humans
      .map(h => ({ ...h, name: h.name.trim() }))
      .filter(h => h.name.length > 0)

    if (!courseId) return setErr('Please select a course.')
    if (cleanHumans.length === 0) return setErr('Add at least one human player.')

    try {
      const payload = {
        name,
        course_id: Number(courseId),
        golfer_ids: selectedGolferIds,
        humans: cleanHumans.map(h => ({
          name: h.name,
          country: h.country,
          handedness: h.handedness,
          avatar_color: h.avatar_color,
        }))

        // later we’ll extend backend to accept country too
      }

      const t = await api.createTournament(payload)
      navigate(`/t/${t.id}`)
    } catch (e2) {
      setErr(e2.message || String(e2))
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Create Tournament</h1>
        <button 
          type="button"
          onClick={() => navigate('/')}
          style={{ 
            padding: '8px 16px', 
            borderRadius: 6,
            background: 'transparent',
            border: '1px solid #ddd',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ← Back to List
        </button>
      </div>

      {err ? <div style={{ background: '#fee', padding: 12, borderRadius: 8, marginBottom: 12 }}>{err}</div> : null}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          Tournament name
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          Course
          <select value={courseId} onChange={e => setCourseId(e.target.value)}>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.location ? ` — ${c.location}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          Number of bot golfers
          <input
            type="number"
            min={0}
            max={golfers.length}
            value={golferCount}
            onChange={e => setGolferCount(Number(e.target.value))}
          />
          <small>Max: {golfers.length}</small>
        </label>

        <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Human players</strong>
            <button type="button" onClick={addHuman}>+ Add</button>
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {humans.map((h, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10 }}>
                <input
                  placeholder="Name"
                  value={h.name}
                  onChange={e => updateHuman(idx, { name: e.target.value })}
                />
                <select
                  value={h.country}
                  onChange={e => updateHuman(idx, { country: e.target.value })}
                >
                  {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={h.handedness}
                  onChange={e => updateHuman(idx, { handedness: e.target.value })}
                >
                  <option value="R">R</option>
                  <option value="L">L</option>
                </select>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={h.avatar_color}
                    onChange={e => updateHuman(idx, { avatar_color: e.target.value })}
                    style={{ width: 44, height: 34, padding: 0, border: 'none', background: 'transparent' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {avatarColors.slice(0, 5).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateHuman(idx, { avatar_color: c })}
                        title={c}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          border: c === h.avatar_color ? '2px solid #111' : '1px solid #ccc',
                          background: c,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => removeHuman(idx)} disabled={humans.length <= 1}>
                  Remove
                </button>
              </div>
            ))}
          </div>



          <small style={{ display: 'block', marginTop: 10, color: '#666' }}>
            v1 note: countries are UI-only for now; we’ll send them to the backend next.
          </small>
        </div>

        <button type="submit" style={{ padding: 10, borderRadius: 10 }}>
          Create tournament
        </button>
      </form>
    </div>
  )
}
