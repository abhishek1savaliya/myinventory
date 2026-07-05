let audioContext = null

export const SCAN_SOUND_KEY = 'myinventory_scan_sound'

export function getStoredScanSoundEnabled() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(SCAN_SOUND_KEY) !== '0'
}

export function setStoredScanSoundEnabled(enabled) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SCAN_SOUND_KEY, enabled ? '1' : '0')
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
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.frequency.value = frequency
  oscillator.type = type

  const start = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(peakGain, start)
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
