// @ts-nocheck
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']

let zxingBundlePromise = null
let zxingReader = null

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function getVideoConstraints(isMobile, deviceId) {
  const resolution = isMobile
    ? {
        width: { ideal: 640, max: 800 },
        height: { ideal: 480, max: 600 },
        frameRate: { ideal: 24, max: 30 },
      }
    : {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 30, max: 30 },
      }

  if (deviceId) {
    return { video: { deviceId: { exact: deviceId }, ...resolution } }
  }

  if (isMobile) {
    return { video: { facingMode: { ideal: 'environment' }, ...resolution } }
  }

  return { video: resolution }
}

async function loadZxingBundle() {
  if (!zxingBundlePromise) {
    zxingBundlePromise = Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]).then(([{ BrowserMultiFormatReader }, library]) => {
      const hints = new Map()
      hints.set(library.DecodeHintType.POSSIBLE_FORMATS, [
        library.BarcodeFormat.EAN_13,
        library.BarcodeFormat.EAN_8,
        library.BarcodeFormat.UPC_A,
        library.BarcodeFormat.UPC_E,
        library.BarcodeFormat.CODE_128,
        library.BarcodeFormat.CODE_39,
      ])
      hints.set(library.DecodeHintType.TRY_HARDER, false)

      zxingReader = new BrowserMultiFormatReader(hints)
      return { BrowserMultiFormatReader, reader: zxingReader }
    })
  }

  return zxingBundlePromise
}

export function preloadBarcodeScanner() {
  void loadZxingBundle()
}

async function createNativeDetector() {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
    return null
  }

  try {
    const supported = await window.BarcodeDetector.getSupportedFormats()
    const formats = NATIVE_FORMATS.filter((format) => supported.includes(format))
    if (formats.length === 0) {
      return null
    }

    return new window.BarcodeDetector({ formats })
  } catch {
    return null
  }
}

function stopMediaStream(video) {
  if (video?.srcObject instanceof MediaStream) {
    video.srcObject.getTracks().forEach((track) => track.stop())
    video.srcObject = null
  }
}

function startNativeScanner({ video, deviceId, onDetect, isMobile }) {
  let running = true
  let rafId = null
  let detecting = false
  let lastDetectAt = 0

  const tick = (timestamp) => {
    if (!running) return

    rafId = requestAnimationFrame(tick)

    if (detecting || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      return
    }

    if (timestamp - lastDetectAt < 40) {
      return
    }

    lastDetectAt = timestamp
    detecting = true

    void detector
      .detect(video)
      .then((barcodes) => {
        const value = barcodes[0]?.rawValue?.trim()
        if (value) {
          onDetect(value)
        }
      })
      .catch(() => {
        // Ignore intermittent detection errors while the camera warms up.
      })
      .finally(() => {
        detecting = false
      })
  }

  let detector

  return createNativeDetector()
    .then(async (nativeDetector) => {
      if (!nativeDetector) {
        return null
      }

      detector = nativeDetector
      const stream = await navigator.mediaDevices.getUserMedia(getVideoConstraints(isMobile, deviceId))
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      await video.play()
      rafId = requestAnimationFrame(tick)

      return {
        mode: 'native',
        stop() {
          running = false
          if (rafId !== null) {
            cancelAnimationFrame(rafId)
          }
          stopMediaStream(video)
        },
      }
    })
}

async function startZxingScanner({ video, deviceId, onDetect, isMobile }) {
  const { reader } = await loadZxingBundle()

  const onDecode = (result) => {
    const value = result?.getText?.()?.trim()
    if (value) {
      onDetect(value)
    }
  }

  let controls
  if (deviceId) {
    controls = await reader.decodeFromVideoDevice(deviceId, video, onDecode)
  } else {
    controls = await reader.decodeFromConstraints(getVideoConstraints(isMobile), video, onDecode)
  }

  return {
    mode: 'zxing',
    stop() {
      controls?.stop()
      stopMediaStream(video)
    },
  }
}

export async function startBarcodeScanner({ video, deviceId, onDetect }) {
  const isMobile = isMobileDevice()
  const nativeScanner = await startNativeScanner({ video, deviceId, onDetect, isMobile })

  if (nativeScanner) {
    return nativeScanner
  }

  return startZxingScanner({ video, deviceId, onDetect, isMobile })
}

export async function listCameraDevices() {
  try {
    const { BrowserMultiFormatReader } = await loadZxingBundle()
    return BrowserMultiFormatReader.listVideoInputDevices()
  } catch {
    return []
  }
}
