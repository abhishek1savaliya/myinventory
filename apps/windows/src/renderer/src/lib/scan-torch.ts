// @ts-nocheck
export const SCAN_TORCH_KEY = 'myinventory_scan_torch'

export function getStoredTorchPreference() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SCAN_TORCH_KEY) === '1'
}

export function setStoredTorchPreference(enabled) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SCAN_TORCH_KEY, enabled ? '1' : '0')
}

function getVideoTrack(videoEl) {
  const stream = videoEl?.srcObject
  if (!(stream instanceof MediaStream)) return null
  return stream.getVideoTracks()[0] ?? null
}

export function isTorchSupported(videoEl) {
  const track = getVideoTrack(videoEl)
  if (!track?.getCapabilities) return false
  const capabilities = track.getCapabilities()
  return capabilities.torch === true
}

export async function applyTorch(videoEl, enabled) {
  const track = getVideoTrack(videoEl)
  if (!track?.getCapabilities) return false

  const capabilities = track.getCapabilities()
  if (capabilities.torch !== true) return false

  try {
    await track.applyConstraints({ advanced: [{ torch: enabled }] })
    return true
  } catch {
    try {
      await track.applyConstraints({ torch: enabled })
      return true
    } catch {
      return false
    }
  }
}

export async function syncTorchWithPreference(videoEl) {
  if (!videoEl) {
    return { supported: false, active: false }
  }

  const supported = isTorchSupported(videoEl)
  if (!supported) {
    return { supported: false, active: false }
  }

  const wantOn = getStoredTorchPreference()
  if (!wantOn) {
    return { supported: true, active: false }
  }

  const active = await applyTorch(videoEl, true)
  return { supported: true, active }
}
