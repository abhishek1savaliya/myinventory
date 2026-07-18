// @ts-nocheck
import { CHAT_MAX_ATTACHMENT_BYTES } from '@myinventory/shared'

export const CHAT_VIDEO_COMPRESSION_MAX_INPUT_BYTES = 300 * 1024 * 1024

const TARGET_BYTES = 48 * 1024 * 1024
const AUDIO_BITS_PER_SECOND = 96_000

function supportedMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function waitForMetadata(video) {
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve
    video.onerror = () => reject(new Error('Could not read this video'))
  })
}

export async function compressChatVideo(file, onProgress) {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof HTMLCanvasElement.prototype.captureStream !== 'function'
  ) {
    throw new Error('Video compression is not supported on this device')
  }

  const inputUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = inputUrl
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true

  try {
    await waitForMetadata(video)
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('Could not determine video duration')
    }

    const maxDimension = 1280
    const dimensionScale = Math.min(
      1,
      maxDimension / Math.max(video.videoWidth, video.videoHeight),
    )
    const width = Math.max(2, Math.round((video.videoWidth * dimensionScale) / 2) * 2)
    const height = Math.max(2, Math.round((video.videoHeight * dimensionScale) / 2) * 2)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not start video compression')

    const outputStream = canvas.captureStream(30)
    const captureVideo = video.captureStream ?? video.mozCaptureStream
    if (typeof captureVideo === 'function') {
      const sourceStream = captureVideo.call(video)
      for (const track of sourceStream.getAudioTracks()) outputStream.addTrack(track)
    }

    const targetTotalBitrate = Math.floor((TARGET_BYTES * 8) / video.duration)
    const videoBitsPerSecond = Math.max(
      250_000,
      Math.min(4_000_000, targetTotalBitrate - AUDIO_BITS_PER_SECOND),
    )
    const mimeType = supportedMimeType()
    const recorder = new MediaRecorder(outputStream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    })
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    const result = new Promise((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Video compression failed'))
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'video/webm'
        const blob = new Blob(chunks, { type })
        if (blob.size > CHAT_MAX_ATTACHMENT_BYTES) {
          reject(new Error('Max size is 50 MB'))
          return
        }
        resolve(
          new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-compressed.webm`, {
            type,
            lastModified: Date.now(),
          }),
        )
      }
    })

    let frameId = 0
    const drawFrame = () => {
      context.drawImage(video, 0, 0, width, height)
      onProgress?.(Math.min(99, Math.round((video.currentTime / video.duration) * 100)))
      if (!video.ended) frameId = requestAnimationFrame(drawFrame)
    }

    video.onended = () => {
      cancelAnimationFrame(frameId)
      onProgress?.(100)
      recorder.stop()
    }
    recorder.start(1000)
    await video.play()
    drawFrame()
    return await result
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(inputUrl)
  }
}
