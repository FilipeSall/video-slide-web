import { useEffect, useMemo, useState } from 'react'
import type { Presentation } from '../entities/presentation/types'
import { PresentationEditor } from '../features/presentation-editor/PresentationEditor'
import { PresentationPlayer } from '../features/presentation-player/PresentationPlayer'
import {
  deletePresentation,
  listPresentations,
  savePresentation,
} from '../shared/firebase/presentationRepository'
import { createId } from '../shared/lib/file'
import { formatDateTime, formatDuration } from '../shared/lib/format'

type ViewState =
  | { name: 'library' }
  | { name: 'editor'; presentationId: string }
  | { name: 'player'; presentationId: string }

function createPresentation(): Presentation {
  const now = new Date().toISOString()

  return {
    id: createId(),
    title: '',
    videos: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
}

export default function App() {
  const [presentations, setPresentations] = useState<Presentation[]>([])
  const [view, setView] = useState<ViewState>({ name: 'library' })
  const [isLoading, setIsLoading] = useState(true)
  const [deletingPresentationId, setDeletingPresentationId] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    listPresentations()
      .then(setPresentations)
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : 'Nao foi possivel carregar apresentacoes.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const activePresentation = useMemo(() => {
    if (view.name === 'library') {
      return null
    }

    return presentations.find((presentation) => presentation.id === view.presentationId) ?? null
  }, [presentations, view])

  function createNewPresentation() {
    const presentation = createPresentation()
    setPresentations((currentPresentations) => [presentation, ...currentPresentations])
    setView({ name: 'editor', presentationId: presentation.id })
  }

  function updatePresentation(nextPresentation: Presentation) {
    setPresentations((currentPresentations) =>
      currentPresentations.map((presentation) =>
        presentation.id === nextPresentation.id ? nextPresentation : presentation,
      ),
    )
  }

  async function persistPresentation(presentation: Presentation) {
    const savedPresentation = await savePresentation(presentation)
    updatePresentation(savedPresentation)
    setNotice('Apresentacao salva.')
  }

  async function removePresentation(presentation: Presentation) {
    setDeletingPresentationId(presentation.id)
    setNotice('')

    try {
      await deletePresentation(presentation)
      setPresentations((currentPresentations) =>
        currentPresentations.filter((currentPresentation) => currentPresentation.id !== presentation.id),
      )
      setNotice('Apresentacao excluida.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Nao foi possivel excluir a apresentacao.')
    } finally {
      setDeletingPresentationId('')
    }
  }

  if (view.name === 'player' && activePresentation) {
    return (
      <PresentationPlayer
        presentation={activePresentation}
        onClose={() => setView({ name: 'editor', presentationId: activePresentation.id })}
      />
    )
  }

  if (view.name === 'editor' && activePresentation) {
    return (
      <div className="min-h-screen bg-canvas text-ink">
        <AppHeader onCreate={createNewPresentation} />
        <PresentationEditor
          presentation={activePresentation}
          onBack={() => setView({ name: 'library' })}
          onChange={updatePresentation}
          onSave={persistPresentation}
          onStartPresentation={(presentation) => setView({ name: 'player', presentationId: presentation.id })}
        />
        {notice && <Toast message={notice} onClose={() => setNotice('')} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader onCreate={createNewPresentation} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section>
          <div className="sea-card overflow-hidden p-6 sm:p-8">
            <p className="sea-kicker">Biblioteca corporativa</p>
            <h1 className="mt-3 max-w-4xl font-display text-3xl font-black leading-tight text-ink sm:text-5xl">
              Sequencias de video organizadas para comunicacao institucional
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Monte apresentacoes com videos, preserve a ordem da narrativa e inicie o modo de
              exibicao com controles claros para equipes internas e comunicacao corporativa.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="button-primary" type="button" onClick={createNewPresentation}>
                Nova apresentacao
              </button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="sea-card p-8 text-center text-muted">
            Carregando apresentacoes...
          </div>
        ) : presentations.length === 0 ? (
          <section
            className="sea-panel border-dashed p-10 text-center"
            id="presentations"
          >
            <p className="font-display text-3xl font-black text-ink">Nenhuma apresentacao salva</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
              Crie a primeira apresentacao para adicionar videos, configurar comportamento e iniciar o
              modo apresentacao.
            </p>
            <button className="button-primary mt-6" type="button" onClick={createNewPresentation}>
              Criar apresentacao
            </button>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" id="presentations">
            {presentations.map((presentation) => {
              const duration = presentation.videos.reduce(
                (total, video) => total + video.durationSeconds,
                0,
              )

              return (
                <article
                  className="sea-card flex min-h-72 flex-col p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-panel"
                  key={presentation.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="sea-kicker">
                        {presentation.videos.length} videos
                      </p>
                      <h2 className="mt-2 line-clamp-2 font-display text-2xl font-black leading-tight text-ink">
                        {presentation.title.trim() || 'Sem titulo'}
                      </h2>
                    </div>
                    <span className="status-pill">
                      {presentation.status}
                    </span>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm text-muted">
                    <div>
                      <dt className="font-semibold text-ink">Duracao</dt>
                      <dd>{formatDuration(duration)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">Atualizado</dt>
                      <dd>{formatDateTime(presentation.updatedAt)}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex flex-wrap gap-2 pt-6">
                    <button
                      className="button-primary"
                      type="button"
                      onClick={() => setView({ name: 'editor', presentationId: presentation.id })}
                    >
                      Editar
                    </button>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={presentation.videos.length === 0}
                      onClick={() => setView({ name: 'player', presentationId: presentation.id })}
                    >
                      Apresentar
                    </button>
                    <button
                      className="button-danger"
                      type="button"
                      disabled={deletingPresentationId === presentation.id}
                      onClick={() => void removePresentation(presentation)}
                    >
                      {deletingPresentationId === presentation.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>
      {notice && <Toast message={notice} onClose={() => setNotice('')} />}
    </div>
  )
}

type AppHeaderProps = {
  onCreate: () => void
}

function AppHeader({ onCreate }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white/95 px-4 py-3 shadow-[0_1px_0_rgb(226_232_240)] backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <img
            alt=""
            className="size-9 shrink-0 rounded-full border border-accent/30 object-cover sm:size-10"
            src="/logo.webp"
          />
          <div className="min-w-0">
            <p className="font-display text-base font-black text-ink sm:text-lg">SEA Tecnologia</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="button-primary" type="button" onClick={onCreate}>
            Nova apresentacao
          </button>
        </div>
      </div>
    </header>
  )
}

type ToastProps = {
  message: string
  onClose: () => void
}

function Toast({ message, onClose }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-30 flex max-w-sm items-center gap-3 rounded-lg border border-border bg-white p-3 text-sm text-ink shadow-panel">
      <span>{message}</span>
      <button className="control-link" type="button" aria-label="Fechar aviso" onClick={onClose}>
        Fechar
      </button>
    </div>
  )
}
