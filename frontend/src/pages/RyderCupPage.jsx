import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Trophy, ArrowLeft, Flag, Play, FastForward, Target, Clock, Activity, Shuffle } from 'lucide-react'
import { api } from '../api/client'

const fmtTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const groupStatus = (group) => {
  if (group.is_finished) return 'Finished'
  const hole = nextHoleForGroup(group)
  return `Playing ${hole}`
}

const getLastName = (name) => {
    if (!name) return ''
    const parts = name.trim().split(' ')
    return parts[parts.length - 1]
}

// Helper to determine match status from stroke data (SINGLES + FOURBALL)
// For Four-Ball, p1 and p2 can be arrays of players [Team1A, Team1B] vs [Team2A, Team2B]
function getMatchStatus(player1, player2, holes) {
    if (!player1 || !player2) return null
    
    // Normalize to arrays
    const p1Arr = Array.isArray(player1) ? player1 : [player1]
    const p2Arr = Array.isArray(player2) ? player2 : [player2]

    let p1Holes = 0
    let p2Holes = 0
    let thru = 0
    
    // Results Maps
    // For team, we need score for hole H to be min(Partner A, Partner B)
    
    // Helper to get score for side on a hole
    const getBestScore = (players, holeNum) => {
        let best = 999
        let recorded = false
        for (const p of players) {
             const res = p.hole_results?.find(r => r.hole_number === holeNum)
             if (res) {
                 recorded = true
                 if (res.strokes < best) best = res.strokes
             }
        }
        return recorded ? best : null
    }

    // Assumes single round match for now
    for (const hole of holes) {
        const s1 = getBestScore(p1Arr, hole.number)
        const s2 = getBestScore(p2Arr, hole.number)
        
        if (s1 && s2) {
            thru++
            if (s1 < s2) p1Holes++
            else if (s2 < s1) p2Holes++
        }
    }

    const diff = Math.abs(p1Holes - p2Holes)
    
    // Leader is a Team, not a player, if array
    // Just use first player's team
    const team1 = p1Arr[0]?.team
    const team2 = p2Arr[0]?.team
    
    const leaderTeam = p1Holes > p2Holes ? team1 : p2Holes > p1Holes ? team2 : null
    const color = leaderTeam === 'USA' ? 'text-red-700' : leaderTeam === 'EUR' ? 'text-blue-700' : 'text-gray-700'

    let statusText = 'All Square'
    let isFinished = false
    let isDormie = false

    const holesRemaining = 18 - thru

    if (diff > 0) {
        statusText = `${leaderTeam} ${diff} UP`
    }
    
    // Check if finished or dormie
    if (diff > holesRemaining) {
         statusText = `${leaderTeam} wins ${diff} & ${holesRemaining}`
         isFinished = true
    } else if (diff === holesRemaining && diff > 0) {
        statusText = "Dormie"
        isDormie = true
    } else if (holesRemaining === 0 && diff === 0) {
        statusText = "Halved"
        isFinished = true
    }

    // Return extended info for multiple players
    return { p1Holes, p2Holes, thru, statusText, leader: { team: leaderTeam }, color, isFinished, isDormie }
}

// --- Manual Hole Control (Adapted from TournamentPage) ---
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
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 mt-6">
          <p className="text-gray-600 text-center">No hole to play (Round Complete!)</p>
        </div>
      )
    }
  
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mt-6 mb-8 border-l-8 border-l-yellow-400">
        <div className="bg-gradient-to-br from-green-600 to-green-700 px-5 py-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-white text-lg">Your Turn To Play</h3>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-50">
              Next hole <span className="font-bold text-white">{nextHole}</span> (Par {par})
            </p>
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
                    {player.country || '—'} • {player.team}
                  </p>
                </div>
              </div>
  
              <div className="flex items-center gap-2">
                <button
                  onClick={() => decrement(player.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors text-gray-700 font-bold text-lg"
                  type="button"
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
            <span>Submit Stroke &amp; Update Match Status</span>
          </button>
        </div>
      </div>
    )
  }

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

