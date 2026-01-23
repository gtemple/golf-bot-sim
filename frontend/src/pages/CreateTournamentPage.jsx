import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Trophy, Users, Calendar, Target, Plus, Trash2, ArrowLeft, Flag } from 'lucide-react'
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
  const [fieldType, setFieldType] = useState('top_ranked')
  const [format, setFormat] = useState('stroke')

  const [humans, setHumans] = useState([
    { name: 'Giordano', country: 'CAN', team: 'EUR', handedness: 'L', avatar_color: '#3B82F6' }
  ])
  const avatarColors = ['#3B82F6', '#22C55E', '#F97316', '#A855F7', '#EF4444', '#14B8A6', '#64748B']

  useEffect(() => {
     if (format.startsWith('match')) {
         // Ryder Cup Reality: 12 vs 12 = 24 total players.
         // Minus the humans we are adding.
         // Actually, let's just ask for 24 bots and we'll have extras or the backend can handle it.
         // If we want EXACTLY 24 total entries (humans + bots):
         // setGolferCount(Math.max(0, 24 - humans.length))
         // But simplify: standard Ryder Cup is 24 players.
         // Let's set bot count to (24 - humans)
         setGolferCount(Math.max(0, 24 - humans.length))
     }
  }, [format, humans.length])

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

  const addHuman = () => {
    if (format.startsWith('match') && humans.length >= 24) {
        return; // Fixed roster size
    }
    setHumans(h => [...h, { name: '', country: 'CAN', team: 'EUR', handedness: 'R', avatar_color: avatarColors[0] }])
  }

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
        format,
        golfer_count: Number(golferCount),
        field_type: fieldType,
        humans: cleanHumans.map(h => ({
          name: h.name,
          country: h.country,
          team: h.team,
          handedness: h.handedness,
          avatar_color: h.avatar_color,
        }))
      }

      const t = await api.createTournament(payload)
      navigate(t.format === 'match' ? `/ryder/${t.id}` : `/t/${t.id}`)
    } catch (e2) {
      setErr(e2.message || String(e2))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex items-center justify-center">
        <div className="text-gray-700 text-lg font-medium">Loading resources...</div>
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
          <div className="flex items-center gap-4 mb-6">
            <Link
              to="/"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold">New Tournament</h1>
          </div>
          <p className="text-green-100 max-w-2xl text-lg">
            Configure your event, select the field, and add human players.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Main Settings */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-green-700" />
                Tournament Settings
              </h3>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  placeholder="e.g. The Masters"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Game Format</label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                >
                  <option value="stroke">Stroke Play (Standard)</option>
                  <option value="match_fourball">Ryder Cup Mode (2-Day/Match Play)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Course</label>
                <select
                  value={courseId}
                  onChange={e => setCourseId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.location ? ` — ${c.location}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bot Field Size</label>
                <input
                  type="number"
                  min={0}
                  max={golfers.length}
                  value={golferCount}
                  onChange={e => setGolferCount(Number(e.target.value))}
                  disabled={format.startsWith('match')} 
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all ${format.startsWith('match') ? 'bg-gray-100 text-gray-500' : ''}`}
                />
                <p className="text-xs text-gray-500 mt-1">
                    {format.startsWith('match') ? 'Fixed for Ryder Cup (Total 24 players)' : `Total available bots: ${golfers.length}`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Field Strength</label>
                <select
                  value={fieldType}
                  onChange={e => setFieldType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                >
                  <option value="top_ranked">Top Ranked (Elite Field)</option>
                  <option value="amateur">Amateur (Weakest Players)</option>
                  <option value="random">Random Selection</option>
                  <option value="mixed">Mixed Field (Realistic)</option>
                  <option value="mid_tier">Mid-Tier (Average Skill)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Human Players */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-700" />
                Human Players
              </h3>
              <button
                type="button"
                onClick={addHuman}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-black rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Player
              </button>
            </div>

            <div className="p-6 space-y-4">
              {humans.map((h, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 rounded-xl border border-gray-200 p-4 transition-all hover:shadow-sm"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    {/* Row 1 */}
                    <div className={format.startsWith('match') ? "md:col-span-4" : "md:col-span-6"}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
                      <input
                        placeholder="Player Name"
                        value={h.name}
                        onChange={e => updateHuman(idx, { name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      />
                    </div>

                    {format.startsWith('match') && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Team</label>
                        <select
                          value={h.team || 'USA'}
                          onChange={e => updateHuman(idx, { team: e.target.value })}
                          className="w-full px-3 py-2 border border-blue-300 bg-blue-50/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-gray-800"
                        >
                          <option value="USA">USA</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    )}

                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Country</label>
                      <select
                        value={h.country}
                        onChange={e => updateHuman(idx, { country: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      >
                        {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Hand</label>
                      <select
                        value={h.handedness}
                        onChange={e => updateHuman(idx, { handedness: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      >
                        <option value="R">Right</option>
                        <option value="L">Left</option>
                      </select>
                    </div>

                    <div className="md:col-span-1 flex justify-end md:pt-6">
                      <button
                        type="button"
                        onClick={() => removeHuman(idx)}
                        disabled={humans.length <= 1}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Remove player"
                        title={humans.length <= 1 ? "At least one player required" : "Remove player"}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Row 2 (full width on md+) */}
                    <div className="md:col-span-12">
                      <label className="block text-xs py-1 font-semibold text-gray-500 mb-1">Avatar Color</label>

                      {/* Responsive wrapping grid */}
                      <div className="grid grid-cols-7 sm:grid-cols-7 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                        {avatarColors.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateHuman(idx, { avatar_color: c })}
                            className={[
                              "w-8 h-8 rounded-full",
                              "border border-gray-200",
                              "transition-transform hover:scale-110",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2",
                              c === h.avatar_color
                                ? "ring-2 ring-green-600 ring-offset-2 ring-offset-gray-50"
                                : "ring-0"
                            ].join(" ")}
                            style={{ backgroundColor: c }}
                            aria-label={`Set avatar color ${c}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-black font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all hover:transform hover:scale-105"
            >
              Create Tournament
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
