export type Row = { id: number; [key: string]: any }
export type Profile = { preferred_name: string; age_range: string; arthritis_type: string; affected_hands: string; difficulty: string; goals: string; onboarding_step: number; consented: boolean; readable: boolean }
export let dataMode = localStorage.getItem('arthritrack-mode') || 'real'
export function setMode(mode: string) { dataMode = mode; localStorage.setItem('arthritrack-mode', mode) }
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000)
  let res:Response
  try{res=await fetch('/api' + path, { method, credentials: 'include', signal:controller.signal, headers: { 'Content-Type': 'application/json', 'X-Data-Mode': dataMode }, body: body === undefined ? undefined : JSON.stringify(body) })}catch(error){if((error as Error).name==='AbortError')throw new Error('The request took too long. Your unsaved information is still on this screen; please retry.');throw error}finally{clearTimeout(timer)}
  if (!res.ok) { const error = await res.json().catch(() => ({})); throw new Error(typeof error.detail === 'string' ? error.detail : `Request failed (${res.status}). Check your entries and try again.`) }
  return res.headers.get('content-type')?.includes('application/pdf') ? await res.blob() as T : res.json()
}
export function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
export const localDateTime = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16) }
export const names: Record<string, string> = { fist: 'Fist opening & closing', spread: 'Finger spreading', opposition: 'Thumb opposition' }
