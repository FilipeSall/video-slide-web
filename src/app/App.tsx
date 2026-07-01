import { useEffect, useMemo, useState } from 'react'
import type { Presentation } from '../entities/presentation/types'
import { PresentationEditor } from '../features/presentation-editor/PresentationEditor'
import { PresentationPlayer } from '../features/presentation-player/PresentationPlayer'
import {
  deletePresentation,
  getPersistenceLabel,
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
    title: 'Nova apresentacao',
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
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-md border border-ink/10 bg-paper p-5 shadow-panel">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-rust">Biblioteca</p>
            <h1 className="mt-2 max-w-4xl font-display text-4xl font-black leading-none text-ink sm:text-6xl">
              Sequencias de video prontas para apresentar
            </h1>
          </div>
          <div className="rounded-md border border-ink/10 bg-mint p-5 shadow-panel">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-ink/60">Persistencia</p>
            <p className="mt-4 font-display text-3xl font-black">{getPersistenceLabel()}</p>
            <p className="mt-3 text-sm text-ink/65">
              Configure as variaveis Firebase para usar Firestore e Storage em vez do modo local.
            </p>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-md border border-ink/10 bg-paper p-8 text-center shadow-panel">
            Carregando apresentacoes...
          </div>
        ) : presentations.length === 0 ? (
          <section className="rounded-md border border-dashed border-ink/20 bg-paper p-10 text-center shadow-panel">
            <p className="font-display text-3xl font-black">Nenhuma apresentacao salva</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-ink/65">
              Crie a primeira apresentacao para adicionar videos, configurar comportamento e iniciar o
              modo apresentacao.
            </p>
            <button className="button-primary mt-6" type="button" onClick={createNewPresentation}>
              Criar apresentacao
            </button>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {presentations.map((presentation) => {
              const duration = presentation.videos.reduce(
                (total, video) => total + video.durationSeconds,
                0,
              )

              return (
                <article
                  className="flex min-h-72 flex-col rounded-md border border-ink/10 bg-paper p-4 shadow-panel"
                  key={presentation.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rust">
                        {presentation.videos.length} videos
                      </p>
                      <h2 className="mt-2 line-clamp-2 font-display text-3xl font-black leading-none">
                        {presentation.title}
                      </h2>
                    </div>
                    <span className="rounded bg-ink px-2 py-1 text-xs font-bold uppercase text-paper">
                      {presentation.status}
                    </span>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm text-ink/65">
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
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-canvas/92 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div>
          <p className="font-display text-xl font-black uppercase tracking-[0.08em]">Video Slide</p>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">
            Studio interno
          </p>
        </div>
        <button className="button-primary" type="button" onClick={onCreate}>
          Nova apresentacao
        </button>
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
    <div className="fixed bottom-4 right-4 z-30 flex max-w-sm items-center gap-3 rounded-md border border-ink/10 bg-paper p-3 text-sm shadow-panel">
      <span>{message}</span>
      <button className="control-link" type="button" onClick={onClose}>
        Fechar
      </button>
    </div>
  )
}
