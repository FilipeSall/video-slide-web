import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Presentation } from '../../entities/presentation/types'
import { playbackModeLabels } from '../../entities/video/types'

type PresentationPlayerProps = {
  presentation: Presentation
  onClose: () => void
}

export function PresentationPlayer({ presentation, onClose }: PresentationPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videos = useMemo(
    () => presentation.videos.slice().sort((a, b) => a.order - b.order),
    [presentation.videos],
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [areControlsVisible, setAreControlsVisible] = useState(false)
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentVideo = videos[currentIndex]

  const revealControls = useCallback(() => {
    setAreControlsVisible(true)

    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
    }

    hideControlsTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false)
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current)
      }
    }
  }, [])

  function advance() {
    setIsWaiting(false)

    if (currentIndex >= videos.length - 1) {
      setIsFinished(true)
      return
    }

    setCurrentIndex((index) => index + 1)
  }

  function goBack() {
    setIsWaiting(false)
    setIsFinished(false)
    setCurrentIndex((index) => Math.max(0, index - 1))
  }

  function handleEnded() {
    if (!currentVideo) {
      return
    }

    if (currentVideo.playbackMode === 'autoAdvance') {
      advance()
      return
    }

    if (currentVideo.playbackMode === 'pauseAtEnd') {
      setIsWaiting(true)
    }
  }

  if (!currentVideo || isFinished) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-primary-dark p-6 text-white">
        <section className="w-full max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-mint">Fim</p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight">Apresentacao concluida</h1>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              className="button-on-dark"
              type="button"
              onClick={() => {
                setCurrentIndex(0)
                setIsFinished(false)
              }}
            >
              Reproduzir novamente
            </button>
            <button className="button-on-dark-muted" type="button" onClick={onClose}>
              Voltar ao editor
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main
      className="relative flex min-h-screen flex-col bg-primary-dark text-white"
      onMouseMove={revealControls}
    >
      <header
        className={`player-controls absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-primary-dark/95 px-4 py-3 backdrop-blur transition-opacity duration-300 focus-within:pointer-events-auto focus-within:opacity-100 ${
          areControlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={areControlsVisible ? undefined : true}
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-mint">
            {currentIndex + 1} / {videos.length} · {playbackModeLabels[currentVideo.playbackMode]}
          </p>
          <h1 className="truncate font-display text-xl font-black sm:text-2xl">
            {presentation.title}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            className="button-on-dark-muted"
            type="button"
            disabled={currentIndex === 0}
            onClick={goBack}
          >
            Anterior
          </button>
          <button className="button-on-dark-muted" type="button" onClick={advance}>
            Proximo
          </button>
          <button className="button-on-dark" type="button" onClick={onClose}>
            Sair
          </button>
        </div>
      </header>

      <section className="relative flex flex-1 items-center justify-center bg-black">
        <video
          ref={videoRef}
          key={currentVideo.id}
          autoPlay
          className="h-full max-h-screen w-full object-contain"
          controls
          loop={currentVideo.playbackMode === 'loop'}
          src={currentVideo.downloadUrl}
          onEnded={handleEnded}
        />

        {isWaiting && (
          <div className="absolute inset-x-0 bottom-6 mx-auto w-[min(92vw,34rem)] rounded-xl border border-white/15 bg-primary-dark/92 p-4 text-center shadow-panel backdrop-blur">
            <p className="font-semibold">Video pausado ao final.</p>
            <button className="button-on-dark mt-3" type="button" onClick={advance}>
              Avancar
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
