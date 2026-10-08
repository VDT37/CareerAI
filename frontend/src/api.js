// The demo passcode (only used when the backend sets DEMO_PASSCODE) is kept per browser
const PASSCODE_KEY = 'careerai-demo-passcode'
let passcode = ''
try { passcode = localStorage.getItem(PASSCODE_KEY) || '' } catch { /* storage blocked: keep it in memory */ }

export function setPasscode(code) {
  passcode = code
  try { localStorage.setItem(PASSCODE_KEY, code) } catch { /* memory only */ }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (passcode) headers['X-Demo-Passcode'] = passcode
  const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = new Error(data.detail || `Request failed (${r.status})`)
    err.status = r.status
    throw err
  }
  return data
}

export const post = (path, body = {}) => api(path, { method: 'POST', body })
export const patch = (path, body = {}) => api(path, { method: 'PATCH', body })
