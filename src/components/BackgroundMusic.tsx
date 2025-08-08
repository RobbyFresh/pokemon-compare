import { useEffect, useMemo, useRef, useState } from 'react'

type BackgroundMusicProps = {
  src?: string
}

export default function BackgroundMusic({ src }: BackgroundMusicProps) {
  // Default to /battle.mp3 in public; user can drop a file there
  const audioSrc = useMemo(() => src ?? '/battle.mp3', [src])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bgm-muted')
      return saved ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })
  const [volume, setVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bgm-volume')
      const v = saved ? Number(saved) : 0.5
      return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5
    } catch {
      return 0.5
    }
  })
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.muted = isMuted
    el.volume = volume
    if (!isMuted) {
      el.play().catch(() => {
        // Autoplay blocked; force muted UI until user clicks
        setIsMuted(true)
      })
    } else {
      // If muted, pause to avoid decoding in background
      el.pause()
      el.currentTime = 0
    }
    try { localStorage.setItem('bgm-muted', JSON.stringify(isMuted)) } catch {}
  }, [isMuted, volume])

  useEffect(() => {
    try { localStorage.setItem('bgm-volume', String(volume)) } catch {}
    const el = audioRef.current
    if (el) el.volume = volume
  }, [volume])

  const toggle = () => setIsMuted((v) => !v)

  return (
    <div className="flex flex-col items-end gap-1">
      <audio
        ref={audioRef}
        src={audioSrc}
        loop
        preload="none"
        onCanPlay={() => setIsReady(true)}
      />
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white/70 px-2 py-0.5 text-[10px] shadow hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800"
        title={isMuted ? 'Play music' : 'Mute music'}
      >
        {isMuted ? (
          <span className="inline-flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
              <path d="M3 9v6h4l5 4V5L7 9H3z" />
            </svg>
            <span>Play</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
              <path d="M16.5 12a4.5 4.5 0 0 0-4.5-4.5v-2a6.5 6.5 0 0 1 6.5 6.5h-2z" />
              <path d="M3 9v6h4l5 4V5L7 9H3z" />
            </svg>
            <span>Mute</span>
          </span>
        )}
      </button>
      <div className="flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 opacity-70">
          <path d="M3 9v6h4l5 4V5L7 9H3z" />
        </svg>
        <input
          aria-label="Music volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-slate-300 outline-none dark:bg-slate-700"
        />
      </div>
      {!isReady && <span className="sr-only">Loading audio…</span>}
    </div>
  )
}


