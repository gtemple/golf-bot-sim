import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Users, Sliders, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { api } from '../api/client'

export default function CreateSeasonPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState([])
  
  // Form State
  const [name, setName] = useState('2026 Season')
  const [humans, setHumans] = useState([{ name: 'Player 1', country: 'USA' }])
  const [selectedCourseIds, setSelectedCourseIds] = useState([])
  const [fieldSettings, setFieldSettings] = useState({
      golfer_count: 70,
      field_type: 'top_ranked'
  })

  // Load courses
  useEffect(() => {
      api.listCourses().then(setCourses).catch(console.error)
  }, [])

  const handleAddHuman = () => {
      setHumans([...humans, { name: `Player ${humans.length + 1}`, country: 'USA' }])
  }

  const handleRemoveHuman = (idx) => {
      setHumans(humans.filter((_, i) => i !== idx))
  }

  const handleHumanChange = (idx, field, val) => {
      const newHumans = [...humans]
      newHumans[idx][field] = val
      setHumans(newHumans)
  }

  const toggleCourse = (id) => {
      if (selectedCourseIds.includes(id)) {
          setSelectedCourseIds(selectedCourseIds.filter(c => c !== id))
      } else {
          setSelectedCourseIds([...selectedCourseIds, id])
      }
  }

  const handleCreate = async () => {
      try {
          setLoading(true)
          const payload = {
              name,
              humans,
              course_ids: selectedCourseIds.length > 0 ? selectedCourseIds : undefined,
              golfer_count: fieldSettings.golfer_count,
              field_type: fieldSettings.field_type
          }
          
          const season = await api.createSeason(payload)
          navigate(`/season/${season.id}`)
      } catch (e) {
          alert("Failed to create season: " + e.message)
      } finally {
          setLoading(false)
      }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
                &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Create New Season</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
             
             {/* 1. Season Details */}
             <div className="p-6 border-b border-gray-100">
                 <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                     <Calendar className="text-blue-600" size={20}/> Season Details
                 </h3>
                 <div className="space-y-4">
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Season Name</label>
                         <input 
                            type="text" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                         />
                     </div>
                 </div>
             </div>

             {/* 2. Course Selection */}
             <div className="p-6 border-b border-gray-100">
                 <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                     <CheckCircle className="text-green-600" size={20}/> Course Selection
                 </h3>
                 <p className="text-sm text-gray-500 mb-4">
                     Select the courses for this season. If none selected, we'll randomize from all available.
                     Order determines the schedule.
                 </p>
                 
                 {courses.length === 0 ? (
                     <div className="text-gray-400 italic">Loading courses...</div>
                 ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {courses.map(c => {
                             const isSelected = selectedCourseIds.includes(c.id)
                             const order = selectedCourseIds.indexOf(c.id) + 1
                             return (
                                 <div 
                                    key={c.id}
                                    onClick={() => toggleCourse(c.id)}
                                    className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-200 hover:bg-white'}`}
                                 >
                                     <div>
                                         <div className="font-bold text-gray-800">{c.name}</div>
                                         <div className="text-xs text-gray-500">{c.location}</div>
                                     </div>
                                     {isSelected && (
                                         <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                             {order}
                                         </div>
                                     )}
                                 </div>
                             )
                         })}
                     </div>
                 )}
                 {selectedCourseIds.length > 0 && (
                     <div className="mt-2 text-right text-sm text-gray-600">
                         {selectedCourseIds.length} Events Scheduled
                     </div>
                 )}
             </div>

             {/* 3. Players */}
             <div className="p-6 border-b border-gray-100">
                 <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                     <Users className="text-purple-600" size={20}/> Human Players
                 </h3>
                 <div className="space-y-3">
                     {humans.map((h, i) => (
                         <div key={i} className="flex gap-3">
                             <input 
                                type="text"
                                value={h.name}
                                onChange={e => handleHumanChange(i, 'name', e.target.value)}
                                placeholder="Player Name"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                             />
                             <select
                                value={h.country}
                                onChange={e => handleHumanChange(i, 'country', e.target.value)}
                                className="w-24 px-2 py-2 border border-gray-300 rounded-lg"
                             >
                                 <option value="USA">USA</option>
                                 <option value="GBR">GBR</option>
                                 <option value="EUR">EUR</option>
                                 <option value="SWE">SWE</option>
                                 <option value="AUS">AUS</option>
                             </select>
                             {humans.length > 1 && (
                                 <button onClick={() => handleRemoveHuman(i)} className="text-red-400 hover:text-red-600">
                                     <Trash2 size={18}/>
                                 </button>
                             )}
                         </div>
                     ))}
                     <button onClick={handleAddHuman} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2">
                         <Plus size={16}/> Add Player
                     </button>
                 </div>
             </div>

             {/* 4. Field Settings */}
             <div className="p-6 bg-gray-50">
                 <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                     <Sliders className="text-orange-600" size={20}/> Field Settings
                 </h3>
                 <div className="grid grid-cols-2 gap-6">
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Field Size (Bots)</label>
                         <input 
                            type="number" 
                            min="10" 
                            max="156"
                            value={fieldSettings.golfer_count}
                            onChange={e => setFieldSettings({...fieldSettings, golfer_count: parseInt(e.target.value)})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                         />
                     </div>
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Field Strength</label>
                         <select 
                            value={fieldSettings.field_type}
                            onChange={e => setFieldSettings({...fieldSettings, field_type: e.target.value})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                         >
                             <option value="top_ranked">Top Ranked (PGA Tour)</option>
                             <option value="mixed">Mixed Field</option>
                             <option value="random">Random</option>
                         </select>
                     </div>
                 </div>
             </div>

             <div className="p-6 border-t border-gray-200 flex justify-end">
                 <button 
                    onClick={handleCreate}
                    disabled={loading}
                    className={`px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                     {loading ? 'Creating Season...' : 'Start Season'}
                 </button>
             </div>

        </div>
      </div>
    </div>
  )
}
