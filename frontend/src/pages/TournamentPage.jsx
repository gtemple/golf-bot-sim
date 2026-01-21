import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'


const holeSequence = (startHole) => {
  const s = Number(startHole || 1)
  const a = []
  for (let i = s; i <= 18; i++) a.push(i)
  for (let i = 1; i < s; i++) a.push(i)
  return a
}

const nextHoleForGroup = (group) => {
  const seq = holeSequence(group.start_hole || 1)
  const done = Number(group.holes_completed || 0)
  return seq[Math.min(done, 17)] // 0..17
}

const minutesForHole = (par, groupSize) => {
  // PGA-ish pace guide (good enough v1)
  if (groupSize >= 4) return { 3: 12, 4: 16, 5: 20 }[par] || 16
  return { 3: 11, 4: 14, 5: 18 }[par] || 14
}


const strokesForEntryRound = (entry, round) => {
  const map = new Map()
  for (const r of entry.hole_results || []) {
    if (Number(r.round_number) === Number(round)) map.set(Number(r.hole_number), Number(r.strokes))
  }
  return map
}


export default function TournamentPage() {
  const { id } = useParams()
  const [t, setT] = useState(null)
  const [course, setCourse] = useState(null)
  const [err, setErr] = useState('')
  const [minutes, setMinutes] = useState(11)
  const [saving, setSaving] = useState(false)


  const load = async () => {
    setErr('')
    try {
      const data = await api.getTournament(id)
      setT(data)
      try {
        const c = await api.getCourse(data.course)
        setCourse(c)
      } catch (e) {
        // course is optional for now (hole par will default to 4)
        console.warn('Failed to load course details', e)
      }
    } catch (e) {
      setErr(e.message || String(e))
    }
  }


  useEffect(() => { load() }, [id])

  const humans = useMemo(() => (t?.entries || []).filter(e => e.is_human), [t])

  const tick = async () => {
    setSaving(true)
    setErr('')
    try {
      const data = await api.tickTournament(id, Number(minutes))
      setT(data)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }



  const submitScore = async (entryId, holeNumber, strokes) => {
    setSaving(true)
    setErr('')
    try {
      const data = await api.submitHoleResult(id, {
        entry_id: entryId,
        hole_number: holeNumber,
        strokes: Number(strokes),
      })
      setT(data)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  const featuredGroup = useMemo(() => {
    if (!t?.groups?.length) return null
    return (
      t.groups.find(g => (g.members || []).some(m => m.entry?.is_human)) || null
    )
  }, [t])

  const nextHole = useMemo(() => {
    if (!featuredGroup) return null
    return nextHoleForGroup(featuredGroup)
  }, [featuredGroup])

  const holeInfo = useMemo(() => {
    if (!course || !nextHole) return null
    const holes = course.holes || []
    return holes.find(h => Number(h.number) === Number(nextHole)) || null
  }, [course, nextHole])

  const featuredGroupSize = useMemo(() => {
    return featuredGroup?.members?.length || 4
  }, [featuredGroup])

  const submitManyAndAdvance = async (strokesByEntryId, holeNumber, defaultPar, groupSize) => {
    if (!holeNumber) return

    setSaving(true)
    setErr('')
    try {
      // 1) submit all human hole results
      for (const [entryIdStr, strokes] of Object.entries(strokesByEntryId)) {
        const entryId = Number(entryIdStr)
        await api.submitHoleResult(id, {
          entry_id: entryId,
          hole_number: Number(holeNumber),
          strokes: Number(strokes),
        })
      }

      // 2) tick by estimated pace minutes for the hole
      const par = holeInfo?.par ?? defaultPar
      const mins = minutesForHole(Number(par), Number(groupSize || 4))
      const updated = await api.tickTournament(id, mins)
      setT(updated)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }



  if (!t) return <div style={{ padding: 24 }}>Loading…</div>

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link to="/">← New tournament</Link>
          <h1 style={{ margin: '8px 0' }}>{t.name}</h1>
          <div style={{ color: '#666' }}>
            Round {t.current_round} • {t.status} • {new Date(t.current_time).toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            value={minutes}
            min={1}
            onChange={e => setMinutes(e.target.value)}
            style={{ width: 90 }}
          />
          <button onClick={tick} disabled={saving}>
            Advance time
          </button>
          <button onClick={load} disabled={saving}>
            Refresh
          </button>
        </div>
      </div>

      {err ? <div style={{ background: 'rgb(219, 217, 217)', padding: 12, borderRadius: 8, margin: '12px 0' }}>{err}</div> : null}

      <h2>Leaderboard</h2>
      <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#2c2727' }}>
              <th style={{ padding: 10 }}>Pos</th>
              <th style={{ padding: 10 }}>Player</th>
              <th style={{ padding: 10 }}>Thru</th>
              <th style={{ padding: 10 }}>Today</th>
              <th style={{ padding: 10 }}>Total</th>
              <th style={{ padding: 10 }}>Cut</th>
            </tr>
          </thead>
          <tbody>
            {(t.entries || [])
              .slice()
              .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))
              .map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: 10 }}>{e.position ?? '-'}</td>
                  <td style={{ padding: 10 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: e.avatar_color || '#999',
                        marginRight: 8,
                        verticalAlign: 'middle',
                      }}
                    />
                    {e.display_name}
                    {e.is_human ? (
                      <span style={{ color: '#666' }}>
                        {' '}
                        ({e.country || '—'}, {e.handedness || 'R'})
                      </span>
                    ) : null}
                  </td>

                  <td style={{ padding: 10 }}>{e.thru_hole || 0}</td>
                  <td style={{ padding: 10 }}>{e.total_strokes}</td>
                  <td style={{ padding: 10 }}>{e.tournament_strokes ?? e.total_strokes}</td>
                  <td style={{ padding: 10 }}>{e.cut ? 'CUT' : ''}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <HoleControlPanel
        humans={humans}
        nextHole={nextHole}
        holeInfo={holeInfo}
        groupSize={featuredGroupSize}
        onSubmitManyAndAdvance={submitManyAndAdvance}
        disabled={saving}
      />


      <h2 style={{ marginTop: 24 }}>Human scorecards (v1)</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {humans.map(h => (
          <HumanCard
            key={h.id}
            entry={h}
            onSubmit={submitScore}
            disabled={saving}
          />
        ))}
        {course?.holes?.length ? (
          <HumanScorecardTable
            humans={humans}
            holes={course.holes}
            round={t.current_round}
            currentHole={nextHole}
          />
        ) : (
          <div style={{ color: '#666' }}>Scorecard needs course holes loaded.</div>
        )}
        {humans.length === 0 ? <div style={{ color: '#666' }}>No humans in this tournament.</div> : null}
      </div>
    </div>
  )
}

function HoleControlPanel({
  humans,
  nextHole,
  holeInfo,
  groupSize,
  onSubmitManyAndAdvance,
  disabled,
}) {
  const par = holeInfo?.par ?? 4

  const [strokesByEntryId, setStrokesByEntryId] = useState(() => {
    const init = {}
    for (const h of humans) init[h.id] = par
    return init
  })

  // whenever hole changes, reset defaults to par
  useEffect(() => {
    const init = {}
    for (const h of humans) init[h.id] = par
    setStrokesByEntryId(init)
  }, [nextHole, par, humans])

  if (!nextHole) {
    return (
      <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12, marginTop: 18 }}>
        <strong>Hole control</strong>
        <div style={{ color: '#666', marginTop: 6 }}>
          No featured group found (add at least one human to the tournament).
        </div>
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12, marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>Hole control</strong>
          <div style={{ color: '#666', marginTop: 4 }}>
            Next hole: <b>{nextHole}</b> {holeInfo ? `(Par ${holeInfo.par})` : `(Par ${par})`}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {humans.map(h => (
          <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: h.avatar_color || '#999',
                }}
              />
              <span>{h.display_name}</span>
            </div>

            <input
              type="number"
              min={1}
              max={15}
              value={strokesByEntryId[h.id] ?? par}
              onChange={(e) => {
                const v = Number(e.target.value)
                setStrokesByEntryId(prev => ({ ...prev, [h.id]: v }))
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button
          onClick={() => onSubmitManyAndAdvance(strokesByEntryId, nextHole, par, groupSize)}
          disabled={disabled}
        >
          Submit & Advance
        </button>

        <small style={{ color: '#666', alignSelf: 'center' }}>
          (Advances time by expected pace for this hole)
        </small>
      </div>
    </div>
  )
}

function HumanCard({ entry, onSubmit, disabled }) {
  const [hole, setHole] = useState(Math.max(1, (entry.thru_hole || 0) + 1))
  const [strokes, setStrokes] = useState(4)

  useEffect(() => {
    setHole(Math.max(1, (entry.thru_hole || 0) + 1))
  }, [entry.thru_hole])

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 999,
              background: entry.avatar_color || '#999',
            }}
          />
          {entry.display_name}
          <span style={{ fontWeight: 400, color: '#666' }}>
            ({entry.country || '—'}, {entry.handedness || 'R'})
          </span>
        </strong>

        <span style={{ color: '#666' }}>Thru {entry.thru_hole || 0}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
        <label>
          Hole{' '}
          <input
            type="number"
            min={1}
            max={18}
            value={hole}
            onChange={e => setHole(e.target.value)}
            style={{ width: 70 }}
          />
        </label>

        <label>
          Strokes{' '}
          <input
            type="number"
            min={1}
            max={15}
            value={strokes}
            onChange={e => setStrokes(e.target.value)}
            style={{ width: 70 }}
          />
        </label>

        <button
          onClick={() => onSubmit(entry.id, Number(hole), Number(strokes))}
          disabled={disabled}
        >
          Submit
        </button>
      </div>

      <small style={{ display: 'block', marginTop: 8, color: '#666' }}>
        v1: manual entry; later we’ll show full 18-hole card + “current hole” helpers.
      </small>
    </div>
  )
}


