export type PlaybackMode = 'loop' | 'pauseAtEnd' | 'autoAdvance'

export type VideoItem = {
  id: string
  order: number
  fileName: string
  sizeBytes: number
  durationSeconds: number
  mimeType: string
  uploadedAt: string
  storagePath: string
  downloadUrl: string
  playbackMode: PlaybackMode
}

export const playbackModeLabels: Record<PlaybackMode, string> = {
  loop: 'Reproduzir em loop',
  pauseAtEnd: 'Pausar ao final',
  autoAdvance: 'Avancar automaticamente',
}
