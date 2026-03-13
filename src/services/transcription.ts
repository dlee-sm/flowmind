import { pipeline, env } from '@xenova/transformers'

// Use the browser's built-in cache (IndexedDB via transformers.js).
// Model is ~39 MB for whisper-tiny.en (quantized) — downloaded once, cached forever.
env.useBrowserCache = true
env.allowLocalModels  = false

export type ModelProgress =
  | { status: 'downloading'; progress: number }
  | { status: 'loading' }
  | { status: 'ready' }

type ProgressCb = (p: ModelProgress) => void

let _pipeline: Awaited<ReturnType<typeof pipeline>> | null = null
let _loadPromise: Promise<void> | null = null

/**
 * Load (or return the already-loaded) Whisper pipeline.
 * Safe to call multiple times — subsequent calls share the same promise.
 */
export function loadModel(onProgress?: ProgressCb): Promise<void> {
  if (_loadPromise) return _loadPromise

  _loadPromise = pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny.en',
    {
      quantized: true,
      progress_callback: (info: Record<string, unknown>) => {
        if (!onProgress) return
        if (info.status === 'progress') {
          const pct = typeof info.progress === 'number' ? Math.round(info.progress) : 0
          onProgress({ status: 'downloading', progress: pct })
        } else if (info.status === 'initiate') {
          onProgress({ status: 'loading' })
        } else if (info.status === 'ready') {
          onProgress({ status: 'ready' })
        }
      },
    },
  ).then((p) => {
    _pipeline = p
  }).catch((err) => {
    // Reset so the next call retries
    _loadPromise = null
    throw err
  })

  return _loadPromise
}

export function isModelReady(): boolean {
  return _pipeline !== null
}

/**
 * Transcribe a mono Float32Array of audio samples.
 * Will wait for the model to finish loading if it hasn't yet.
 */
export async function transcribeAudio(
  samples: Float32Array,
  sampleRate: number,
): Promise<string> {
  // Ensure model is ready
  await loadModel()
  if (!_pipeline) throw new Error('Whisper model failed to load.')

  // Resample to 16 kHz if the recording device uses a different rate
  let audio = samples
  if (sampleRate !== 16000) {
    const duration  = samples.length / sampleRate
    const offCtx    = new OfflineAudioContext(1, Math.ceil(duration * 16000), 16000)
    const buffer    = offCtx.createBuffer(1, samples.length, sampleRate)
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
    const src = offCtx.createBufferSource()
    src.buffer = buffer
    src.connect(offCtx.destination)
    src.start()
    const resampled = await offCtx.startRendering()
    audio = resampled.getChannelData(0)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (_pipeline as any)(audio, { sampling_rate: 16000 })
  return (result as { text: string }).text.trim()
}