// --- Scorecard Component ---
function MatchScorecard({ p1, p2, holes, round }) {
    
    const getScore = (entity, holeNum) => {
        if (Array.isArray(entity)) {
            const scores = entity.map(p => (p.hole_results || []).find(r => r.hole_number === holeNum)?.strokes).filter(s => s != null)
            return scores.length > 0 ? Math.min(...scores) : undefined
        }
        return (entity.hole_results || []).find(r => r.hole_number === holeNum)?.strokes
    }

    const getName = (entity) => Array.isArray(entity) ? entity.map(e => getLastName(e.display_name)).join(' / ') : entity.display_name
    
    let p1Wins = 0
    let p2Wins = 0
    
    const rows = holes.map(h => {
        const s1 = getScore(p1, h.number)
        const s2 = getScore(p2, h.number)
        
        let status = ""
        let winner = null
        
        if (s1 && s2) {
            if (s1 < s2) { p1Wins++; winner = 'p1' }
            else if (s2 < s1) { p2Wins++; winner = 'p2' }
            
            const diff = Math.abs(p1Wins - p2Wins)
            if (diff === 0) status = "AS"
            else status = `${p1Wins > p2Wins ? 'USA' : 'EUR'} ${diff} UP`
             
            // Check for dormie/win
            // (Simplified logc)
        }
        
        return { 
            hole: h.number, 
            par: h.par, 
            s1, 
            s2, 
            status, 
            winner 
        }
    })
    
    // Split into 9s or just one big table? One big table for match play is fine, usually landscape.
    // Let's do Front 9 / Back 9 stack
    const front9 = rows.slice(0, 9)
    const back9 = rows.slice(9, 18)
    
    const RenderNine = ({ data, title }) => (
       <div className="mb-4">
         <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">{title}</h4>
         <div className="overflow-x-auto">
         <table className="w-full text-sm border-collapse">
            <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-2 text-left w-20">Hole</th>
                    {data.map(d => <th key={d.hole} className="p-2 text-center w-8">{d.hole}</th>)}
                </tr>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                    <th className="p-2 text-left">Par</th>
                    {data.map(d => <th key={d.hole} className="p-2 text-center font-normal">{d.par}</th>)}
                </tr>
            </thead>
            <tbody>
                {/* P1 Row */}
                <tr className="border-b border-gray-100">
                    <td className="p-2 font-bold text-red-700 bg-red-50/20 text-xs">{getName(p1)}</td>
                    {data.map(d => (
                        <td key={d.hole} className={`p-2 text-center ${d.winner === 'p1' ? 'bg-red-100 font-bold text-red-700' : ''}`}>
                            {d.s1 || '-'}
                        </td>
                    ))}
                </tr>
                 {/* P2 Row */}
                <tr className="border-b border-gray-100">
                    <td className="p-2 font-bold text-blue-700 bg-blue-50/20 text-xs">{getName(p2)}</td>
                    {data.map(d => (
                        <td key={d.hole} className={`p-2 text-center ${d.winner === 'p2' ? 'bg-blue-100 font-bold text-blue-700' : ''}`}>
                            {d.s2 || '-'}
                        </td>
                    ))}
                </tr>
                {/* Status Row */}
                <tr className="bg-gray-50/50">
                     <td className="p-2 text-xs font-bold text-gray-400 italic">Match</td>
                     {data.map(d => (
                        <td key={d.hole} className="p-2 text-center text-[10px] font-bold text-gray-600">
                            {d.status}
                        </td>
                    ))}
                </tr>
            </tbody>
         </table>
         </div>
       </div>
    )

    return (
        <div className="bg-white p-4 border-t border-gray-100">
            <RenderNine data={front9} title="Front 9" />
            <RenderNine data={back9} title="Back 9" />
        </div>
    )
}

