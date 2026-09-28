import { useEffect, type RefObject } from 'react'
import type { AudioEngine } from './audio-engine'

/**
 * Multi-touch playing for any surface whose children carry `data-note`.
 * With `glide` set (the guzheng strings, top to bottom), a fast swipe that
 * skips rows between two pointer events still sounds every string it crossed.
 */
export function usePlayable(
  ref: RefObject<HTMLElement | null>,
  engine: AudioEngine | null,
  enabled: boolean,
  glide?: string[],
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !engine || !enabled) return
    const fingers = new Map<number, string>()
    const noteAt = (x: number, y: number) => {
      const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-note]')
      return target && el.contains(target) ? (target.dataset.note ?? '') : ''
    }
    const hit = (note: string) => {
      if (note) engine.play(note)
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      const note = noteAt(e.clientX, e.clientY)
      fingers.set(e.pointerId, note)
      el.setPointerCapture(e.pointerId)
      hit(note)
    }
    const move = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return
      e.preventDefault()
      const prev = fingers.get(e.pointerId)!
      const next = noteAt(e.clientX, e.clientY)
      if (next === prev) return
      const a = glide && prev ? glide.indexOf(prev) : -1
      const b = glide && next ? glide.indexOf(next) : -1
      if (glide && a >= 0 && b >= 0) {
        const step = a < b ? 1 : -1
        for (let i = a + step; step > 0 ? i <= b : i >= b; i += step) hit(glide[i])
      } else hit(next)
      fingers.set(e.pointerId, next)
    }
    const up = (e: PointerEvent) => {
      fingers.delete(e.pointerId)
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }
    const clear = () => fingers.clear()
    const prevent = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
    el.addEventListener('contextmenu', prevent)
    window.addEventListener('blur', clear)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('lostpointercapture', up)
      el.removeEventListener('contextmenu', prevent)
      window.removeEventListener('blur', clear)
    }
  }, [ref, engine, enabled, glide])
}
