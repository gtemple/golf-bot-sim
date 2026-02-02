import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TournamentListPage from './pages/TournamentListPage'
import CreateTournamentPage from './pages/CreateTournamentPage'
import TournamentPage from './pages/TournamentPage'
import RyderCupPage from './pages/RyderCupPage'
import HistoryPage from './pages/HistoryPage'
import SeasonHubPage from './pages/SeasonHubPage'
import CreateSeasonPage from './pages/CreateSeasonPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TournamentListPage />} />
        <Route path="/create" element={<CreateTournamentPage />} />
        <Route path="/season/create" element={<CreateSeasonPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/season/:id" element={<SeasonHubPage />} />
        <Route path="/tournaments/:id" element={<TournamentPage />} />
        <Route path="/t/:id" element={<TournamentPage />} />
        <Route path="/ryder/:id" element={<RyderCupPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
