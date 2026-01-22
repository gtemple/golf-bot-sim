import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'

/** ---------- helpers ---------- */

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
  if (done >= 18) return null
  return seq[done]
}

const strokesForEntryRound = (entry, round) => {
  const map = new Map()
  for (const r of entry.hole_results || []) {
    if (Number(r.round_number) === Number(round)) {
      map.set(Number(r.hole_number), Number(r.strokes))
    }
  }
  return map
}

const formatToPar = (n) => {
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

const buildParMap = (course) => {
  const m = new Map()
  for (const h of course?.holes || []) m.set(Number(h.number), Number(h.par))
  return m
}

const entryToPar = (entry, parMap, roundNumber = null) => {
  let toPar = 0
  for (const r of entry.hole_results || []) {
    const rn = Number(r.round_number)
    if (roundNumber != null && rn !== Number(roundNumber)) continue
    const hn = Number(r.hole_number)
    const s = Number(r.strokes)
    const par = Number(parMap.get(hn) ?? 4)
    toPar += (s - par)
  }
  return toPar
}

const thruDisplay = (entry, group) => {
  const thru = entry.thru_hole || 0
  if (thru >= 18) return 'F'
  if (thru === 0 && group?.tee_time) {
    // Haven't started yet, show tee time
    return fmtTime(group.tee_time)
  }
  return String(thru)
}

const fmtTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const groupStatus = (group) => {
  if (group.is_finished) return 'Finished'
  const hole = nextHoleForGroup(group)
  return `Playing ${hole}`
}

/** ---------- styling ---------- */

const theme = {
  bg: '#0B0F17',         // page
  panel: '#0F1625',      // cards
  panel2: '#111C2F',     // slightly brighter surface
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.12)',
  text: '#E7EEF8',
  text2: 'rgba(231,238,248,0.75)',
  text3: 'rgba(231,238,248,0.55)',
  brand: '#60A5FA',
  dangerBg: 'rgba(239, 68, 68, 0.14)',
  dangerBorder: 'rgba(239, 68, 68, 0.35)',
  okBg: 'rgba(16, 185, 129, 0.12)',
  okBorder: 'rgba(16, 185, 129, 0.30)',
}

const styles = {
  page: {
    minHeight: '100vh',
    background: theme.bg,
    color: theme.text,
    padding: '16px 20px',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  },
  container: { maxWidth: 1800, margin: '0 auto', width: '100%' },

  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },

  title: { margin: '8px 0 2px', fontSize: 28, letterSpacing: -0.4 },
  meta: { color: theme.text2, fontSize: 13 },

  link: {
    color: theme.text2,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(96,165,250,0.12)',
    border: `1px solid rgba(96,165,250,0.25)`,
    color: theme.text,
    fontSize: 12,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },

  controls: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },

  input: {
    width: 92,
    padding: '9px 10px',
    borderRadius: 12,
    border: `1px solid ${theme.border2}`,
    background: theme.panel,
    color: theme.text,
    outline: 'none',
  },

  btn: {
    padding: '9px 12px',
    borderRadius: 12,
    border: `1px solid ${theme.border2}`,
    background: theme.panel,
    color: theme.text,
    cursor: 'pointer',
    fontWeight: 600,
  },

  btnPrimary: {
    padding: '9px 12px',
    borderRadius: 12,
    border: `1px solid rgba(96,165,250,0.35)`,
    background: 'rgba(96,165,250,0.16)',
    color: theme.text,
    cursor: 'pointer',
    fontWeight: 700,
  },

  disabled: { opacity: 0.6, cursor: 'not-allowed' },

  alertErr: {
    background: theme.dangerBg,
    border: `1px solid ${theme.dangerBorder}`,
    color: theme.text,
    padding: 12,
    borderRadius: 14,
    margin: '14px 0',
  },

  alertOk: {
    background: theme.okBg,
    border: `1px solid ${theme.okBorder}`,
    color: theme.text,
    padding: 12,
    borderRadius: 14,
    margin: '14px 0',
  },

  card: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: 14,
    padding: 10,
    boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
  },

  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },

  tableWrap: {
    overflowX: 'auto',
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
  },

  table: { width: '100%', borderCollapse: 'collapse', minWidth: 680 },

  thRow: {
    background: 'linear-gradient(180deg, rgba(17,28,47,1) 0%, rgba(15,22,37,1) 100%)',
    color: theme.text,
    textAlign: 'left',
  },

  th: {
    padding: '8px 10px',
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
  },

  tr: { borderTop: `1px solid ${theme.border}` },

  td: {
    padding: '8px 10px',
    color: theme.text,
    verticalAlign: 'middle',
  },

  tdMuted: { color: theme.text2 },

  pill: {
    fontSize: 12,
    color: theme.text2,
    marginLeft: 8,
  },

  dot: (color) => ({
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: 999,
    background: color || '#94A3B8',
    boxShadow: '0 0 0 2px rgba(255,255,255,0.08)',
    marginRight: 10,
    verticalAlign: 'middle',
  }),

  sectionTitle: { margin: '4px 0 4px', fontSize: 16, letterSpacing: -0.2, fontWeight: 700 },

  grid2: { display: 'grid', gap: 10, gridTemplateColumns: '1fr' },

  splitRow: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: '1.1fr 0.9fr',
    alignItems: 'start',
  },

  small: { color: theme.text3, fontSize: 12 },
}

