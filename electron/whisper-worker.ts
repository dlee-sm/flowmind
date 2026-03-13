/**
 * Node.js Worker Thread that owns the Whisper pipeline.
 *
 * Running inference here keeps the Electron main thread free so the app
 * never freezes during transcription (ML is CPU-intensive and blocks
 * the thread it runs on).
 */
import { parentPort, workerData } from 'worker_threads'

interface WorkerInit {
  cacheDir: string
}

interface TranscribeMsg {
  type: 'transcribe'
  id: string
  samples: Float32Array
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: any = null

// Store the init promise so the message handler can await it.
// If a transcription request arrives before the model finishes loading
// (e.g. user records immediately on first launch), we wait for init to
// complete rather than calling _pipeline while it is still null.
const _initPromise: Promise<void> = (async () => {
  const { pipeline, env } = await import('@xenova/transformers')
  const { cacheDir } = workerData as WorkerInit
  env.cacheDir = cacheDir
  env.allowLocalModels = false
  _pipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
    quantized: true,
    // Forward download/load progress so the renderer can show a progress bar.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    progress_callback: (p: any) => {
      parentPort?.postMessage({ type: 'progress', ...p })
    },
  })
  parentPort?.postMessage({ type: 'ready' })
})()

// Surface init failures to the main process so it can reject pending IPC calls.
_initPromise.catch((err) => {
  parentPort?.postMessage({
    type:    'init-error',
    message: err instanceof Error ? err.message : String(err),
  })
})

parentPort?.on('message', async (msg: TranscribeMsg) => {
  if (msg.type !== 'transcribe') return

  // Wait for the pipeline to be ready (no-op if init already completed).
  // This handles the race where the user finishes recording before the
  // model has finished downloading / loading on first launch.
  try {
    await _initPromise
  } catch (err) {
    parentPort?.postMessage({
      type:    'error',
      id:      msg.id,
      message: err instanceof Error ? err.message : 'Speech model failed to load.',
    })
    return
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // chunk_length_s / stride_length_s enable Whisper's long-form transcription:
    // the pipeline splits audio into overlapping 30-second windows, transcribes
    // each independently, then merges. Without this, accuracy degrades badly for
    // recordings longer than 30 seconds (Whisper's native context window).
    const result = await (_pipeline as any)(msg.samples, {
      sampling_rate:   16000,
      chunk_length_s:  30,    // process 30 s at a time (Whisper's context window)
      stride_length_s: 5,     // 5 s overlap between chunks for clean joins
    })
    parentPort?.postMessage({
      type: 'result',
      id:   msg.id,
      text: (result as { text: string }).text.trim(),
    })
  } catch (err) {
    parentPort?.postMessage({
      type:    'error',
      id:      msg.id,
      message: err instanceof Error ? err.message : String(err),
    })
  }
})
