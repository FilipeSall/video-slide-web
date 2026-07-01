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
      await deletePresentationVideo(video)

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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="sea-card min-w-0 p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <button className="control-link" type="button" onClick={onBack}>
                Voltar para biblioteca
              </button>
              <input
                aria-label="Titulo da apresentacao"
                className="title-input mt-3 font-display text-3xl font-black leading-tight sm:text-5xl"
                value={presentation.title}
                placeholder="Digite o titulo da apresentacao"
                onChange={(event) => updatePresentationTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
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

          <div className="rounded-xl border border-dashed border-primary/25 bg-surface p-5">
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
            />
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="sea-kicker">Upload</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
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
                  <span className="text-muted">{uploadState.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${uploadState.progress}%` }}
                  />
                </div>
              </div>
            )}
            {error && <p className="error-message mt-4">{error}</p>}
          </div>
        </div>

        <aside className="rounded-xl border border-primary-dark/10 bg-primary-dark p-5 text-white shadow-panel">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-mint">Resumo</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-white/65">Videos</dt>
              <dd className="text-2xl font-black">{orderedVideos.length}</dd>
            </div>
            <div>
              <dt className="text-white/65">Duracao</dt>
              <dd className="text-2xl font-black">
                {formatDuration(
                  orderedVideos.reduce((total, video) => total + video.durationSeconds, 0),
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-white/65">Atualizado</dt>
              <dd className="font-semibold">{formatDateTime(presentation.updatedAt)}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="grid gap-4">
        {orderedVideos.length === 0 ? (
          <div className="sea-card p-8 text-center">
            <p className="font-display text-2xl font-black text-ink">Nenhum video adicionado</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
              Use o upload para montar a primeira sequencia. O modo apresentacao sera liberado assim
              que existir pelo menos um video.
            </p>
          </div>
        ) : (
          orderedVideos.map((video, index) => (
            <article
              className="sea-card grid gap-4 p-4 transition hover:border-primary/30 lg:grid-cols-[10rem_minmax(0,1fr)_18rem]"
              key={video.id}
            >
              <div className="aspect-video overflow-hidden rounded-lg bg-primary-dark">
                <video className="h-full w-full object-cover" muted src={video.downloadUrl} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="sea-kicker">
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

                <dl className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2 xl:grid-cols-3">
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