/** ---------- page ---------- */

export default function TournamentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [t, setT] = useState(null)
  const [course, setCourse] = useState(null)
  const [err, setErr] = useState('')
  const [minutes, setMinutes] = useState(11)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [leaderboardPage, setLeaderboardPage] = useState(0)
  const ENTRIES_PER_PAGE = 50

  const parMap = useMemo(() => buildParMap(course), [course])
  const humans = useMemo(() => (t?.entries || []).filter(e => e.is_human), [t])

  const featuredGroup = useMemo(() => {
    if (!t?.groups?.length) return null
    return t.groups.find(g => (g.members || []).some(m => m.entry?.is_human)) || null
  }, [t])

  const nextHole = useMemo(() => (featuredGroup ? nextHoleForGroup(featuredGroup) : null), [featuredGroup])

  const holeInfo = useMemo(() => {
    if (!course || !nextHole) return null
    return (course.holes || []).find(h => Number(h.number) === Number(nextHole)) || null
  }, [course, nextHole])

  const featuredGroupSize = useMemo(() => featuredGroup?.members?.length || 4, [featuredGroup])

  // Check if human group hasn't started yet (tee_time in future and no holes completed)
  const humanGroupNotStarted = useMemo(() => {
    if (!featuredGroup || !t) return false
    // If group has completed any holes, it's started
    if (featuredGroup.holes_completed > 0) return false
    // Check if any human has played
    const humanPlayed = humans.some(h => h.thru_hole > 0)
    return !humanPlayed
  }, [featuredGroup, t, humans])

  // Map entry ID to group for leaderboard display
  const entryToGroup = useMemo(() => {
    const map = new Map()
    if (!t?.groups) return map
    for (const group of t.groups) {
      for (const member of group.members || []) {
        if (member.entry?.id) {
          map.set(member.entry.id, group)
        }
      }
    }
    return map
  }, [t])

  const leaderboardRows = useMemo(() => {
    const entries = t?.entries || []
    if (!entries.length) return []

    const rows = entries.map(e => {
      const today_to_par = entryToPar(e, parMap, t?.current_round)
      const total_to_par = entryToPar(e, parMap, null)
      return { ...e, today_to_par, total_to_par }
    })

    rows.sort((a, b) => {
      const at = a.total_to_par ?? 9999
      const bt = b.total_to_par ?? 9999
      if (at !== bt) return at - bt
      const ad = a.today_to_par ?? 0
      const bd = b.today_to_par ?? 0
      if (ad !== bd) return ad - bd
      return (a.id - b.id)
    })

    return rows
  }, [t, parMap])

  const totalPages = Math.ceil(leaderboardRows.length / ENTRIES_PER_PAGE)
  const paginatedRows = useMemo(() => {
    const start = leaderboardPage * ENTRIES_PER_PAGE
    return leaderboardRows.slice(start, start + ENTRIES_PER_PAGE)
  }, [leaderboardRows, leaderboardPage])

  useEffect(() => {
    // Reset to page 0 when data changes
    setLeaderboardPage(0)
  }, [t?.id])

  const load = useCallback(async () => {
    setErr('')
    try {
      const data = await api.getTournament(id)
      setT(data)

      try {
        const c = await api.getCourse(data.course)
        setCourse(c)
      } catch {
        setCourse(null)
      }
    } catch (e) {
      setErr(e.message || String(e))
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const tick = useCallback(async (mins) => {
    setSaving(true)
    setErr('')
    try {
      const data = await api.tickTournament(id, Number(mins))
      setT(data)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }, [id])

  const submitScore = useCallback(async (entryId, holeNumber, strokes) => {
    setSaving(true)
    setErr('')
    try {
      const data = await api.submitHoleResult(id, {
        entry_id: entryId,
        hole_number: Number(holeNumber),
        strokes: Number(strokes),
      })
      setT(data)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }, [id])

  const simToTee = useCallback(async () => {
    setSaving(true)
    setErr('')
    setStatusMsg('Simulating to tee time...')
    try {
      const data = await api.simToTee(id)
      setT(data)
      setStatusMsg('Ready to tee off!')
      setTimeout(() => setStatusMsg(''), 1500)
    } catch (e) {
      setErr(e.message || String(e))
      setStatusMsg('')
    } finally {
      setSaving(false)
    }
  }, [id])

  const submitManyAndAdvance = useCallback(async (strokesByEntryId, holeNumber, defaultPar, groupSize) => {
    if (!holeNumber) return

    const missing = humans.filter(h => !Number.isFinite(Number(strokesByEntryId[h.id])))
    if (missing.length) {
      setErr(`Missing score for: ${missing.map(m => m.display_name).join(', ')}`)
      return
    }

    setSaving(true)
    setErr('')
    setStatusMsg(`Saving Hole ${holeNumber}…`)
    try {
      for (const [entryIdStr, strokes] of Object.entries(strokesByEntryId)) {
        await api.submitHoleResult(id, {
          entry_id: Number(entryIdStr),
          hole_number: Number(holeNumber),
          strokes: Number(strokes),
        })
      }

      // Use defaultPar passed from the component which has holeInfo
      const par = defaultPar
      const mins =
        Number(groupSize || 4) >= 4
          ? ({ 3: 12, 4: 16, 5: 20 }[par] || 16)
          : ({ 3: 11, 4: 14, 5: 18 }[par] || 14)

      setStatusMsg(`Advancing time (+${mins}m)…`)
      const updated = await api.tickTournament(id, mins)
      setT(updated)

      setStatusMsg(`Hole ${holeNumber} saved ✓`)
      setTimeout(() => setStatusMsg(''), 1200)
    } catch (e) {
      setErr(e.message || String(e))
      setStatusMsg('')
    } finally {
      setSaving(false)
    }
  }, [humans, id])

  if (!t) return <div style={styles.page}><div style={styles.container}>Loading…</div></div>

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <button 
              onClick={() => navigate('/')}
              style={{ 
                ...styles.link,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit',
              }}
            >
              ← All tournaments
            </button>
            <div style={styles.title}>{t.name}</div>
            <div style={styles.meta}>
              Round <b style={{ color: theme.text }}>{t.current_round}</b> •{' '}
              <b style={{ color: theme.text }}>{t.status}</b> •{' '}
              {new Date(t.current_time).toLocaleString()}
              {nextHole ? (
                <span style={styles.badge}>
                  Next hole <b>{nextHole}</b>{holeInfo ? ` • Par ${holeInfo.par}` : ''}
                </span>
              ) : null}
            </div>
          </div>

          <div style={styles.controls}>
            <input
              type="number"
              value={minutes}
              min={1}
              onChange={e => setMinutes(e.target.value)}
              style={styles.input}
            />
            <button
              onClick={() => tick(minutes)}
              disabled={saving}
              style={{ ...styles.btn, ...(saving ? styles.disabled : null) }}
            >
              Advance time
            </button>
            <button
              onClick={() => tick(11)}
              disabled={saving}
              style={{ ...styles.btn, ...(saving ? styles.disabled : null) }}
            >
              +11
            </button>
            <button
              onClick={load}
              disabled={saving}
              style={{ ...styles.btn, ...(saving ? styles.disabled : null) }}
            >
              Refresh
            </button>
          </div>
        </div>

        {err ? <div style={styles.alertErr}>{err}</div> : null}
        {statusMsg ? <div style={styles.alertOk}>{statusMsg}</div> : null}

        {/* Projected Cut Line */}
        {t?.projected_cut && (
          <div style={{
            padding: 12,
            borderRadius: 14,
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.3)',
            color: theme.text,
            marginTop: 12,
          }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>
              Projected Cut Line {t.current_round === 1 ? '(after R1)' : '(36 holes)'}
            </div>
            <div style={{ fontSize: 13, color: theme.text2 }}>
              {t.projected_cut.cut_to_par === 0 ? 'E' : t.projected_cut.cut_to_par > 0 ? `+${t.projected_cut.cut_to_par}` : t.projected_cut.cut_to_par} {' '}
              (Top {t.projected_cut.cut_position} + ties) • {' '}
              {t.projected_cut.players_inside} inside, {t.projected_cut.players_at_line} at the line
            </div>
          </div>
        )}

        {/* Responsive two-column layout: leaderboard on left, everything else on right */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))',
          gap: 24,
          marginTop: 16,
        }}>
          
          {/* LEFT COLUMN: Leaderboard */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={styles.sectionTitle}>Leaderboard</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: theme.text3, fontSize: 12 }}>
              {leaderboardRows.length} players • Page {leaderboardPage + 1} of {totalPages || 1}
            </span>
            <button
              onClick={() => setLeaderboardPage(p => Math.max(0, p - 1))}
              disabled={leaderboardPage === 0}
              style={{ ...styles.btn, padding: '6px 10px', fontSize: 12, ...(leaderboardPage === 0 ? styles.disabled : {}) }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setLeaderboardPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={leaderboardPage >= totalPages - 1}
              style={{ ...styles.btn, padding: '6px 10px', fontSize: 12, ...(leaderboardPage >= totalPages - 1 ? styles.disabled : {}) }}
            >
              Next →
            </button>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>Player</th>
                <th style={styles.th}>Thru</th>
                <th style={styles.th}>Today</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Cut</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((e, idx) => {
                const position = leaderboardPage * ENTRIES_PER_PAGE + idx + 1
                return (
                  <tr key={e.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.dot(e.avatar_color)} />
                      <span style={{ fontWeight: 800 }}>{position}. {e.display_name}</span>
                      {e.is_human ? (
                        <span style={styles.pill}>
                          {e.country || '—'} • {e.handedness || 'R'}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdMuted }}>{thruDisplay(e, entryToGroup.get(e.id))}</td>
                    <td style={styles.td}>
                      <ScoreChip value={e.today_to_par ?? 0} />
                    </td>
                    <td style={styles.td}>
                      <ScoreChip value={e.total_to_par ?? 0} strong />
                    </td>
                    <td style={{ ...styles.td, ...styles.tdMuted }}>{e.cut ? 'CUT' : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT COLUMN: Everything else */}
      <div style={{ display: 'grid', gap: 4 }}>
          {humanGroupNotStarted && (
            <div style={{ 
              padding: 16, 
              borderRadius: 14, 
              background: theme.panel2, 
              border: `1px solid ${theme.border}`,
              textAlign: 'center',
            }}>
              <div style={{ marginBottom: 10, color: theme.text2 }}>
                Your group's tee time hasn't arrived yet.
              </div>
              <button
                onClick={simToTee}
                disabled={saving}
                style={{ ...styles.btnPrimary, ...(saving ? styles.disabled : null) }}
              >
                Sim to Tee Time
              </button>
            </div>
          )}

          <HoleControlPanel
            humans={humans}
            nextHole={nextHole}
            holeInfo={holeInfo}
            groupSize={featuredGroupSize}
            onSubmitManyAndAdvance={submitManyAndAdvance}
            disabled={saving}
          />

          <div style={styles.sectionTitle}>Group Scorecards</div>

          {humans.length ? (
            <GroupScorecards
              tournament={t}
              holes={course?.holes || []}
              round={t.current_round}
              currentHole={nextHole}
            />
          ) : (
            <div style={{ color: theme.text2 }}>No humans in this tournament.</div>
          )}

          {featuredGroup ? (
            <div style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <div>
                  <div style={{ fontWeight: 900, letterSpacing: -0.2 }}>On-course tracker</div>
                  <div style={{ marginTop: 4, color: theme.text2, fontSize: 13 }}>
                    Featured group • Tee <b style={{ color: theme.text }}>{fmtTime(featuredGroup.tee_time)}</b> • Next{' '}
                    <b style={{ color: theme.text }}>{fmtTime(featuredGroup.next_action_time)}</b> •{' '}
                    <span style={{ color: theme.text }}>{groupStatus(featuredGroup)}</span>
                  </div>
                </div>
                <div style={{ color: theme.text3, fontSize: 12 }}>
                  (showing first 8 tee times)
                </div>
              </div>

              <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                {(t.groups || [])
                  .slice()
                  .sort((a, b) => new Date(a.tee_time) - new Date(b.tee_time))
                  .slice(0, 8)
                  .map(g => (
                    <div
                      key={g.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 120px 1fr',
                        gap: 8,
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: `1px solid ${theme.border}`,
                        background: theme.panel2,
                      }}
                    >
                      <div style={{ color: theme.text2, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtTime(g.tee_time)}
                      </div>
                      <div style={{ fontWeight: 700 }}>{groupStatus(g)}</div>
                      <div style={{ color: theme.text2 }}>
                        {g.members?.map(m => m.entry?.display_name).filter(Boolean).join(', ')}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {/* Manual override cards (kept for debugging/testing) */}
          <details style={{ ...styles.card, padding: 12 }}>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
              Manual overrides <span style={{ color: theme.text3, fontSize: 12 }}>(advanced)</span>
            </summary>
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              {humans.map(h => (
                <HumanCard key={h.id} entry={h} onSubmit={submitScore} disabled={saving} />
              ))}
            </div>
          </details>
        </div>

        <div style={{ marginTop: 18, ...styles.small }}>
          Tip: if anything ever looks “blank”, it’s almost always default text color. In this file, every surface explicitly sets text colors to avoid that.
        </div>
      </div>
    </div>
      </div>
  )
}

/** ---------- components ---------- */

function GroupScorecards({ tournament, holes, round, currentHole }) {
  if (!holes?.length) {
    return <div style={{ color: theme.text2 }}>Course holes not loaded (scorecard hidden).</div>
  }

  // Find all groups with human players
  const humanGroups = (tournament?.groups || []).filter(g => 
    g.members?.some(m => m.entry?.is_human)
  )

  if (!humanGroups.length) {
    return <div style={{ color: theme.text2 }}>No human groups found.</div>
  }

  return (
    <>
      {humanGroups.map(group => (
        <GroupScorecard
          key={group.id}
          group={group}
          holes={holes}
          round={round}
          currentHole={currentHole}
        />
      ))}
    </>
  )
}

function GroupScorecard({ group, holes, round, currentHole }) {
  const holesSorted = [...holes].sort((a, b) => Number(a.number) - Number(b.number))
  const front9 = holesSorted.slice(0, 9)
  const back9 = holesSorted.slice(9, 18)
  
  const players = group.members?.map(m => m.entry).filter(Boolean) || []

  const renderNine = (nineHoles, label) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ 
        fontSize: 13, 
        fontWeight: 700, 
        color: theme.text2, 
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}>
        {label}
      </div>
      <div style={styles.tableWrap}>
        <table style={{ ...styles.table, width: '100%' }}>
          <thead>
            <tr style={styles.thRow}>
              <th style={{ ...styles.th, width: 140 }}>Player</th>
              {nineHoles.map(h => (
                <th key={h.number} style={{ ...styles.th, textAlign: 'center', width: 50 }}>
                  {h.number}
                </th>
              ))}
              <th style={{ ...styles.th, textAlign: 'center', width: 60 }}>Total</th>
            </tr>
            <tr style={{ background: theme.panel2 }}>
              <th style={{ ...styles.th, color: theme.text3, fontSize: 11 }}>Par</th>
              {nineHoles.map(h => (
                <th
                  key={h.number}
                  style={{
                    ...styles.th,
                    textAlign: 'center',
                    color: theme.text3,
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {h.par}
                </th>
              ))}
              <th style={{ ...styles.th, textAlign: 'center', color: theme.text3, fontWeight: 800 }}>
                {nineHoles.reduce((sum, h) => sum + h.par, 0)}
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map(player => {
              const strokesMap = strokesForEntryRound(player, round)
              const nineTotal = nineHoles.reduce((sum, h) => {
                const strokes = strokesMap.get(Number(h.number))
                return strokes ? sum + strokes : sum
              }, 0)
              
              return (
                <tr key={player.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: player.is_human ? 900 : 600 }}>
                    <span style={styles.dot(player.avatar_color)} />
                    {player.display_name}
                  </td>

                  {nineHoles.map(hole => {
                    const strokes = strokesMap.get(Number(hole.number))
                    const isCurrent = Number(hole.number) === Number(currentHole)
                    const toPar = strokes ? strokes - hole.par : null
                    
                    // Color coding: green for under par, red for over par
                    let bgColor = isCurrent ? 'rgba(96,165,250,0.12)' : undefined
                    if (strokes && !isCurrent) {
                      if (toPar < 0) bgColor = 'rgba(34,197,94,0.08)'
                      else if (toPar > 0) bgColor = 'rgba(239,68,68,0.08)'
                    }
                    
                    return (
                      <td
                        key={hole.number}
                        style={{
                          ...styles.td,
                          textAlign: 'center',
                          fontVariantNumeric: 'tabular-nums',
                          background: bgColor,
                          borderLeft: `1px solid ${theme.border}`,
                          fontWeight: isCurrent ? 900 : 700,
                          color: strokes ? theme.text : theme.text3,
                          fontSize: 14,
                        }}
                      >
                        {strokes ?? '—'}
                      </td>
                    )
                  })}
                  
                  <td style={{
                    ...styles.td,
                    textAlign: 'center',
                    fontWeight: 900,
                    borderLeft: `2px solid ${theme.border}`,
                    background: 'rgba(255,255,255,0.02)',
                    fontSize: 15,
                  }}>
                    {nineTotal || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div style={{
      ...styles.card,
      padding: 16,
    }}>
      <div style={{ 
        fontSize: 16, 
        fontWeight: 900, 
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Group • Tee {fmtTime(group.tee_time)}</span>
        <span style={{ fontSize: 13, color: theme.text2, fontWeight: 600 }}>
          {groupStatus(group)}
        </span>
      </div>
      {renderNine(front9, 'Front 9')}
      {renderNine(back9, 'Back 9')}
    </div>
  )
}

function ScoreChip({ value, strong = false }) {
  // subtle green for under par, subtle red for over par, neutral otherwise
  const v = Number(value || 0)
  const bg =
    v < 0 ? 'rgba(34,197,94,0.14)' :
    v > 0 ? 'rgba(239,68,68,0.14)' :
    'rgba(148,163,184,0.12)'

  const border =
    v < 0 ? 'rgba(34,197,94,0.30)' :
    v > 0 ? 'rgba(239,68,68,0.30)' :
    'rgba(148,163,184,0.22)'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 46,
        padding: '6px 10px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        fontWeight: strong ? 900 : 800,
        fontVariantNumeric: 'tabular-nums',
        color: theme.text,
      }}
    >
      {formatToPar(v)}
    </span>
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

  useEffect(() => {
    const init = {}
    for (const h of humans) init[h.id] = par
    setStrokesByEntryId(init)
  }, [nextHole, par, humans])

  return (
    <div style={styles.card}>
      <div style={styles.cardHeaderRow}>
        <div>
          <div style={{ fontWeight: 900, letterSpacing: -0.2 }}>Hole control</div>
          <div style={{ color: theme.text2, marginTop: 6, fontSize: 13 }}>
            {nextHole ? (
              <>Next hole <b style={{ color: theme.text }}>{nextHole}</b> {holeInfo ? `(Par ${holeInfo.par})` : `(Par ${par})`} • Group size {groupSize}</>
            ) : (
              <>No featured group found (add at least one human).</>
            )}
          </div>
        </div>

        {nextHole ? (
          <div style={{ color: theme.text3, fontSize: 12 }}>
            Defaults to par • Enter strokes per human
          </div>
        ) : null}
      </div>

      {nextHole ? (
        <>
          <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
            {humans.map(h => (
              <div
                key={h.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px',
                  gap: 12,
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid ${theme.border}`,
                  background: theme.panel2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: h.avatar_color || '#94A3B8',
                      boxShadow: '0 0 0 2px rgba(255,255,255,0.08)',
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 800 }}>{h.display_name}</div>
                    <div style={{ color: theme.text3, fontSize: 12 }}>
                      {h.country || '—'} • {h.handedness || 'R'}
                    </div>
                  </div>
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
                  style={{
                    padding: '10px 12px',
                    borderRadius: 14,
                    border: `1px solid ${theme.border2}`,
                    background: theme.panel,
                    color: theme.text,
                    outline: 'none',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    textAlign: 'center',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => onSubmitManyAndAdvance(strokesByEntryId, nextHole, par, groupSize)}
              disabled={disabled}
              style={{ ...styles.btnPrimary, ...(disabled ? styles.disabled : null) }}
            >
              Submit & Advance
            </button>

            <div style={{ color: theme.text3, fontSize: 12 }}>
              Time advances based on par + group size.
            </div>
          </div>
        </>
      ) : null}
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
    <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={styles.dot(entry.avatar_color)} />
          <div>
            <div style={{ fontWeight: 900 }}>{entry.display_name}</div>
            <div style={{ color: theme.text3, fontSize: 12 }}>
              {entry.country || '—'} • {entry.handedness || 'R'}
            </div>
          </div>
        </div>
        <div style={{ color: theme.text2, fontSize: 13 }}>
          Thru <b style={{ color: theme.text }}>{entry.thru_hole || 0}</b>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ color: theme.text2, fontSize: 12 }}>
          Hole
          <input
            type="number"
            min={1}
            max={18}
            value={hole}
            onChange={e => setHole(e.target.value)}
            style={{ marginLeft: 8, ...styles.input }}
          />
        </label>

        <label style={{ color: theme.text2, fontSize: 12 }}>
          Strokes
          <input
            type="number"
            min={1}
            max={15}
            value={strokes}
            onChange={e => setStrokes(e.target.value)}
            style={{ marginLeft: 8, ...styles.input }}
          />
        </label>

        <button
          onClick={() => onSubmit(entry.id, Number(hole), Number(strokes))}
          disabled={disabled}
          style={{ ...styles.btn, ...(disabled ? styles.disabled : null) }}
        >
          Submit
        </button>
      </div>
    </div>
  )
}

function HumanScorecardTable({ humans, holes, round, currentHole }) {
  if (!holes?.length) {
    return <div style={{ color: theme.text2 }}>Course holes not loaded (scorecard hidden).</div>
  }

  const holesSorted = [...holes].sort((a, b) => Number(a.number) - Number(b.number))

  return (
    <div style={styles.tableWrap}>
      <table style={{ ...styles.table, minWidth: 900 }}>
        <thead>
          <tr style={styles.thRow}>
            <th style={styles.th}>Player</th>
            {holesSorted.map(h => (
              <th key={h.number} style={{ ...styles.th, textAlign: 'center' }}>
                {h.number}
              </th>
            ))}
          </tr>
          <tr style={{ background: theme.panel2 }}>
            <th style={{ ...styles.th, color: theme.text3, borderBottom: `1px solid ${theme.border}` }}>Par</th>
            {holesSorted.map(h => (
              <th
                key={h.number}
                style={{
                  ...styles.th,
                  textAlign: 'center',
                  color: theme.text3,
                  fontWeight: 800,
                  borderBottom: `1px solid ${theme.border}`,
                }}
              >
                {h.par}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {humans.map(h => {
            const strokesMap = strokesForEntryRound(h, round)
            return (
              <tr key={h.id} style={styles.tr}>
                <td style={styles.td}>
                  <span style={styles.dot(h.avatar_color)} />
                  <span style={{ fontWeight: 900 }}>{h.display_name}</span>
                </td>

                {holesSorted.map(hole => {
                  const v = strokesMap.get(Number(hole.number))
                  const isCurrent = Number(hole.number) === Number(currentHole)
                  return (
                    <td
                      key={hole.number}
                      style={{
                        ...styles.td,
                        textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                        background: isCurrent ? 'rgba(96,165,250,0.12)' : undefined,
                        borderLeft: `1px solid ${theme.border}`,
                        fontWeight: isCurrent ? 900 : 700,
                        color: v ? theme.text : theme.text3,
                      }}
                    >
                      {v ?? '—'}
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
