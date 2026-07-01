import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { Presentation } from '../../entities/presentation/types'
import {
  playbackModeLabels,
  type PlaybackMode,
  type VideoItem,
} from '../../entities/video/types'
import {
  deletePresentationVideo,
  uploadPresentationVideo,
} from '../../shared/firebase/presentationRepository'
import { createId } from '../../shared/lib/file'
import { formatBytes, formatDateTime, formatDuration } from '../../shared/lib/format'
import { extractVideoMetadata } from '../../shared/lib/videoMetadata'

type PresentationEditorProps = {
  presentation: Presentation
  onBack: () => void
  onChange: (presentation: Presentation) => void
  onSave: (presentation: Presentation) => Promise<void>
  onStartPresentation: (presentation: Presentation) => void
}

type UploadState = {
  fileName: string
  progress: number
}

function sortVideos(videos: VideoItem[]) {
  return videos.slice().sort((a, b) => a.order - b.order)
}

function normalizeVideoOrder(videos: VideoItem[]) {
  return sortVideos(videos).map((video, index) => ({ ...video, order: index }))
}

export function PresentationEditor({
  presentation,
  onBack,
  onChange,
  onSave,
  onStartPresentation,
}: PresentationEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadState, setUploadState] = useState<UploadState | null>(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingVideoId, setDeletingVideoId] = useState('')
  const orderedVideos = useMemo(() => sortVideos(presentation.videos), [presentation.videos])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setError('')
    setUploadState({ fileName: file.name, progress: 4 })

    try {
      const metadata = await extractVideoMetadata(file)
      const videoId = createId()
      const uploadedAt = new Date().toISOString()
      const uploadResult = await uploadPresentationVideo(
        presentation.id,
        videoId,
        file,
        (progress) => setUploadState({ fileName: file.name, progress }),
      )

      const video: VideoItem = {
        id: videoId,
        order: orderedVideos.length,
        fileName: metadata.fileName,
        sizeBytes: metadata.sizeBytes,
        durationSeconds: metadata.durationSeconds,
        mimeType: metadata.mimeType,
        uploadedAt,
        storagePath: uploadResult.storagePath,
        downloadUrl: uploadResult.downloadUrl,
        playbackMode: 'pauseAtEnd',
      }

      onChange({
        ...presentation,
        videos: normalizeVideoOrder([...presentation.videos, video]),
        status: 'ready',
      })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Falha ao adicionar video.')
    } finally {
      setUploadState(null)
    }
  }

  function updatePresentationTitle(title: string) {
    onChange({ ...presentation, title })
  }

  function updateVideoMode(videoId: string, playbackMode: PlaybackMode) {
    onChange({
      ...presentation,
      videos: presentation.videos.map((video) =>
        video.id === videoId ? { ...video, playbackMode } : video,
      ),
    })
  }

  async function removeVideo(videoId: string) {
    const video = presentation.videos.find((currentVideo) => currentVideo.id === videoId)

    if (!video) {
      return
    }

    const title = presentation.title.trim()

    if (!title) {
      setError('Informe um titulo antes de remover videos.')
      return
    }

    setDeletingVideoId(videoId)
    setError('')

    try {
      const videos = normalizeVideoOrder(
        presentation.videos.filter((currentVideo) => currentVideo.id !== videoId),
      )
      const nextPresentation: Presentation = {
        ...presentation,
        title,
        videos,
        status: videos.length > 0 ? 'ready' : 'draft',
      }

      await onSave(nextPresentation)
      try {
        await deletePresentationVideo(video)
      } catch (assetError) {
        setError(
          assetError instanceof Error
            ? `Video removido da apresentacao, mas o arquivo nao foi apagado: ${assetError.message}`
            : 'Video removido da apresentacao, mas o arquivo nao foi apagado.',
        )
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Nao foi possivel remover o video.')
    } finally {
      setDeletingVideoId('')
    }
  }

  function moveVideo(videoId: string, direction: -1 | 1) {
    const videos = normalizeVideoOrder(presentation.videos)
    const currentIndex = videos.findIndex((video) => video.id === videoId)
    const nextIndex = currentIndex + direction

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= videos.length) {
      return
    }

    const nextVideos = videos.slice()
    const currentVideo = nextVideos[currentIndex]
    nextVideos[currentIndex] = nextVideos[nextIndex]
    nextVideos[nextIndex] = currentVideo

    onChange({ ...presentation, videos: normalizeVideoOrder(nextVideos) })
  }

  async function handleSave() {
    const title = presentation.title.trim()

    if (!title) {
      setError('Informe um titulo para salvar a apresentacao.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      await onSave({
        ...presentation,
        title,
        status: orderedVideos.length > 0 ? 'ready' : 'draft',
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 rounded-md border border-ink/10 bg-paper p-4 shadow-panel">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <button className="control-link" type="button" onClick={onBack}>
                Voltar para biblioteca
              </button>
              <input
                className="mt-3 w-full border-none bg-transparent font-display text-3xl font-black leading-tight text-ink outline-none sm:text-5xl"
                value={presentation.title}
                placeholder="Titulo da apresentacao"
                onChange={(event) => updatePresentationTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="button-secondary"
                type="button"
                disabled={isSaving}
                onClick={handleSave}
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                className="button-primary"
                type="button"
                disabled={orderedVideos.length === 0}
                onClick={() => onStartPresentation(presentation)}
              >
                Apresentar
              </button>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-ink/20 bg-white/70 p-5">
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
            />
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-rust">Upload</p>
                <p className="mt-1 max-w-2xl text-sm text-ink/65">
                  Adicione videos na ordem da apresentacao. Cada item pode ter um comportamento de
                  reproducao proprio.
                </p>
              </div>
              <button
                className="button-primary"
                type="button"
                disabled={Boolean(uploadState)}
                onClick={() => fileInputRef.current?.click()}
              >
                Adicionar video
              </button>
            </div>
            {uploadState && (
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-semibold text-ink">{uploadState.fileName}</span>
                  <span className="text-ink/65">{uploadState.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="h-full rounded-full bg-rust transition-all"
                    style={{ width: `${uploadState.progress}%` }}
                  />
                </div>
              </div>
            )}
            {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>
        </div>

        <aside className="rounded-md border border-ink/10 bg-ink p-4 text-paper shadow-panel">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">Resumo</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-paper/50">Videos</dt>
              <dd className="text-2xl font-black">{orderedVideos.length}</dd>
            </div>
            <div>
              <dt className="text-paper/50">Duracao</dt>
              <dd className="text-2xl font-black">
                {formatDuration(
                  orderedVideos.reduce((total, video) => total + video.durationSeconds, 0),
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-paper/50">Atualizado</dt>
              <dd className="font-semibold">{formatDateTime(presentation.updatedAt)}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="grid gap-4">
        {orderedVideos.length === 0 ? (
          <div className="rounded-md border border-ink/10 bg-paper p-8 text-center shadow-panel">
            <p className="font-display text-2xl font-black text-ink">Nenhum video adicionado</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-ink/65">
              Use o upload para montar a primeira sequencia. O modo apresentacao sera liberado assim
              que existir pelo menos um video.
            </p>
          </div>
        ) : (
          orderedVideos.map((video, index) => (
            <article
              className="grid gap-4 rounded-md border border-ink/10 bg-paper p-4 shadow-panel lg:grid-cols-[10rem_minmax(0,1fr)_18rem]"
              key={video.id}
            >
              <div className="aspect-video overflow-hidden rounded bg-ink">
                <video className="h-full w-full object-cover" muted src={video.downloadUrl} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-rust">
                      Video {index + 1}
                    </p>
                    <h2 className="mt-1 truncate font-display text-2xl font-black text-ink">
                      {video.fileName}
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="button-compact"
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveVideo(video.id, -1)}
                    >
                      Subir
                    </button>
                    <button
                      className="button-compact"
                      type="button"
                      disabled={index === orderedVideos.length - 1}
                      onClick={() => moveVideo(video.id, 1)}
                    >
                      Descer
                    </button>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-sm text-ink/70 sm:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <dt className="font-semibold text-ink">Tamanho</dt>
                    <dd>{formatBytes(video.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Duracao</dt>
                    <dd>{formatDuration(video.durationSeconds)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">MIME</dt>
                    <dd>{video.mimeType}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Upload</dt>
                    <dd>{formatDateTime(video.uploadedAt)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-semibold text-ink">Storage</dt>
                    <dd className="truncate">{video.storagePath}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-ink" htmlFor={`mode-${video.id}`}>
                  Comportamento
                </label>
                <select
                  className="input-field"
                  id={`mode-${video.id}`}
                  value={video.playbackMode}
                  onChange={(event) => updateVideoMode(video.id, event.target.value as PlaybackMode)}
                >
                  {Object.entries(playbackModeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  className="button-danger mt-auto"
                  type="button"
                  disabled={deletingVideoId === video.id}
                  onClick={() => void removeVideo(video.id)}
                >
                  {deletingVideoId === video.id ? 'Removendo...' : 'Remover'}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}