function HumanScorecardTable({ humans, holes, round, currentHole }) {
  const holesSorted = [...holes].sort((a, b) => Number(a.number) - Number(b.number))

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#5c5050', textAlign: 'left' }}>
            <th style={{ padding: 10 }}>Player</th>
            {holesSorted.map(h => (
              <th key={h.number} style={{ padding: 8, textAlign: 'center' }}>
                {h.number}
              </th>
            ))}
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: 10, color: '#666' }}>Par</th>
            {holesSorted.map(h => (
              <th key={h.number} style={{ padding: 8, textAlign: 'center', color: '#666' }}>
                {h.par}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {humans.map(h => {
            const strokesMap = strokesForEntryRound(h, round)
            return (
              <tr key={h.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10, borderRadius: 999,
                    background: h.avatar_color || '#999', marginRight: 8,
                  }} />
                  {h.display_name}
                </td>
                {holesSorted.map(hole => {
                  const v = strokesMap.get(Number(hole.number))
                  const isCurrent = Number(hole.number) === Number(currentHole)
                  return (
                    <td
                      key={hole.number}
                      style={{
                        padding: 8,
                        textAlign: 'center',
                        background: isCurrent ? 'rgba(59,130,246,0.12)' : undefined,
                        fontWeight: isCurrent ? 700 : 400,
                      }}
                    >
                      {v ?? ''}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