function EventFeed({ events }) {
  const [displayedEvents, setDisplayedEvents] = useState([])
  const prevEventsRef = useRef([])

  useEffect(() => {
    if (JSON.stringify(events) !== JSON.stringify(prevEventsRef.current)) {
      setDisplayedEvents(events)
      prevEventsRef.current = events
    }
  }, [events])

  if (!displayedEvents || displayedEvents.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-3 border-b border-purple-200 flex justify-between items-center">
        <h3 className="font-bold text-purple-900 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Event Feed
        </h3>
        <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-bold">Live</span>
      </div>
      <div className="divide-y divide-purple-50 max-h-60 overflow-y-auto">
        {displayedEvents.map((ev) => (
          <div key={ev.id} className="p-3 hover:bg-purple-50 transition-colors">
            <div className="flex justify-between items-start">
               <p className="text-sm text-gray-800 leading-tight">
                {ev.text}
              </p>
              <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
              </span>
            </div>
             {ev.importance >= 3 && (
                <span className="inline-block mt-1 text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold border border-yellow-200">
                  HIGHLIGHT
                </span>
             )}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Victory Modal ---
function VictoryModal({ usaScore, eurScore, totalPoints, isFinished }) {
    const winningScore = totalPoints / 2
    let winner = null
    
    // Check for mathematical clinch or finish
    if (isFinished) {
        if (usaScore > eurScore) winner = 'USA'
        else if (eurScore > usaScore) winner = 'Europe'
        else winner = 'Draw'
    } else {
        // Clinch logic (if points remaining < deficit)
        // Simplified: just check if crossed threshold
        // Total points = 18. Win = 9.5
        // If score >= 9.5, they win
        const threshold = (totalPoints / 2) + 0.5
        if (usaScore >= threshold) winner = 'USA'
        else if (eurScore >= threshold) winner = 'Europe'
    }

    if (!winner) return null

    const isUsa = winner === 'USA'
    const isEur = winner === 'Europe'
    const isDraw = winner === 'Draw'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-1000">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform scale-100 animate-in zoom-in-95 duration-500">
                 {/* Header */}
                 <div className={`py-12 px-6 text-center text-white ${isUsa ? 'bg-red-700' : isEur ? 'bg-blue-700' : 'bg-slate-800'}`}>
                     <Trophy className="w-24 h-24 mx-auto mb-4 text-yellow-400 drop-shadow-lg" />
                     <h2 className="text-4xl font-black uppercase tracking-widest mb-2 shadow-black drop-shadow-md">
                        {isDraw ? 'Retained!' : 'Victory!'}
                     </h2>
                     <p className="text-xl font-serif italic text-white/90">
                        {isDraw ? 'The Cup is Halved' : `Team ${winner} wins the Cup`}
                     </p>
                 </div>
                 
                 {/* Score */}
                 <div className="py-8 px-6 text-center">
                     <div className="flex items-center justify-center gap-8 mb-6">
                        <div className="text-center">
                             <div className="text-4xl font-bold text-red-700 tabular-nums">{usaScore}</div>
                             <div className="text-xs font-bold text-slate-400 tracking-wider">USA</div>
                        </div>
                        <div className="text-center">
                             <div className="text-4xl font-bold text-blue-700 tabular-nums">{eurScore}</div>
                             <div className="text-xs font-bold text-slate-400 tracking-wider">EUR</div>
                        </div>
                     </div>
                     
                     <div className="border-t border-slate-100 pt-6">
                        <p className="text-slate-500 text-sm mb-6">
                            {isDraw 
                                ? "With the match drawn, the previous holders retain the trophy." 
                                : `A dominant performance by the ${winner} squad secures the title.`}
                        </p>
                        
                        <Link 
                            to="/" 
                            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Return to Clubhouse
                        </Link>
                     </div>
                 </div>
            </div>
        </div>
    )
}

function RyderCourseTracker({ tournament, matches, featuredGroup }) {
  const groups = (tournament.groups || []).slice().sort((a,b) => new Date(a.tee_time) - new Date(b.tee_time))
  
  const getName = (p) => Array.isArray(p) ? p.map(x => getLastName(x.display_name)).join(' / ') : (p?.display_name || '?')

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 py-3 border-b border-green-200">
        <h3 className="font-bold text-green-900 flex items-center gap-2">
            <Flag className="w-4 h-4" />
            On-Course Tracker
        </h3>
      </div>

      <div className="p-4 space-y-3">
        {groups.map((g) => {
            const match = matches.find(m => m.group.id === g.id)
            const isFeatured = featuredGroup && g.id === featuredGroup.id
            
            return (
            <div
              key={g.id}
              className={`bg-white rounded-lg border ${isFeatured ? 'border-yellow-300 ring-2 ring-yellow-100' : 'border-gray-100'} shadow-sm overflow-hidden`}
            >
              <div className="px-3 py-2 bg-gray-50/50 flex items-center justify-between border-b border-gray-100">
                <span className="text-xs text-gray-600 font-medium font-mono">
                  {fmtTime(g.tee_time)}
                </span>
                <div className="flex items-center gap-2">
                    {match && (
                        <span className={`text-[10px] font-bold uppercase tracking-tight ${match.status.color}`}>
                            {match.status.statusText}
                        </span>
                    )}
                    <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                    {groupStatus(g)}
                    </span>
                </div>
              </div>
              <div className="p-2">
                 <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700">{getName(match?.p1)}</span>
                    <span className="text-slate-400">USA</span>
                 </div>
                 <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{getName(match?.p2)}</span>
                    <span className="text-slate-400">EUR</span>
                 </div>
              </div>
            </div>
          )})}
          {groups.length === 0 && <div className="text-center text-gray-400 text-sm py-2">No groups on course</div>}
      </div>
    </div>
  )
}

export default function RyderCupPage() {
  const { id } = useParams()
  const [tournament, setTournament] = useState(null)
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [saving, setSaving] = useState(false)

  const [expandedMatchId, setExpandedMatchId] = useState(null)
  
  const load = useCallback(async () => {
    try {
      const data = await api.getTournament(id)
      setTournament(data)
      if (data.course) {
        const c = await api.getCourse(data.course)
        setCourse(c)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])
  
  const tick = async () => {
      setSimulating(true)
      try {
          await api.tickTournament(id, 15) // Advance 15 mins
          await load()
      } finally {
          setSimulating(false)
      }
  }

  const submitManyAndAdvance = useCallback(
    async (strokesByEntryId, holeNumber, defaultPar, groupSize) => {
      if (!holeNumber) return

      setSaving(true)
      try {
        for (const [entryIdStr, strokes] of Object.entries(strokesByEntryId)) {
          await api.submitHoleResult(id, {
            entry_id: Number(entryIdStr),
            hole_number: Number(holeNumber),
            strokes: Number(strokes),
          })
        }

        // Just tick match forward slightly
        const mins = 14
        await api.tickTournament(id, mins)
        await load()

      } catch (e) {
        console.error(e)
        alert(e.message || String(e))
      } finally {
        setSaving(false)
      }
    },
    [id, load]
  )


  const usaPlayers = useMemo(() => (tournament?.entries?.filter(e => e.team === 'USA') || []).sort((a,b) => a.id - b.id), [tournament])
  const eurPlayers = useMemo(() => (tournament?.entries?.filter(e => e.team === 'EUR') || []).sort((a,b) => a.id - b.id), [tournament])

  // Identify Human Group for controls
  const humans = useMemo(() => (tournament?.entries || []).filter((e) => e.is_human), [tournament])
  const featuredGroup = useMemo(() => {
    if (!tournament?.groups?.length) return null
    return (
      tournament.groups.find((g) => (g.members || []).some((m) => m.entry?.is_human)) || null
    )
  }, [tournament])

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
    if (!featuredGroup || !tournament) return false
    if (featuredGroup.holes_completed > 0) return false
    const humanPlayed = humans.some((h) => (h.thru_hole || 0) > 0)
    if (humanPlayed) return false
    if (tournament.current_time && featuredGroup.tee_time) {
      if (new Date(tournament.current_time) >= new Date(featuredGroup.tee_time)) {
        return false 
      }
    }
    return true
  }, [featuredGroup, tournament, humans])


  const { matches, usaScore, eurScore, history } = useMemo(() => {
    if (!tournament) return { matches: [], usaScore: 0, eurScore: 0, history: [] }

    // Need holes to calc match status
    const holes = course?.holes || Array.from({length: 18}, (_,i) => ({ number: i+1 })) 
    
    const m = []
    let u = 0
    let e = 0
    
    // Add history from prior rounds
    const sh = tournament.session_history || {}
    const historyList = []
    
    Object.keys(sh).sort().forEach(roundKey => {
         const results = sh[roundKey]
         results.forEach(r => {
             if (r.winner === 'USA') u += 1
             else if (r.winner === 'EUR') e += 1
             else { u += 0.5; e += 0.5 }
         })
         historyList.push({ round: roundKey, matches: results })
    })

    // Build matches from physical Groups (ensures On-Course Tracker matches the Match List)
    const groups = (tournament?.groups || []).slice().sort((a,b) => new Date(a.tee_time) - new Date(b.tee_time))

    groups.forEach((g) => {
        const members = g.members || []
        
        let p1, p2
        
        if (members.length === 2) {
             // Singles
            const m1 = members[0]?.entry
            const m2 = members[1]?.entry
            
            p1 = m1.team === 'USA' ? m1 : m2
            p2 = m1.team === 'USA' ? m2 : m1
        } else if (members.length === 4) {
             // Four-Ball
            // Assume [USA, USA, EUR, EUR] ordering from serializer?
            // Safer to sort by team
            const usa = members.map(m => m.entry).filter(e => e.team === 'USA')
            const eur = members.map(m => m.entry).filter(e => e.team !== 'USA')
            
            p1 = usa // Array of 2
            p2 = eur // Array of 2
        } else {
            return
        }

        const status = getMatchStatus(p1, p2, holes)
        
        // Is this the human match?
        const isHumanMatch = (Array.isArray(p1) ? p1 : [p1]).some(e => e.is_human) || 
                             (Array.isArray(p2) ? p2 : [p2]).some(e => e.is_human)
        
        if (status) {
            // Live projected score: Win: 1 pt. Draw: 0.5 pt
            if (status.leader?.team === 'USA') u += 1
            else if (status.leader?.team === 'EUR') e += 1
            else { u += 0.5; e += 0.5 }
            
            m.push({ id: g.id, p1, p2, status, isHumanMatch, group: g })
        }
    })
    
    return { matches: m, usaScore: u, eurScore: e, history: historyList }
  }, [tournament, course])

  if (loading) return <div className="p-10 text-center">Loading Cup Mode...</div>
  if (!tournament) return <div className="p-10 text-center">Tournament not found</div>

  const simToTee = async () => {
    setSaving(true)
    try {
        await api.simToTee(id)
        await load()
    } finally {
        setSaving(false)
    }
  }

  const shufflePairings = async () => {
      if (!confirm("Are you sure you want to shuffle all match pairings? This will reorganize the entire field.")) return
      setSaving(true)
      try {
          await api.shufflePairings(id)
          await load()
          setExpandedMatchId(null) // Reset view
      } catch (e) {
          alert('Cannot shuffle: ' + e.message)
      } finally {
          setSaving(false)
      }
  }

  const matchesNotStarted = matches.every(m => m.status.thru === 0)

  // Assumption: 6 matches (4-ball) + 12 matches (singles) = 18 pts
  // But wait, if we only do singles (for testing) it's 12 pts.
  // Let's assume 18 total for now if history exists
  const totalPoints = (history?.length > 0) ? 18 : 12

  return (
    <div className="min-h-screen bg-slate-50">
        <VictoryModal 
            usaScore={usaScore} 
            eurScore={eurScore} 
            totalPoints={totalPoints}
            isFinished={tournament.status === 'finished'}
        />

        {/* Header */}
        <div className="bg-slate-900 text-white py-6 px-4 shadow-xl sticky top-0 z-10">
             <div className="max-w-6xl mx-auto flex items-center justify-between">
                 <div className="flex items-center gap-4">
                     <Link to="/" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                     </Link>
                     <div>
                         <h1 className="text-3xl font-bold font-serif tracking-wider text-yellow-500 flex items-center gap-2">
                             <Trophy className="w-8 h-8" /> 
                             RYDER CUP MODE
                         </h1>
                         <p className="text-slate-400 text-sm tracking-widest uppercase">{tournament.name}</p>
                     </div>
                 </div>
                 
                 {/* Sim Controls */}
                 <div className="flex items-center gap-2">
                     {matchesNotStarted && (
                       <button
                         onClick={shufflePairings}
                         disabled={saving}
                         title="Strategy Shuffle: Randomize Matchups"
                         className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors"
                       >
                         <Shuffle className="w-4 h-4" />
                         Shuffle Pairings
                       </button>
                     )}
                     <button 
                        onClick={tick}
                        disabled={simulating || tournament.status === 'finished'}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                        <Play className="w-4 h-4" />
                        {tournament.status === 'in_progress' ? 'Next 15m' : 'Start Session'}
                     </button>
                 </div>

                 <div className="flex items-center gap-8 bg-slate-800 px-8 py-3 rounded-xl border border-slate-700">
                     <div className="text-center">
                         <h2 className="text-5xl font-bold text-red-500 tabular-nums">{usaScore}</h2>
                         <span className="text-xs font-bold tracking-widest text-slate-400">USA (Proj)</span>
                     </div>
                     <div className="text-2xl text-slate-600 font-serif italic pt-2">vs</div>
                     <div className="text-center">
                         <h2 className="text-5xl font-bold text-blue-400 tabular-nums">{eurScore}</h2>
                         <span className="text-xs font-bold tracking-widest text-slate-400">EUR (Proj)</span>
                     </div>
                 </div>
             </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
            
            {/* Playing Controls */}
            {humanGroupNotStarted ? (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to Start?</h3>
                    <p className="text-gray-600 mb-6">Your tee time is upcoming. Simulate until you are on the tee.</p>
                    <button
                        onClick={simToTee}
                        disabled={saving}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 text-lg shadow-lg shadow-green-600/20"
                    >
                        Jump to Tee Time
                    </button>
                </div>
            ) : nextHole ? (
                <HoleControlPanel
                    humans={humans}
                    nextHole={nextHole}
                    holeInfo={holeInfo}
                    groupSize={featuredGroupSize}
                    onSubmitManyAndAdvance={submitManyAndAdvance}
                    disabled={saving}
                />
            ) : null}


            {/* History Section for Multi-Day Events */}
            {(history.length > 0) && (
             <div className="space-y-4 mb-8">
                {history.map((h) => (
                   <div key={h.round} className="bg-slate-50 rounded-xl shadow-inner border border-slate-200 p-6">
                       <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2 uppercase tracking-widest border-b border-slate-200 pb-2">
                           <Clock className="w-4 h-4 text-slate-400" />
                           Completed Session: {h.round}
                       </h3>
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                           {h.matches.map((m, i) => (
                               <div key={i} className="bg-white p-3 rounded shadow-sm border border-slate-200 text-sm flex justify-between items-center">
                                   <div className={`font-bold flex-1 ${m.winner === 'USA' ? 'text-red-700' : 'text-slate-400'}`}>
                                        {m.usa_names.map(getLastName).join(' / ')}
                                   </div>
                                   <div className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded text-xs uppercase mx-4">
                                       {m.score}
                                   </div>
                                   <div className={`font-bold flex-1 text-right ${m.winner === 'EUR' ? 'text-blue-700' : 'text-slate-400'}`}>
                                        {m.eur_names.map(getLastName).join(' / ')}
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
                ))}
             </div>
            )}

            {matches.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                     <div className="inline-block p-4 bg-slate-100 rounded-full mb-4">
                        <Flag className="w-8 h-8 text-slate-400" />
                     </div>
                     <h3 className="text-xl font-bold text-slate-800 mb-2">Waiting for Pairings</h3>
                     <p className="text-slate-500">
                        Add players to both USA and EUR teams to generate matches.
                     </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {usaPlayers.length !== eurPlayers.length && (
                         <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg flex items-center gap-2">
                            <span className="font-bold">Team Imbalance detected:</span> 
                            USA ({usaPlayers.length}) vs EUR ({eurPlayers.length}). Some players may not have a match.
                         </div>
                    )}
                    {matches.map(m => (
                        <div key={m.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col ${m.isHumanMatch ? 'ring-4 ring-yellow-400 border-yellow-400 transform scale-[1.02] shadow-xl z-10' : 'border-slate-200'}`}>
                            
                            {/* Summary Bar */}
                            <div 
                                onClick={() => setExpandedMatchId(expandedMatchId === m.id ? null : m.id)}
                                className="flex flex-col md:flex-row items-stretch cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                                {/* Player 1 (USA) */}
                                <div className="flex-1 p-4 flex items-center gap-4 bg-gradient-to-r from-white to-red-50/30 border-r border-slate-100">
                                    {/* Avatar(s) */}
                                    <div className="flex -space-x-3">
                                        {(Array.isArray(m.p1) ? m.p1 : [m.p1]).map((p, i) => (
                                            <div key={i} className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-white relative z-10" style={{backgroundColor: p.avatar_color || '#ef4444'}}>
                                                {p.display_name.charAt(0)}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-900 text-lg flex flex-wrap items-center gap-2">
                                            {Array.isArray(m.p1) ? m.p1.map(p => getLastName(p.display_name)).join(' / ') : m.p1.display_name}
                                            {m.isHumanMatch && <span className="bg-yellow-400 text-yellow-900 text-[10px] px-1.5 py-0.5 rounded font-bold">YOU</span>}
                                        </div>
                                        <div className="text-xs font-bold text-slate-400 tracking-wider">USA</div>
                                    </div>
                                    {(m.status.leader?.team === 'USA' || (m.status.leader === null && m.status.thru === 18 && m.status.p1Holes === m.status.p2Holes)) && (
                                        <div className="hidden sm:block text-green-600 font-bold whitespace-nowrap">{m.status.statusText}</div>
                                    )}
                                </div>

                                {/* Match Status */}
                                <div className="w-48 flex flex-col items-center justify-center border-x border-slate-200 py-4 px-2 bg-slate-50/50">
                                    <span className={`text-xl font-black ${m.status.color || 'text-gray-800'} uppercase tracking-tight`}>
                                        {m.status.statusText}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">
                                        Thru {m.status.thru}
                                    </span>
                                    <span className="text-[10px] text-slate-300 mt-1">
                                        {expandedMatchId === m.id ? 'Click to collapse' : 'Click for scorecard'}
                                    </span>
                                </div>

                                {/* Player 2 (EUR) */}
                                <div className="flex-1 p-4 flex items-center justify-end gap-4 bg-gradient-to-l from-white to-blue-50/30 border-l border-slate-100 text-right">
                                    {(m.status.leader?.team === 'EUR') && (
                                        <div className="hidden sm:block text-green-600 font-bold whitespace-nowrap">{m.status.statusText}</div>
                                    )}
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-900 text-lg">
                                            {Array.isArray(m.p2) ? m.p2.map(p => getLastName(p.display_name)).join(' / ') : m.p2.display_name}
                                        </div>
                                        <div className="text-xs font-bold text-slate-400 tracking-wider">EUROPE</div>
                                    </div>
                                    {/* Avatar(s) */}
                                    <div className="flex -space-x-3 flex-row-reverse">
                                        {(Array.isArray(m.p2) ? m.p2 : [m.p2]).map((p, i) => (
                                            <div key={i} className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-white relative z-10" style={{backgroundColor: p.avatar_color || '#3b82f6'}}>
                                                {p.display_name.charAt(0)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Scorecard */}
                             {expandedMatchId === m.id && (
                                <MatchScorecard 
                                    p1={m.p1} 
                                    p2={m.p2} 
                                    holes={course?.holes || []} 
                                    round={tournament.current_round}
                                />
                             )}
                        </div>
                    ))}
                </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
              <EventFeed events={tournament.recent_events} />
              <RyderCourseTracker tournament={tournament} matches={matches} featuredGroup={featuredGroup} />
          </div>

        </div>
    </div>
  )
}
