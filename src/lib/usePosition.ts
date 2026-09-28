import { useEffect, useState } from 'react'
import type { AudioEngine } from './audio-engine'

/** Song position from the audio clock, refreshed ten times a second. */
export function usePosition(engine: AudioEngine | null, key: unknown) {
  const [position, setPosition] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setPosition(engine?.position ?? 0), 100)
    return () => clearInterval(timer)
  }, [engine, key])
  return [position, setPosition] as const
}
