type TranscriptCallback   = (text: string, isFinal: boolean) => void
type EndCallback          = () => void
type ErrorCallback        = (error: string) => void
type TranscribingCallback = () => void
type LevelCallback        = (rms: number) => void

// ── AudioWorklet processor code ───────────────────────────────────────────────
// Runs on the dedicated AudioWorkletGlobalScope thread — NOT the renderer main
// thread. Using AudioWorklet instead of the deprecated ScriptProcessorNode
// avoids the Chromium native-audio-thread crash that occurred with the old API.
//
// Each process() call delivers 128 samples. We forward PCM chunks for
// transcription and send an RMS level value every 10 frames (~29 ms) for the
// audio-level visualisation.
const WORKLET_CODE = /* js */ `
class PCMProcessor extends AudioWorkletProcessor {
  constructor () {
    super()
    this._frame = 0
  }
  process (inputs, _outputs, _params) {
    const ch = inputs[0]?.[0]
    if (ch && ch.length) {
      // Transfer PCM chunk (zero-copy via ArrayBuffer transfer)
      const copy = ch.slice()
      this.port.postMessage({ type: 'pcm', data: copy }, [copy.buffer])
      // Level every 10 frames — keep visualisation smooth without flooding IPC
      if (++this._frame % 10 === 0) {
        let s = 0
        for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i]
        this.port.postMessage({ type: 'level', rms: Math.sqrt(s / ch.length) })
      }
    }
    return true
  }
}
registerProcessor('pcm-processor', PCMProcessor)
`

/**
 * Captures microphone audio via the Web Audio API + AudioWorklet.
 * Resamples to 16 kHz, then forwards samples to the Electron main process
 * for on-device Whisper transcription.
 *
 * AudioWorklet (rather than the deprecated ScriptProcessorNode) runs on the
 * audio thread — it cannot block the renderer and avoids the native crash that
 * plagued the previous implementation.
 */
export class SpeechService {
  private stream:   MediaStream               | null = null
  private audioCtx: AudioContext              | null = null
  private source:   MediaStreamAudioSourceNode | null = null
  private worklet:  AudioWorkletNode          | null = null
  private silentOut: GainNode                 | null = null
  private chunks:   Float32Array[]                   = []
  private totalSamples = 0

  private onTranscriptCb:   TranscriptCallback   | null = null
  private onEndCb:          EndCallback           | null = null
  private onErrorCb:        ErrorCallback         | null = null
  private onTranscribingCb: TranscribingCallback  | null = null
  private onLevelCb:        LevelCallback         | null = null

  private _isListening = false

  isSupported(): boolean {
    return true
  }

  start(): void {
    if (this._isListening) return
    this._doStart().catch((err) => {
      this._isListening = false
      const msg = err instanceof Error ? err.message : 'Failed to start recording.'
      this.onErrorCb?.(msg)
    })
  }

  private async _doStart(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err: unknown) => {
      if (err instanceof Error &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        throw new Error(
          'Microphone access denied. Please allow microphone in System Preferences → Privacy & Security → Microphone.',
        )
      }
      throw err
    })

    this.chunks       = []
    this.totalSamples = 0
    this.audioCtx     = new AudioContext()
    this.source       = this.audioCtx.createMediaStreamSource(this.stream)

    // Load the AudioWorklet processor from an inline Blob URL.
    // Blob URLs work in Electron's renderer because no restrictive CSP is set.
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
    const url  = URL.createObjectURL(blob)
    try {
      await this.audioCtx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }

    this.worklet = new AudioWorkletNode(this.audioCtx, 'pcm-processor')
    this.worklet.port.onmessage = (
      e: MessageEvent<{ type: string; data?: ArrayBuffer; rms?: number }>
    ) => {
      if (e.data.type === 'pcm' && e.data.data) {
        const chunk = new Float32Array(e.data.data)
        this.chunks.push(chunk)
        this.totalSamples += chunk.length
      } else if (e.data.type === 'level' && e.data.rms !== undefined) {
        this.onLevelCb?.(e.data.rms)
      }
    }

    // A silent gain node connected to destination keeps the audio graph "alive"
    // (AudioWorklet only processes when the graph is being pulled).
    // gain = 0 ensures no audible output — no feedback, no echo.
    this.silentOut = this.audioCtx.createGain()
    this.silentOut.gain.value = 0
    this.silentOut.connect(this.audioCtx.destination)

    this.source.connect(this.worklet)
    this.worklet.connect(this.silentOut)

    this._isListening = true
  }

  stop(): void {
    if (!this._isListening) return
    this._isListening = false

    // Disconnect the audio graph so the worklet stops firing
    this.worklet?.disconnect()
    this.source?.disconnect()
    this.silentOut?.disconnect()

    // Stop the microphone track
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null

    // Immediately signal the UI that transcription is starting
    this.onTranscribingCb?.()

    this._processAudio().catch((err) => {
      const msg = err instanceof Error ? err.message : 'Transcription failed.'
      this.onErrorCb?.(msg)
      this.onEndCb?.()
    })
  }

  private async _processAudio(): Promise<void> {
    if (this.totalSamples === 0) {
      this.onErrorCb?.('No audio recorded.')
      this.onEndCb?.()
      return
    }

    // Concatenate all chunks into a single Float32Array
    const raw = new Float32Array(this.totalSamples)
    let offset = 0
    for (const chunk of this.chunks) {
      raw.set(chunk, offset)
      offset += chunk.length
    }
    this.chunks = []

    const srcRate = this.audioCtx?.sampleRate ?? 44100
    await this.audioCtx?.close()
    this.audioCtx  = null
    this.source    = null
    this.worklet   = null
    this.silentOut = null

    // Resample to 16 kHz (Whisper's required input rate)
    let samples = raw
    if (srcRate !== 16000) {
      const duration = raw.length / srcRate
      const offCtx   = new OfflineAudioContext(1, Math.ceil(duration * 16000), 16000)
      const buf      = offCtx.createBuffer(1, raw.length, srcRate)
      buf.copyToChannel(raw, 0)
      const src = offCtx.createBufferSource()
      src.buffer = buf
      src.connect(offCtx.destination)
      src.start()
      const resampled = await offCtx.startRendering()
      samples = resampled.getChannelData(0)
    }

    const text = await window.electronAPI.transcribeAudio(samples)
    if (text) this.onTranscriptCb?.(text, true)
    this.onEndCb?.()
  }

  destroy(): void {
    if (this._isListening) this.stop()
    this.onTranscriptCb   = null
    this.onEndCb          = null
    this.onErrorCb        = null
    this.onTranscribingCb = null
    this.onLevelCb        = null
  }

  onTranscript  (cb: TranscriptCallback):   void { this.onTranscriptCb   = cb }
  onEnd         (cb: EndCallback):           void { this.onEndCb          = cb }
  onError       (cb: ErrorCallback):         void { this.onErrorCb        = cb }
  onTranscribing(cb: TranscribingCallback):  void { this.onTranscribingCb = cb }
  onLevel       (cb: LevelCallback):         void { this.onLevelCb        = cb }
}
