import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Trophy,
  Users,
  Play,
  Target,
  ChevronUp,
  ChevronDown,
  Scissors,
  Clock,
} from 'lucide-react'
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
  const v = Number(n || 0)
  if (v === 0) return 'E'
  return v > 0 ? `+${v}` : `${v}`
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
    toPar += s - par
  }
  return toPar
}

const fmtTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const thruDisplay = (entry, group) => {
  const thru = entry.thru_hole || 0
  if (thru >= 18) return 'F'
  if (thru === 0 && group?.tee_time) return fmtTime(group.tee_time)
  return String(thru)
}

const groupStatus = (group) => {
  if (group.is_finished) return 'Finished'
  const hole = nextHoleForGroup(group)
  return `Playing ${hole}`
}

/** ---------- scorecard view ---------- */

function PlayerScorecard({ player, group, tournament, course, onBack }) {
  const holes = course?.holes || []
  const round = tournament?.current_round
  const parMap = useMemo(() => buildParMap(course), [course])

  const totalToPar = useMemo(
    () => entryToPar(player, parMap, null),
    [player, parMap]
  )
  const todayToPar = useMemo(
    () => entryToPar(player, parMap, round),
    [player, parMap, round]
  )
  
  const getScoreColor = (score) => {
    const v = Number(score || 0)
    if (v <= -5) return 'text-green-200'
    if (v < 0) return 'text-green-100'
    if (v === 0) return 'text-gray-100'
    return 'text-red-100'
  }

  if (!holes.length) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-4">
        <button
          onClick={onBack}
          className="mb-4 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          ← Back to Leaderboard
        </button>
        <div className="bg-white rounded-xl shadow-lg p-6 text-center text-gray-600">
          Course data not loaded
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-4">
      <button
        onClick={onBack}
        className="mb-4 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors shadow-sm"
      >
        ← Back to Leaderboard
      </button>

      {/* Player Info */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full"
              style={{ backgroundColor: player.avatar_color || '#94a3b8' }}
            />
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl font-bold text-white">{player.display_name}</h2>
                <span className={`text-xl font-bold ${getScoreColor(totalToPar)}`}>
                   {formatToPar(totalToPar)}
                </span>
              </div>
              <p className="text-sm text-green-100">
                {player.country || '—'} • {player.handedness || 'R'} • Round {round}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-600">Thru</p>
            <p className="text-2xl font-bold text-gray-900">{player.thru_hole || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Score Today</p>
            <p className="text-2xl font-bold text-gray-900">
               {formatToPar(todayToPar)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">
               {formatToPar(totalToPar)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Group</p>
            <p className="text-2xl font-bold text-gray-900">{group?.members?.length || 1}</p>
          </div>
        </div>
      </div>

      {/* Group Scorecards */}
      {group && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Playing Partners</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Player</th>
                  {holes.map(h => (
                    <th key={h.number} className="px-2 py-2 text-center text-xs font-semibold text-gray-700">
                      {h.number}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(group.members || []).map(member => (
                  <tr key={member.entry.id} className={member.entry.id === player.id ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: member.entry.avatar_color || '#94a3b8' }}
                        />
                        <span className={`${member.entry.id === player.id ? 'font-bold' : 'font-medium'} text-gray-900`}>
                          {member.entry.display_name}
                        </span>
                      </div>
                    </td>
                    {holes.map(h => {
                      const score = (member.entry.hole_results || []).find(
                        r => Number(r.hole_number) === Number(h.number) && Number(r.round_number) === Number(round)
                      )?.strokes
                      return (
                        <td key={h.number} className="px-2 py-3 text-center text-sm">
                          {score ? (
                            <span className={`font-semibold ${score === h.par ? 'text-gray-700 bg-gray-100' :
                                score < h.par ? 'text-green-700 bg-green-100' :
                                  'text-red-700 bg-red-100'
                              } px-2 py-1 rounded`}>
                              {score}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-2 py-3 text-center text-sm font-bold text-gray-900">
                      {(member.entry.hole_results || [])
                        .filter(r => Number(r.round_number) === Number(round))
                        .reduce((sum, r) => sum + r.strokes, 0) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** ---------- page ---------- */

export default function TournamentPage() {
  const { id } = useParams()
  const [t, setT] = useState(null)
  const [course, setCourse] = useState(null)
  const [err, setErr] = useState('')
  const [minutes, setMinutes] = useState(11)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [leaderboardPage, setLeaderboardPage] = useState(0)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const ENTRIES_PER_PAGE = 50

  const parMap = useMemo(() => buildParMap(course), [course])

  const humans = useMemo(() => (t?.entries || []).filter((e) => e.is_human), [t])

  const featuredGroup = useMemo(() => {
    if (!t?.groups?.length) return null
    return (
      t.groups.find((g) => (g.members || []).some((m) => m.entry?.is_human)) || null
    )
  }, [t])

  const nextHole = useMemo(
    () => (featuredGroup ? nextHoleForGroup(featuredGroup) : null),
    [featuredGroup]
  )

  const holeInfo = useMemo(() => {
    if (!course || !nextHole) return null
    return (course.holes || []).find((h) => Number(h.number) === Number(nextHole)) || null
  }, [course, nextHole])

  const featuredGroupSize = useMemo(
    () => featuredGroup?.members?.length || 4,
    [featuredGroup]
  )

  const humanGroupNotStarted = useMemo(() => {
    if (!featuredGroup || !t) return false
    if (featuredGroup.holes_completed > 0) return false
    
    // Check if any human has played holes
    const humanPlayed = humans.some((h) => (h.thru_hole || 0) > 0)
    if (humanPlayed) return false

    // If we haven't played, check if tee time has arrived
    if (t.current_time && featuredGroup.tee_time) {
      if (new Date(t.current_time) >= new Date(featuredGroup.tee_time)) {
        return false 
      }
    }
    
    return true
  }, [featuredGroup, t, humans])

  const humanGroupFinished = useMemo(() => {
    if (!featuredGroup || !t) return false
    // If playing holes are done (>= 18) OR status is finished
    return (featuredGroup.holes_completed || 0) >= 18 || t.status === 'finished'
  }, [featuredGroup, t])

  const entryToGroup = useMemo(() => {
    const map = new Map()
    if (!t?.groups) return map
    for (const group of t.groups) {
      for (const member of group.members || []) {
        if (member.entry?.id) map.set(member.entry.id, group)
      }
    }
    return map
  }, [t])

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null
    return (t?.entries || []).find((e) => e.id === selectedPlayerId)
  }, [t, selectedPlayerId])

  const selectedPlayerGroup = useMemo(() => {
    if (!selectedPlayerId) return null
    return entryToGroup.get(selectedPlayerId)
  }, [entryToGroup, selectedPlayerId])

  const leaderboardRows = useMemo(() => {
    const entries = t?.entries || []
    if (!entries.length) return []

    const rows = entries.map((e) => {
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
    // Old behavior: reset pagination when tournament changes
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

  useEffect(() => {
    load()
  }, [load])

  /** ---------- actions (OLD LOGIC: setT from API response) ---------- */

  const tick = useCallback(
    async (mins) => {
      setSaving(true)
      setErr('')
      try {
        const data = await api.tickTournament(id, Number(mins))
        setT(data)
        setStatusMsg('Time advanced!')
        setTimeout(() => setStatusMsg(''), 1200)
      } catch (e) {
        setErr(e.message || String(e))
      } finally {
        setSaving(false)
      }
    },
    [id]
  )

  const simToTee = useCallback(
    async () => {
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
    },
    [id]
  )

  const submitScore = useCallback(
    async (entryId, holeNumber, strokes) => {
      setSaving(true)
      setErr('')
      try {
        const data = await api.submitHoleResult(id, {
          entry_id: entryId,
          hole_number: Number(holeNumber),
          strokes: Number(strokes),
        })
        setT(data)
        setStatusMsg('Score saved ✓')
        setTimeout(() => setStatusMsg(''), 1000)
      } catch (e) {
        setErr(e.message || String(e))
      } finally {
        setSaving(false)
      }
    },
    [id]
  )

  const submitManyAndAdvance = useCallback(
    async (strokesByEntryId, holeNumber, defaultPar, groupSize) => {
      if (!holeNumber) return

      const missing = humans.filter((h) => !Number.isFinite(Number(strokesByEntryId[h.id])))
      if (missing.length) {
        setErr(`Missing score for: ${missing.map((m) => m.display_name).join(', ')}`)
        return
      }

      setSaving(true)
      setErr('')
      setStatusMsg(`Saving hole ${holeNumber}…`)
      try {
        for (const [entryIdStr, strokes] of Object.entries(strokesByEntryId)) {
          await api.submitHoleResult(id, {
            entry_id: Number(entryIdStr),
            hole_number: Number(holeNumber),
            strokes: Number(strokes),
          })
        }

        const par = Number(defaultPar || 4)
        const g = Number(groupSize || 4)

        // Preserve old time logic table
        const mins =
          g >= 4
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
    },
    [humans, id]
  )


  const simToEndOfDay = useCallback(async () => {
    setSaving(true)
    setErr('')
    setStatusMsg('Simulating end of day...')
    try {
      const data = await api.simToEndOfDay(id)
      setT(data)
      setStatusMsg('Round complete!')
      setTimeout(() => setStatusMsg(''), 1500)
    } catch (e) {
      setErr(e.message || String(e))
      setStatusMsg('')
    } finally {
      setSaving(false)
    }
  }, [id])

  if (!t) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex items-center justify-center">
        <div className="text-gray-700 text-lg">Loading tournament...</div>
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

        <div className="relative px-6 py-8 max-w-7xl mx-auto">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="w-8 h-8 text-yellow-400" />
                <h1 className="text-4xl font-bold">{t.name}</h1>
              </div>
              <div className="flex items-center gap-2 text-green-100 mb-4 flex-wrap">
                <span className="text-sm">Round {t.current_round}</span>
                <span className="text-green-400">•</span>
                <span className="text-sm">{course?.name || 'Loading...'}</span>
                <span className="text-green-400">•</span>
                <span className="text-sm">{fmtTime(t.current_time)}</span>
                {nextHole ? (
                  <>
                    <span className="text-green-400">•</span>
                    <span className="text-sm">
                      Next hole <b className="text-white">{nextHole}</b>
                      {holeInfo ? ` (Par ${holeInfo.par})` : ''}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap items-center">
              <Link
                to="/"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium text-white"
              >
                ← Back
              </Link>
              <input
                type="number"
                value={minutes}
                min={1}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-20 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                placeholder="mins"
              />
              <button
                onClick={() => tick(minutes)}
                disabled={saving}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-medium text-black"
                type="button"
              >
                <Clock className="w-4 h-4" />
                Advance {minutes}m
              </button>
              <button
                onClick={() => tick(11)}
                disabled={saving}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium text-black"
                type="button"
              >
                +11m
              </button>
              <button
                onClick={load}
                disabled={saving}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium text-black"
                type="button"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Projected Cut Line */}
          {t?.projected_cut && (
            <div className="mt-6 p-4 bg-yellow-500/20 rounded-lg border border-yellow-400/40 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <Scissors className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-yellow-100 mb-1">
                    Projected Cut Line {t.current_round === 1 ? '(after R1)' : '(36 holes)'}
                  </h3>
                  <p className="text-sm text-yellow-50">
                    <span className="font-bold text-lg">
                      {t.projected_cut.cut_to_par === 0
                        ? 'E'
                        : t.projected_cut.cut_to_par > 0
                          ? `+${t.projected_cut.cut_to_par}`
                          : t.projected_cut.cut_to_par}
                    </span>{' '}
                    <span className="text-yellow-200">
                      (Top {t.projected_cut.cut_position} + ties)
                    </span>
                    <span className="text-yellow-300 mx-2">•</span>
                    <span className="text-yellow-100">
                      {t.projected_cut.players_inside} inside, {t.projected_cut.players_at_line} at the
                      line
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {err && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {err}
          </div>
        </div>
      )}
      {statusMsg && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {statusMsg}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard */}
          <div className="lg:col-span-2">
            {selectedPlayer ? (
              <PlayerScorecard
                player={selectedPlayer}
                group={selectedPlayerGroup}
                tournament={t}
                course={course}
                onBack={() => setSelectedPlayerId(null)}
              />
            ) : (
              <Leaderboard
                rows={paginatedRows}
                totalCount={leaderboardRows.length}
                page={leaderboardPage}
                totalPages={totalPages}
                onPageChange={setLeaderboardPage}
                entryToGroup={entryToGroup}
                thruDisplay={thruDisplay}
                formatToPar={formatToPar}
                onPlayerClick={setSelectedPlayerId}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {humanGroupNotStarted ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 text-center">
                <p className="text-gray-600 mb-3">Your group's tee time hasn't arrived yet.</p>
                <button
                  onClick={simToTee}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                  type="button"
                >
                  Sim to Tee Time
                </button>
              </div>
            ) : humanGroupFinished ? (
              t.status === 'finished' ? (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 text-center">
                  <p className="text-gray-900 font-bold mb-1">Tournament Complete</p>
                  <p className="text-gray-600 text-sm">See leaderboard for final results.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 text-center">
                  <p className="text-gray-600 mb-3">Your round is complete.</p>
                  <button
                    onClick={simToEndOfDay}
                    disabled={saving}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                    type="button"
                  >
                    Sim Rest of Day
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Fast-forwards bot groups to finish the round.
                  </p>
                </div>
              )
            ) : (
              <HoleControlPanel
                humans={humans}
                nextHole={nextHole}
                holeInfo={holeInfo}
                groupSize={featuredGroupSize}
                onSubmitManyAndAdvance={submitManyAndAdvance}
                disabled={saving}
              />
            )}

            {humans.length > 0 && (
              <GroupScorecards
                tournament={t}
                holes={course?.holes || []}
                round={t.current_round}
                currentHole={nextHole}
              />
            )}

            {featuredGroup && (
              <OnCourseTracker
                tournament={t}
                featuredGroup={featuredGroup}
                course={course}
                onPlayerClick={setSelectedPlayerId}
              />
            )}

            {/* Manual Overrides */}
            {humans.length > 0 && (
              <details className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <span className="font-bold text-gray-900">Advanced Controls</span>
                </summary>
                <div className="p-4 space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-800 mb-2 font-medium">Controls</p>
                    <p className="text-xs text-blue-600">
                      Additional debug controls available here.
                    </p>
                  </div>

                  <hr className="border-gray-200" />
                  
                  <div>
                    <p className="text-sm text-gray-700 mb-2 font-medium">Manual Score Overrides</p>
                    <div className="space-y-3">
                      {humans.map((h) => (
                        <HumanCard key={h.id} entry={h} onSubmit={submitScore} disabled={saving} />
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** ---------- components ---------- */

function Leaderboard({
  rows,
  totalCount,
  page,
  totalPages,
  onPageChange,
  entryToGroup,
  thruDisplay,
  formatToPar,
  onPlayerClick,
}) {
  const getScoreColor = (score) => {
    const v = Number(score || 0)
    if (v <= -5) return 'text-green-600 bg-green-50'
    if (v <= -3) return 'text-green-700 bg-green-50'
    if (v < 0) return 'text-green-800 bg-green-50'
    if (v === 0) return 'text-gray-700 bg-gray-50'
    return 'text-red-700 bg-red-50'
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-green-900">Leaderboard</h2>
            <p className="text-sm text-green-700 mt-1">{totalCount} players</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-700 font-medium">
              Page {page + 1} of {totalPages || 1}
            </span>
            <button
              onClick={() => onPageChange((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm bg-white hover:bg-green-50 text-green-800 rounded-lg border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              type="button"
            >
              ← Prev
            </button>
            <button
              onClick={() => onPageChange((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm bg-white hover:bg-green-50 text-green-800 rounded-lg border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              type="button"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Pos
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Thru
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Today
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Cut
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((e, idx) => {
              const position = page * 50 + idx + 1
              return (
                <tr
                  key={e.id}
                  onClick={() => onPlayerClick && onPlayerClick(e.id)}
                  className={`hover:bg-green-50/50 transition-colors cursor-pointer ${position <= 3 ? 'bg-yellow-50/30' : ''
                    } ${e.is_human ? 'bg-blue-50/30' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${position === 1
                            ? 'text-yellow-600'
                            : position === 2
                              ? 'text-gray-500'
                              : position === 3
                                ? 'text-orange-600'
                                : 'text-gray-700'
                          }`}
                      >
                        {position}
                      </span>
                      {position <= 3 && (
                        <Trophy
                          className={`w-4 h-4 ${position === 1
                              ? 'text-yellow-500'
                              : position === 2
                                ? 'text-gray-400'
                                : 'text-orange-500'
                            }`}
                        />
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: e.avatar_color || '#94A3B8' }}
                      />
                      <span
                        className={`text-sm ${e.is_human ? 'font-bold' : 'font-medium'} text-gray-900`}
                      >
                        {e.display_name}
                      </span>
                      {e.is_human && (
                        <span className="text-xs text-gray-600">
                          {e.country || '—'} • {e.handedness || 'R'}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-700">
                      {thruDisplay(e, entryToGroup.get(e.id))}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(
                        e.today_to_par
                      )}`}
                    >
                      {formatToPar(e.today_to_par)}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(
                        e.total_to_par
                      )}`}
                    >
                      {formatToPar(e.total_to_par)}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-700">{e.cut ? 'CUT' : ''}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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

  useEffect(() => {
    const init = {}
    for (const h of humans) init[h.id] = par
    setStrokesByEntryId(init)
  }, [nextHole, par, humans])

  const increment = (entryId) => {
    setStrokesByEntryId((prev) => ({
      ...prev,
      [entryId]: Math.min(15, Number(prev[entryId] ?? par) + 1),
    }))
  }

  const decrement = (entryId) => {
    setStrokesByEntryId((prev) => ({
      ...prev,
      [entryId]: Math.max(1, Number(prev[entryId] ?? par) - 1),
    }))
  }

  if (!nextHole) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
        <p className="text-gray-600 text-center">No hole to play (add at least one human)</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-br from-green-600 to-green-700 px-5 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
            <Target className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-white text-lg">Hole Control</h3>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-green-50">
            Next hole <span className="font-bold text-white">{nextHole}</span> (Par {par}) • Group size{' '}
            {groupSize}
          </p>
          <span className="text-xs text-green-100 bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">
            Defaults to par
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {humans.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: player.avatar_color || '#10b981' }}
              />
              <div>
                <h4 className="font-bold text-gray-900">{player.display_name}</h4>
                <p className="text-xs text-gray-600">
                  {player.country || '—'} • {player.handedness || 'R'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => decrement(player.id)}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors text-gray-700 font-bold text-lg"
                type="button"
                aria-label="Decrease strokes"
              >
                ↓
              </button>

              <div className="w-12 h-10 flex items-center justify-center bg-white rounded-lg border-2 border-gray-300">
                <span className="text-gray-900 font-bold">
                  {strokesByEntryId[player.id] ?? par}
                </span>
              </div>

              <button
                onClick={() => increment(player.id)}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors text-gray-700 font-bold text-lg"
                type="button"
                aria-label="Increase strokes"
              >
                ↑
              </button>
            </div>

          </div>
        ))}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={() => onSubmitManyAndAdvance(strokesByEntryId, nextHole, par, groupSize)}
          disabled={disabled}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 "
          type="button"
        >
          <Play className="w-4 h-4" />
          <span>Submit &amp; Advance</span>
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Time advances based on par + group size
        </p>
      </div>
    </div>
  )
}

function GroupScorecards({ tournament, holes, round, currentHole }) {
  if (!holes?.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
        <p className="text-gray-600 text-center text-sm">Course holes not loaded</p>
      </div>
    )
  }

  const humanGroups = (tournament?.groups || []).filter((g) =>
    g.members?.some((m) => m.entry?.is_human)
  )

  if (!humanGroups.length) return null

  return (
    <>
      {humanGroups.map((group) => (
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
  const players = group.members?.map((m) => m.entry).filter(Boolean) || []
  
  // Need parMap to calc total score
  const parMap = useMemo(() => {
     const m = new Map()
     for (const h of holes || []) m.set(Number(h.number), Number(h.par))
     return m
  }, [holes])

  const renderNine = (nineHoles, label) => (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-2">{label}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-semibold text-gray-600">Player</th>
              {nineHoles.map((h) => (
                <th key={h.number} className="text-center py-2 px-1 font-semibold text-gray-900">
                  {h.number}
                </th>
              ))}
              <th className="text-center py-2 px-2 font-semibold text-gray-900 bg-gray-50">
                Total
              </th>
            </tr>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-2 px-2 text-gray-600">Par</th>
              {nineHoles.map((h) => (
                <th key={h.number} className="text-center py-2 px-1 font-bold text-gray-700">
                  {h.par}
                </th>
              ))}
              <th className="text-center py-2 px-2 font-bold text-gray-700 bg-gray-100">
                {nineHoles.reduce((sum, h) => sum + h.par, 0)}
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, idx) => {
              const strokesMap = strokesForEntryRound(player, round)
              const nineTotal = nineHoles.reduce((sum, h) => {
                const strokes = strokesMap.get(Number(h.number))
                return strokes ? sum + strokes : sum
              }, 0)

              return (
                <tr
                  key={player.id}
                  className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50/50' : ''}`}
                >
                  <td className={`py-2 px-2 ${player.is_human ? 'font-bold' : 'font-medium'} text-gray-900`}>
                    <div className="flex items-center gap-2">
                       <span className={`text-xs w-8 text-right ${
                          entryToPar(player, parMap, null) < 0 ? 'text-green-600 font-bold' : 
                          entryToPar(player, parMap, null) > 0 ? 'text-red-500' : 'text-gray-400'
                       }`}>
                          {formatToPar(entryToPar(player, parMap, null))}
                       </span>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: player.avatar_color || '#94A3B8' }}
                      />
                      {player.display_name}
                    </div>
                  </td>

                  {nineHoles.map((hole) => {
                    const strokes = strokesMap.get(Number(hole.number))
                    const isCurrent = Number(hole.number) === Number(currentHole)
                    const toPar = strokes ? strokes - hole.par : null

                    let bgColor = isCurrent ? 'bg-blue-100' : ''
                    let textColor = 'text-gray-600'
                    if (strokes && !isCurrent) {
                      if (toPar < 0) {
                        bgColor = 'bg-green-100'
                        textColor = 'text-green-700'
                      } else if (toPar > 0) {
                        bgColor = 'bg-red-100'
                        textColor = 'text-red-700'
                      }
                    }

                    return (
                      <td
                        key={hole.number}
                        className={`text-center py-2 px-1 font-medium ${bgColor} ${textColor}`}
                      >
                        {strokes ?? '—'}
                      </td>
                    )
                  })}

                  <td className="text-center py-2 px-2 font-bold text-gray-900 bg-gray-50">
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
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 py-3 border-b border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-green-900">Group Scorecard</h3>
          </div>
          <span className="text-xs text-green-700 font-medium">Tee {fmtTime(group.tee_time)}</span>
        </div>
      </div>

      <div className="p-4">
        {renderNine(front9, 'Front 9')}
        {renderNine(back9, 'Back 9')}
      </div>
    </div>
  )
}

function OnCourseTracker({ tournament, featuredGroup, course, onPlayerClick }) {
  const parMap = useMemo(() => course ? buildParMap(course) : new Map(), [course])

  const getScore = (entry) => {
    if (!entry) return 'E'
    const toPar = entryToPar(entry, parMap, null)
    return formatToPar(toPar)
  }

  const getScoreColor = (entry) => {
     if (!entry) return 'text-gray-500'
     const toPar = entryToPar(entry, parMap, null)
     if (toPar < 0) return 'text-green-700 font-bold'
     if (toPar > 0) return 'text-red-700 font-medium'
     return 'text-gray-600 font-medium'
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 py-3 border-b border-green-200">
        <h3 className="font-bold text-green-900">On-Course Tracker</h3>
        <p className="text-xs text-green-700 mt-1">
          Featured group • Tee {fmtTime(featuredGroup.tee_time)} • Next{' '}
          {fmtTime(featuredGroup.next_action_time)}
        </p>
      </div>

      <div className="p-4 space-y-3">
        {(tournament.groups || [])
          .slice()
          .sort((a, b) => new Date(a.tee_time) - new Date(b.tee_time))
          .slice(0, 8)
          .map((g) => (
            <div
              key={g.id}
              className="p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-700 font-bold bg-white px-2 py-1 rounded shadow-sm">
                  {fmtTime(g.tee_time)}
                </span>
                <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
                  {groupStatus(g)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {g.members?.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onPlayerClick && onPlayerClick(m.entry?.id)}
                    className="text-left text-xs text-gray-700 hover:text-green-700 hover:bg-white p-1 rounded transition-colors flex items-center gap-2 truncate w-full"
                  >
                   <div className="flex items-center gap-2 truncate">
                      <div 
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: m.entry?.avatar_color || '#94a3b8' }}
                      />
                      <span className="truncate text-gray-700 hover:text-green-700">{m.entry?.display_name}</span>
                   </div>
                   <span className={`text-xs ${getScoreColor(m.entry)}`}>
                      {getScore(m.entry)}
                   </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function HumanCard({ entry, onSubmit, disabled }) {
  const [hole, setHole] = useState(Math.max(1, (entry.thru_hole || 0) + 1))
  const [strokes, setStrokes] = useState(4)

  // OLD LOGIC: this worked before because submitHoleResult returned updated tournament (and updated thru_hole)
  useEffect(() => {
    setHole(Math.max(1, (entry.thru_hole || 0) + 1))
  }, [entry.thru_hole])

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: entry.avatar_color || '#94a3b8' }}
        />
        <span className="font-semibold text-gray-900">{entry.display_name}</span>
        <span className="text-xs text-gray-600">
          ({entry.country || 'N/A'}) {entry.handedness || 'Right'}
        </span>
      </div>

      <div className="text-xs text-gray-600 mb-2">Thru: {entry.thru_hole || 0}</div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-700">Hole:</label>
        <input
          type="number"
          min="1"
          max="18"
          value={hole}
          onChange={(e) => setHole(Number(e.target.value))}
          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
          disabled={disabled}
        />

        <label className="text-xs text-gray-700 ml-2">Strokes:</label>
        <input
          type="number"
          min="1"
          max="15"
          value={strokes}
          onChange={(e) => setStrokes(Number(e.target.value))}
          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
          disabled={disabled}
        />

        <button
          onClick={() => onSubmit(entry.id, Number(hole), Number(strokes))}
          disabled={disabled}
          className="ml-auto px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          {disabled ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
