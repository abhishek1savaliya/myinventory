let audioContext = null

export const CHAT_SOUND_KEY = 'myinventory_chat_sound'

export function getStoredChatSoundEnabled() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(CHAT_SOUND_KEY) !== '0'
}

export function setStoredChatSoundEnabled(enabled) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CHAT_SOUND_KEY, enabled ? '1' : '0')
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

/** Warm up audio after a user gesture (required on mobile). */
export function initChatAudio() {
  getAudioContext()
}

export function playChatNotificationSound() {
  try {
    if (!getStoredChatSoundEnabled()) return

    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    const playTone = (frequency, start, duration, gainValue) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      gain.gain.setValueAtTime(gainValue, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      oscillator.start(start)
      oscillator.stop(start + duration + 0.02)
    }

    playTone(740, now, 0.1, 0.1)
    playTone(988, now + 0.1, 0.12, 0.11)
    playTone(1174, now + 0.22, 0.16, 0.1)
  } catch {
    // Audio may be blocked until user interaction
  }
}
