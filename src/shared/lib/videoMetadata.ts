export type ExtractedVideoMetadata = {
  fileName: string
  sizeBytes: number
  durationSeconds: number
  mimeType: string
}

export function extractVideoMetadata(file: File): Promise<ExtractedVideoMetadata> {
  if (!file.type.startsWith('video/')) {
    return Promise.reject(new Error('Selecione um arquivo de video valido.'))
  }

  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')

  return new Promise((resolve, reject) => {
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({
        fileName: file.name,
        sizeBytes: file.size,
        durationSeconds: video.duration,
        mimeType: file.type || 'video/desconhecido',
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Nao foi possivel ler os metadados do video.'))
    }

    video.src = objectUrl
  })
}
