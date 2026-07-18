// @ts-nocheck
let audioContext = null

export const SCAN_SOUND_KEY = 'myinventory_scan_sound'
export const SCAN_SOUND_VOLUME_KEY = 'myinventory_scan_sound_volume'

const DEFAULT_SCAN_SOUND_VOLUME = 100
const MIN_SCAN_SOUND_VOLUME = 50
const MAX_SCAN_SOUND_VOLUME = 200

export function getStoredScanSoundEnabled() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(SCAN_SOUND_KEY) !== '0'
}

export function setStoredScanSoundEnabled(enabled) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SCAN_SOUND_KEY, enabled ? '1' : '0')
}

export function getStoredScanSoundVolume() {
  if (typeof window === 'undefined') return DEFAULT_SCAN_SOUND_VOLUME

  const raw = localStorage.getItem(SCAN_SOUND_VOLUME_KEY)
  if (!raw) return DEFAULT_SCAN_SOUND_VOLUME

  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return DEFAULT_SCAN_SOUND_VOLUME

  return Math.min(MAX_SCAN_SOUND_VOLUME, Math.max(MIN_SCAN_SOUND_VOLUME, parsed))
}

export function setStoredScanSoundVolume(volume) {
  if (typeof window === 'undefined') return

  const clamped = Math.min(
    MAX_SCAN_SOUND_VOLUME,
    Math.max(MIN_SCAN_SOUND_VOLUME, Math.round(volume)),
  )
  localStorage.setItem(SCAN_SOUND_VOLUME_KEY, String(clamped))
}

export function getScanVolumeMultiplier() {
  return getStoredScanSoundVolume() / 100
}

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null

  if (!audioContext) {
    audioContext = new AudioCtx()
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }

  return audioContext
}

function playTone(ctx, frequency, { startOffset = 0, duration = 0.14, peakGain = 0.9, type = 'square' } = {}) {
  const volumeMultiplier = getScanVolumeMultiplier()
  const scaledGain = Math.min(peakGain * volumeMultiplier, 2)

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.frequency.value = frequency
  oscillator.type = type

  const start = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(scaledGain, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

/** Warm up audio after a user gesture (required on mobile). */
export function initScanAudio() {
  getAudioContext()
}

/** @param {'scanned' | 'found' | 'not-found' | 'created'} kind */
export function playScanBeep(kind = 'scanned') {
  try {
    if (!getStoredScanSoundEnabled()) return

    const ctx = getAudioContext()
    if (!ctx) return

    if (kind === 'scanned') {
      playTone(ctx, 1240, { duration: 0.16, peakGain: 0.95 })
      playTone(ctx, 1560, { startOffset: 0.08, duration: 0.12, peakGain: 0.85 })
    } else if (kind === 'found') {
      playTone(ctx, 880, { peakGain: 0.75 })
    } else if (kind === 'not-found') {
      playTone(ctx, 520, { peakGain: 0.75 })
      playTone(ctx, 680, { startOffset: 0.15, peakGain: 0.75 })
    } else {
      playTone(ctx, 880, { peakGain: 0.8 })
      playTone(ctx, 1174, { startOffset: 0.14, peakGain: 0.8 })
    }
  } catch {
    // Audio may be blocked until user interaction
  }
}
