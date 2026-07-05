let audioContext = null

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

function playTone(ctx, frequency, startOffset = 0) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.frequency.value = frequency
  oscillator.type = 'sine'

  const start = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(0.25, start)
  gain.gain.exponentialRampToValueAtTime(0.01, start + 0.12)
  oscillator.start(start)
  oscillator.stop(start + 0.12)
}

/** Warm up audio after a user gesture (required on mobile). */
export function initScanAudio() {
  getAudioContext()
}

/** @param {'found' | 'not-found' | 'created'} kind */
export function playScanBeep(kind = 'found') {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    if (kind === 'found') {
      playTone(ctx, 880)
    } else if (kind === 'not-found') {
      playTone(ctx, 520)
      playTone(ctx, 680, 0.15)
    } else {
      playTone(ctx, 880)
      playTone(ctx, 1174, 0.14)
    }
  } catch {
    // Audio may be blocked until user interaction
  }
}
