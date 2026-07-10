let audioContext = null

export const CHAT_SOUND_KEY = 'myinventory_chat_sound'
export const CHAT_SOUND_VOLUME_KEY = 'myinventory_chat_sound_volume'

const DEFAULT_CHAT_SOUND_VOLUME = 100
const MIN_CHAT_SOUND_VOLUME = 50
const MAX_CHAT_SOUND_VOLUME = 200

export function getStoredChatSoundEnabled() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(CHAT_SOUND_KEY) !== '0'
}

export function setStoredChatSoundEnabled(enabled) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CHAT_SOUND_KEY, enabled ? '1' : '0')
}

export function getStoredChatSoundVolume() {
  if (typeof window === 'undefined') return DEFAULT_CHAT_SOUND_VOLUME

  const raw = localStorage.getItem(CHAT_SOUND_VOLUME_KEY)
  if (!raw) return DEFAULT_CHAT_SOUND_VOLUME

  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return DEFAULT_CHAT_SOUND_VOLUME

  return Math.min(MAX_CHAT_SOUND_VOLUME, Math.max(MIN_CHAT_SOUND_VOLUME, parsed))
}

export function setStoredChatSoundVolume(volume) {
  if (typeof window === 'undefined') return

  const clamped = Math.min(
    MAX_CHAT_SOUND_VOLUME,
    Math.max(MIN_CHAT_SOUND_VOLUME, Math.round(volume)),
  )
  localStorage.setItem(CHAT_SOUND_VOLUME_KEY, String(clamped))
}

function getChatVolumeMultiplier() {
  return getStoredChatSoundVolume() / 100
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

function playTone(ctx, frequency, start, duration, peakGain, type = 'sine') {
  const volumeMultiplier = getChatVolumeMultiplier()
  const scaledGain = Math.min(peakGain * volumeMultiplier, 0.35)

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.frequency.value = frequency
  oscillator.type = type
  gain.gain.setValueAtTime(scaledGain, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

/** Warm up audio after a user gesture (required on mobile). */
export function initChatAudio() {
  getAudioContext()
}

/** Short pop when you send a message. */
export function playChatSentSound() {
  try {
    if (!getStoredChatSoundEnabled()) return

    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    playTone(ctx, 520, now, 0.07, 0.08)
    playTone(ctx, 740, now + 0.05, 0.09, 0.07)
  } catch {
    // Audio may be blocked until user interaction
  }
}

/**
 * Incoming message sound.
 * @param {{ inConversation?: boolean }} [options]
 * - inConversation: softer tone when you are already viewing that chat
 */
export function playChatIncomingSound({ inConversation = false } = {}) {
  try {
    if (!getStoredChatSoundEnabled()) return

    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    if (inConversation) {
      playTone(ctx, 880, now, 0.09, 0.09)
      playTone(ctx, 1046, now + 0.07, 0.11, 0.08)
      return
    }

    playTone(ctx, 740, now, 0.1, 0.1)
    playTone(ctx, 988, now + 0.1, 0.12, 0.11)
    playTone(ctx, 1174, now + 0.22, 0.16, 0.1)
  } catch {
    // Audio may be blocked until user interaction
  }
}

/** @deprecated Use playChatIncomingSound */
export function playChatNotificationSound() {
  playChatIncomingSound({ inConversation: false })
}
