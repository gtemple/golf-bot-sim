const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'

async function apiFetch(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`)
  }

  return res.json()
}

export const api = {
  listCourses: () => apiFetch('/courses/'),
  getCourse: (id) => apiFetch(`/courses/${id}/`),
  listGolfers: () => apiFetch('/golfers/'),
  listTournaments: () => apiFetch('/tournaments/'),
  createTournament: (payload) => apiFetch('/tournaments/', { method: 'POST', body: payload }),
  getTournament: (id) => apiFetch(`/tournaments/${id}/`),
  tickTournament: (id, minutes = 11) =>
    apiFetch(`/tournaments/${id}/tick/`, { method: 'POST', body: { minutes } }),
  simToTee: (id) =>
    apiFetch(`/tournaments/${id}/sim-to-tee/`, { method: 'POST' }),
  shufflePairings: (id) =>
    apiFetch(`/tournaments/${id}/shuffle-pairings/`, { method: 'POST' }),
  submitHoleResult: (id, payload) =>
    apiFetch(`/tournaments/${id}/hole-result/`, { method: 'POST', body: payload }),
  simToEndOfDay: (id) =>
    apiFetch(`/tournaments/${id}/sim-to-end-of-day/`, { method: 'POST' }),
}
