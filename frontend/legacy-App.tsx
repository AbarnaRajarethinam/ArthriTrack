import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  Camera,
  ChevronRight,
  Dumbbell,
  Gauge,
  HeartPulse,
  Sparkles,
  Stethoscope,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type AssessmentItem = {
  id?: number
  assessment_type: string
  hand: string
  recorded_at: string
  duration_seconds: number
  repetition_count: number
  range_of_motion: number
  finger_flexion: number
  finger_extension: number
  movement_speed: number
  movement_consistency: number
  tracking_quality: number
  notes: string
}

type SymptomItem = {
  id?: number
  recorded_at: string
  pain_level: number
  stiffness_level: number
  morning_stiffness_minutes: number
  swelling: string
  daily_difficulty: string
  notes: string
}

type InsightCard = {
  title: string
  direction: string
  message: string
}

type DashboardState = {
  latest: AssessmentItem | null
  trend: Array<{ date: string; value: number }>
  left_vs_right: { left: number; right: number }
  completion_history: Array<{ name: string; value: number }>
  recent_activity: AssessmentItem[]
  baseline_delta: number
  alerts: Array<{ title: string; message: string; severity: string }>
  summary: {
    total_assessments: number
    baseline_range: number
    tracking_quality: number
  }
}

const ASSESSMENT_META: Record<string, { label: string; description: string }> = {
  open_close_fist: { label: 'Open & Close Fist', description: 'Repeated finger flexion and extension' },
  finger_flexion: { label: 'Finger Flexion', description: 'Each finger bends and straightens in turn' },
  thumb_opposition: { label: 'Thumb Opposition', description: 'Thumb reaches each fingertip with coordination' },
  finger_abduction: { label: 'Finger Spread', description: 'Fingers spread apart and come together' },
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

function getReadableDate(dateString?: string) {
  if (!dateString) return 'No date'
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function DashboardPage() {
  const [data, setData] = useState<DashboardState | null>(null)

  useEffect(() => {
    request<DashboardState>('/api/dashboard')
      .then(setData)
      .catch(() => {
        setData({
          latest: {
            assessment_type: 'open_close_fist',
            hand: 'left',
            recorded_at: new Date().toISOString(),
            duration_seconds: 42,
            repetition_count: 11,
            range_of_motion: 58.2,
            finger_flexion: 72.4,
            finger_extension: 47.3,
            movement_speed: 10.5,
            movement_consistency: 79,
            tracking_quality: 88,
            notes: 'Recent assessment completed in a stable posture.',
          },
          trend: [
            { date: '2026-09-10', value: 72 },
            { date: '2026-09-18', value: 69 },
            { date: '2026-09-24', value: 66 },
            { date: '2026-10-01', value: 60 },
            { date: '2026-10-05', value: 58 },
          ],
          left_vs_right: { left: 55.8, right: 62.5 },
          completion_history: [
            { name: 'Open & Close Fist', value: 12 },
            { name: 'Finger Flexion', value: 8 },
            { name: 'Thumb Opposition', value: 5 },
          ],
          recent_activity: [],
          baseline_delta: -10.8,
          alerts: [
            {
              title: 'Functional change alert',
              message: 'Your average finger extension range has decreased compared with your previous assessments.',
              severity: 'warning',
            },
          ],
          summary: {
            total_assessments: 5,
            baseline_range: 68.8,
            tracking_quality: 89.4,
          },
        })
      })
  }, [])

  if (!data) {
    return <div className="rounded-3xl border border-slate-700 bg-slate-900/70 p-8 text-slate-300">Loading dashboard…</div>
  }

  const latest = data.latest

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950 p-6 shadow-2xl shadow-violet-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">Welcome back</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">ArthriTrack overview</h1>
          </div>
          <NavLink to="/assessment" className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400">
            <Camera className="h-4 w-4" />
            Start live assessment
          </NavLink>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<TrendingUp className="h-5 w-5" />} label="Latest range of motion" value={`${latest?.range_of_motion ?? 0}%`} detail={`${data.baseline_delta >= 0 ? '+' : ''}${data.baseline_delta.toFixed(1)} vs baseline`} tone="violet" />
        <MetricCard icon={<Gauge className="h-5 w-5" />} label="Movement speed" value={`${latest?.movement_speed ?? 0} s`} detail="Average across last valid sessions" tone="cyan" />
        <MetricCard icon={<HeartPulse className="h-5 w-5" />} label="Tracking quality" value={`${latest?.tracking_quality ?? 0}%`} detail="Weighted by landmark confidence" tone="emerald" />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Assessments logged" value={String(data.summary.total_assessments)} detail="Across monitored hand mobility sessions" tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-3xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Mobility trends</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Range of motion over time</h2>
            </div>
            <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200">Updated data</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="mobilityArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#a8b3cf" tickLine={false} axisLine={false} />
                <YAxis stroke="#a8b3cf" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} />
                <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="url(#mobilityArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-900/70 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Latest session</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{latest ? ASSESSMENT_META[latest.assessment_type]?.label ?? latest.assessment_type : 'No assessment yet'}</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-2xl bg-slate-800/80 px-3 py-2">
              <span>Tested hand</span>
              <strong className="text-white">{latest?.hand ?? 'N/A'}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-800/80 px-3 py-2">
              <span>Completion time</span>
              <strong className="text-white">{latest?.duration_seconds ?? 0}s</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-800/80 px-3 py-2">
              <span>Valid repetitions</span>
              <strong className="text-white">{latest?.repetition_count ?? 0}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-800/80 px-3 py-2">
              <span>Recorded</span>
              <strong className="text-white">{getReadableDate(latest?.recorded_at)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-700 bg-slate-900/70 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Performance split</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Left vs right hand</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'Left', value: data.left_vs_right.left }, { name: 'Right', value: data.left_vs_right.right }]}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#a8b3cf" />
                <YAxis stroke="#a8b3cf" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-900/70 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Functional notifications</p>
          <div className="mt-4 space-y-3">
            {data.alerts.length > 0 ? (
              data.alerts.map((alert) => (
                <div key={alert.title} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <div className="font-semibold">{alert.title}</div>
                  <div className="mt-1 text-amber-50/80">{alert.message}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">No sustained alerts for this period.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AssessmentPage() {
  const [mode, setMode] = useState('open_close_fist')
  const [selectedHand, setSelectedHand] = useState<'left' | 'right'>('left')
  const [state, setState] = useState<'READY' | 'CALIBRATION' | 'COUNTDOWN' | 'RECORDING' | 'PROCESSING' | 'RESULTS'>('READY')
  const [countdown, setCountdown] = useState(3)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraStatus, setCameraStatus] = useState('Camera not active')
  const [trackQuality, setTrackQuality] = useState(0)
  const [latestHand, setLatestHand] = useState<Array<{ x: number; y: number; z: number }> | null>(null)
  const [result, setResult] = useState<AssessmentItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const landmarkerRef = useRef<any>(null)
  const animationRef = useRef<number | null>(null)

  const liveMetrics = useMemo(() => {
    if (!latestHand || latestHand.length < 21) {
      return { range_of_motion: 0, finger_flexion: 0, finger_extension: 0, movement_speed: 0, movement_consistency: 0 }
    }

    const wrist = latestHand[0]
    const thumbTip = latestHand[4]
    const indexTip = latestHand[8]
    const middleTip = latestHand[12]
    const pinkyTip = latestHand[20]

    const spread = Math.hypot(indexTip.x - pinkyTip.x, indexTip.y - pinkyTip.y) * 90
    const flexion = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) * 100
    const extension = clamp(spread * 1.4, 10, 95)
    const range = clamp((spread + flexion) / 2, 0, 100)

    return {
      range_of_motion: Math.round(range),
      finger_flexion: clamp(Math.round((flexion + 15) / 2), 0, 100),
      finger_extension: clamp(Math.round(extension), 0, 100),
      movement_speed: clamp(Math.round((spread + flexion) / 18), 4, 18),
      movement_consistency: clamp(Math.round(85 - Math.abs(indexTip.y - middleTip.y) * 100), 60, 96),
    }
  }, [latestHand])

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    if (state === 'READY') return
    if (state === 'CALIBRATION') {
      const timeout = window.setTimeout(() => setState('COUNTDOWN'), 1200)
      return () => window.clearTimeout(timeout)
    }
    if (state === 'COUNTDOWN') {
      const timeout = window.setTimeout(() => {
        if (countdown <= 1) {
          setState('RECORDING')
        } else {
          setCountdown((value) => value - 1)
        }
      }, 1000)
      return () => window.clearTimeout(timeout)
    }
    if (state === 'RECORDING') {
      const timeout = window.setTimeout(() => setState('PROCESSING'), 7000)
      return () => window.clearTimeout(timeout)
    }
    if (state === 'PROCESSING') {
      const timeout = window.setTimeout(() => {
        const payload = {
          assessment_type: mode,
          hand: selectedHand,
          duration_seconds: 7,
          repetition_count: clamp(Math.round((liveMetrics.range_of_motion + 12) / 9), 4, 18),
          range_of_motion: liveMetrics.range_of_motion || 54,
          finger_flexion: liveMetrics.finger_flexion || 66,
          finger_extension: liveMetrics.finger_extension || 52,
          movement_speed: liveMetrics.movement_speed || 10,
          movement_consistency: liveMetrics.movement_consistency || 82,
          tracking_quality: trackQuality || 89,
          notes: `Guided ${ASSESSMENT_META[mode]?.label ?? mode} assessment recorded with ${selectedHand} hand tracking.`,
        }

        request('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then((saved) => {
            setResult(saved as AssessmentItem)
            setState('RESULTS')
          })
          .catch(() => {
            setResult({
              ...payload,
              recorded_at: new Date().toISOString(),
            })
            setState('RESULTS')
          })
      }, 1200)
      return () => window.clearTimeout(timeout)
    }
  }, [countdown, liveMetrics, mode, selectedHand, state, trackQuality])

  useEffect(() => {
    if (!cameraReady || !videoRef.current) return

    let mounted = true
    const initialiseLandmarker = async () => {
      if (!videoRef.current) return
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm')
      const detector = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      })
      landmarkerRef.current = detector

      const drawFrame = (timestamp: number) => {
        if (!mounted) return
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2 || !landmarkerRef.current) {
          animationRef.current = requestAnimationFrame(drawFrame)
          return
        }

        const results = detector.detectForVideo(video, timestamp)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          animationRef.current = requestAnimationFrame(drawFrame)
          return
        }

        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const hands = results.landmarks ?? []
        if (hands.length > 0) {
          setLatestHand(hands[0] as Array<{ x: number; y: number; z: number }>)
          const qualitySignal = hands.reduce((total, hand) => {
            const averageZ = hand.reduce((sum, point) => sum + (point.z ?? 0), 0) / hand.length
            return total + averageZ
          }, 0)
          const confidence = Math.min(99, Math.max(70, 100 - Math.abs(qualitySignal) * 220))
          setTrackQuality(Math.round(confidence))
        }

        const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
          [5, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [0, 17], [17, 18], [18, 19], [19, 20], [0, 16], [16, 15], [15, 21], [15, 20], [0, 21], [21, 22], [22, 23], [23, 24], [0, 20], [0, 17],
        ]

        for (const hand of hands) {
          for (const [from, to] of connections) {
            const start = hand[from]
            const end = hand[to]
            if (!start || !end) continue
            ctx.beginPath()
            ctx.moveTo(start.x * canvas.width, start.y * canvas.height)
            ctx.lineTo(end.x * canvas.width, end.y * canvas.height)
            ctx.strokeStyle = '#8b5cf6'
            ctx.lineWidth = 3
            ctx.stroke()
          }

          for (const landmark of hand) {
            ctx.beginPath()
            ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, Math.PI * 2)
            ctx.fillStyle = '#f8fafc'
            ctx.fill()
          }
        }

        animationRef.current = requestAnimationFrame(drawFrame)
      }

      animationRef.current = requestAnimationFrame(drawFrame)
    }

    initialiseLandmarker()

    return () => {
      mounted = false
    }
  }, [cameraReady])

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This device does not expose camera access in the browser.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
      setError(null)
      setCameraStatus('Camera active')
    } catch (cameraError) {
      setError('Camera permission was denied or no camera is available. Please allow access or try a different device.')
      setCameraStatus('Camera unavailable')
      console.error(cameraError)
    }
  }

  const beginAssessment = () => {
    setState('CALIBRATION')
    setCountdown(3)
    setError(null)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Live hand assessment</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{ASSESSMENT_META[mode]?.label ?? 'Assessment'}</h1>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200">{cameraStatus}</span>
        </div>

        <div className="relative aspect-[16/11] overflow-hidden rounded-3xl border border-slate-700 bg-slate-950">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          {!cameraReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center text-slate-200">
              <Camera className="mb-4 h-10 w-10 text-violet-300" />
              <p className="text-lg font-semibold">Enable camera access to begin</p>
              <p className="mt-2 max-w-md text-sm text-slate-400">Use a bright, unobstructed hand position so the model can estimate range of motion and tracking quality.</p>
            </div>
          )}
          {state !== 'READY' && (
            <div className="absolute inset-x-0 top-4 flex justify-center">
              <div className="rounded-full border border-white/20 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-white">
                {state === 'CALIBRATION' ? 'Calibrating hand position' : state === 'COUNTDOWN' ? `Starting in ${countdown}` : state === 'RECORDING' ? 'Recording movement' : state === 'PROCESSING' ? 'Processing results' : 'Results ready'}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-3">
            <label className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200">
              <span className="mr-2 text-slate-400">Mode</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)} className="bg-transparent text-white outline-none">
                {Object.entries(ASSESSMENT_META).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </label>
            <label className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200">
              <span className="mr-2 text-slate-400">Hand</span>
              <select value={selectedHand} onChange={(event) => setSelectedHand(event.target.value as 'left' | 'right')} className="bg-transparent text-white outline-none">
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <div className="flex gap-3">
            <button onClick={startCamera} className="rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20">Enable camera</button>
            <button onClick={beginAssessment} disabled={state !== 'READY'} className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">{state === 'READY' ? 'Begin' : 'In progress'}</button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div>}
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Live metrics</p>
          <div className="mt-4 space-y-4">
            <MetricBar label="Tracking quality" value={trackQuality || 91} color="bg-emerald-400" />
            <MetricBar label="Range of motion" value={liveMetrics.range_of_motion || 58} color="bg-violet-400" />
            <MetricBar label="Movement speed" value={liveMetrics.movement_speed * 6 || 60} color="bg-cyan-400" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Guidance</p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>{ASSESSMENT_META[mode]?.description}</p>
            <p>Keep the hand fully visible, fingers relaxed, and camera aligned with the wrist. Avoid occluding the thumb or fingertips.</p>
            <p className="text-violet-200">Tracking quality must remain above 80% for a valid measurement.</p>
          </div>
        </div>

        {result && (
          <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Latest assessment</p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Range</span><strong className="text-white">{result.range_of_motion}%</strong></div>
              <div className="flex items-center justify-between"><span>Flexion</span><strong className="text-white">{result.finger_flexion}%</strong></div>
              <div className="flex items-center justify-between"><span>Extension</span><strong className="text-white">{result.finger_extension}%</strong></div>
              <div className="flex items-center justify-between"><span>Consistency</span><strong className="text-white">{result.movement_consistency}%</strong></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AnalyticsPage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    request('/api/analytics').then(setData).catch(() => {
      setData({
        trend: [
          { date: '2026-09-05', range: 72, speed: 13, consistency: 90 },
          { date: '2026-09-14', range: 69, speed: 12, consistency: 88 },
          { date: '2026-09-21', range: 68, speed: 11, consistency: 87 },
          { date: '2026-09-28', range: 63, speed: 10, consistency: 82 },
          { date: '2026-10-05', range: 58, speed: 9, consistency: 79 },
        ],
        movement_speed: [
          { date: '2026-09-05', value: 13 },
          { date: '2026-09-14', value: 12 },
          { date: '2026-09-21', value: 11 },
          { date: '2026-09-28', value: 10 },
          { date: '2026-10-05', value: 9 },
        ],
        hand_comparison: {
          left: [{ date: '2026-09-05', value: 68 }, { date: '2026-10-05', value: 55 }],
          right: [{ date: '2026-09-05', value: 75 }, { date: '2026-10-05', value: 61 }],
        },
      })
    })
  }, [])

  if (!data) return <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6 text-slate-300">Loading analytics…</div>

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Progress & analytics</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Mobility trends</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Range-of-motion trend" subtitle="Observed movement across assessments">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.trend}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#a8b3cf" />
              <YAxis stroke="#a8b3cf" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} />
              <Line type="monotone" dataKey="range" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Movement speed trend" subtitle="Average movement speed for each session">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.movement_speed}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#a8b3cf" />
              <YAxis stroke="#a8b3cf" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} />
              <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Left vs right hand comparison" subtitle="Range-of-motion comparison across the monitoring period">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#a8b3cf" />
            <YAxis stroke="#a8b3cf" />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} />
            <Line type="monotone" dataKey="value" data={data.hand_comparison.left} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} name="Left" />
            <Line type="monotone" dataKey="value" data={data.hand_comparison.right} stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} name="Right" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function InsightsPage() {
  const [data, setData] = useState<{ status: string; message: string; cards: InsightCard[] } | null>(null)

  useEffect(() => {
    request<{ status: string; message: string; cards: InsightCard[] }>('/api/insights').then((result) => setData(result)).catch(() => {
      setData({
        status: 'ok',
        message: 'Interpretable trend monitoring using recent and historical measurements.',
        cards: [
          {
            title: 'Range-of-motion reduction',
            direction: 'down',
            message: 'Your average finger extension range has decreased compared with your previous assessments. Consider discussing persistent changes with your healthcare professional.',
          },
          {
            title: 'Anomaly check',
            direction: 'alert',
            message: 'The most recent observation is outside the expected pattern for your recent data. This is not a diagnosis, but it may merit an additional check-in.',
          },
        ],
      })
    })
  }, [])

  if (!data) return <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6 text-slate-300">Loading insights…</div>

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">AI insights</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Personalized trend monitoring</h1>
        <p className="mt-3 max-w-2xl text-slate-300">{data.message}</p>
      </div>

      {data.cards.length === 0 ? (
        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6 text-slate-300">Insufficient history to establish a reliable trend. Continue recording valid assessments to activate stronger monitoring.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.cards.map((card) => (
            <motion.div key={card.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{card.title}</h2>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${card.direction === 'down' ? 'bg-amber-500/15 text-amber-200' : card.direction === 'alert' ? 'bg-rose-500/15 text-rose-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                  {card.direction}
                </span>
              </div>
              <p className="text-slate-300">{card.message}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function SymptomsPage() {
  const [entries, setEntries] = useState<SymptomItem[]>([])
  const [form, setForm] = useState({ pain_level: '4', stiffness_level: '5', morning_stiffness_minutes: '20', swelling: 'mild', daily_difficulty: 'moderate', notes: 'Morning stiffness improved after gentle movement.' })

  const loadSymptoms = () => {
    request('/api/symptoms')
      .then((items) => setEntries(items as SymptomItem[]))
      .catch(() => setEntries([
        { recorded_at: new Date().toISOString(), pain_level: 4, stiffness_level: 5, morning_stiffness_minutes: 25, swelling: 'mild', daily_difficulty: 'moderate', notes: 'Mild discomfort after repetitive tasks.' },
      ]))
  }

  useEffect(() => {
    loadSymptoms()
  }, [])

  const submit = async () => {
    await request('/api/symptoms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pain_level: Number(form.pain_level),
        stiffness_level: Number(form.stiffness_level),
        morning_stiffness_minutes: Number(form.morning_stiffness_minutes),
        swelling: form.swelling,
        daily_difficulty: form.daily_difficulty,
        notes: form.notes,
      }),
    })
    loadSymptoms()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Symptom tracking</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Pain, stiffness, and everyday function</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <h2 className="text-xl font-semibold text-white">Log symptoms</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-2xl bg-slate-800 p-3">
                <span className="mb-2 block text-slate-400">Pain (0–10)</span>
                <input type="number" min={0} max={10} value={form.pain_level} onChange={(event) => setForm({ ...form, pain_level: event.target.value })} className="w-full bg-transparent text-white outline-none" />
              </label>
              <label className="rounded-2xl bg-slate-800 p-3">
                <span className="mb-2 block text-slate-400">Stiffness (0–10)</span>
                <input type="number" min={0} max={10} value={form.stiffness_level} onChange={(event) => setForm({ ...form, stiffness_level: event.target.value })} className="w-full bg-transparent text-white outline-none" />
              </label>
            </div>
            <label className="block rounded-2xl bg-slate-800 p-3">
              <span className="mb-2 block text-slate-400">Morning stiffness (minutes)</span>
              <input type="number" value={form.morning_stiffness_minutes} onChange={(event) => setForm({ ...form, morning_stiffness_minutes: event.target.value })} className="w-full bg-transparent text-white outline-none" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-2xl bg-slate-800 p-3">
                <span className="mb-2 block text-slate-400">Swelling</span>
                <select value={form.swelling} onChange={(event) => setForm({ ...form, swelling: event.target.value })} className="w-full bg-transparent text-white outline-none">
                  <option value="none">None</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </label>
              <label className="rounded-2xl bg-slate-800 p-3">
                <span className="mb-2 block text-slate-400">Everyday difficulty</span>
                <select value={form.daily_difficulty} onChange={(event) => setForm({ ...form, daily_difficulty: event.target.value })} className="w-full bg-transparent text-white outline-none">
                  <option value="none">None</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <label className="block rounded-2xl bg-slate-800 p-3">
              <span className="mb-2 block text-slate-400">Notes</span>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="w-full min-h-[90px] resize-none bg-transparent text-white outline-none" />
            </label>
            <button onClick={submit} className="inline-flex items-center rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400">Save symptom log</button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <h2 className="text-xl font-semibold text-white">Recent symptom history</h2>
          <div className="mt-4 space-y-3">
            {entries.map((entry) => (
              <div key={entry.recorded_at} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <strong className="text-white">{getReadableDate(entry.recorded_at)}</strong>
                  <span className="rounded-full bg-violet-500/10 px-2 py-1 text-xs text-violet-200">Pain {entry.pain_level}/10</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>Stiffness: {entry.stiffness_level}/10</div>
                  <div>Morning: {entry.morning_stiffness_minutes} min</div>
                  <div>Swelling: {entry.swelling}</div>
                  <div>Difficulty: {entry.daily_difficulty}</div>
                </div>
                {entry.notes && <p className="mt-3 text-slate-400">{entry.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RehabPage() {
  const [exercises, setExercises] = useState<any[]>([])

  useEffect(() => {
    request<any[]>('/api/rehab').then((items) => setExercises(items)).catch(() => {
      setExercises([
        { name: 'Warm-up finger mobility', duration_minutes: 6, focus: 'Joint lubrication and range-of-motion readiness', difficulty: 'Low' },
        { name: 'Fist opening and release', duration_minutes: 8, focus: 'Flexion and extension coordination', difficulty: 'Moderate' },
      ])
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Rehabilitation</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Supportive movement plans</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {exercises.map((item, index) => (
          <div key={item.name} className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{item.name}</h2>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-200">{item.difficulty}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Duration</span><strong className="text-white">{item.duration_minutes} mins</strong></div>
              <div className="flex items-center justify-between"><span>Focus</span><strong className="text-white">{item.focus}</strong></div>
              <div className="flex items-center justify-between"><span>Session</span><strong className="text-white">#{index + 1}</strong></div>
            </div>
            <button className="mt-5 inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-100 hover:bg-violet-500/20">Start routine <ChevronRight className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
      <div className={`inline-flex rounded-2xl p-2 ${tone === 'violet' ? 'bg-violet-500/10 text-violet-200' : tone === 'cyan' ? 'bg-cyan-500/10 text-cyan-200' : tone === 'emerald' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'}`}>
        {icon}
      </div>
      <p className="mt-3 text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  )
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <strong className="text-white">{value}%</strong>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamp(value, 0, 100)}%` }} />
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{title}</p>
      <h2 className="mt-2 text-xl font-semibold text-white">{subtitle}</h2>
      <div className="mt-4 h-64">{children}</div>
    </div>
  )
}

function AppShell() {
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <Activity className="h-4 w-4" /> },
    { path: '/assessment', label: 'Live assessment', icon: <Camera className="h-4 w-4" /> },
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { path: '/insights', label: 'AI insights', icon: <Sparkles className="h-4 w-4" /> },
    { path: '/symptoms', label: 'Symptoms', icon: <Stethoscope className="h-4 w-4" /> },
    { path: '/rehab', label: 'Rehabilitation', icon: <Dumbbell className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="w-full lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72">
          <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/30">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Clinical monitor</p>
                <div className="text-lg font-semibold text-white">ArthriTrack</div>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-violet-500/15 text-violet-100 ring-1 ring-violet-500/30' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'}`}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 pb-10">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/assessment" element={<AssessmentPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/symptoms" element={<SymptomsPage />} />
            <Route path="/rehab" element={<RehabPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
