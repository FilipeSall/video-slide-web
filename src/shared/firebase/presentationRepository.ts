import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from 'firebase/storage'
import type { Presentation } from '../../entities/presentation/types'
import type { VideoItem } from '../../entities/video/types'
import { sanitizeFileName } from '../lib/file'
import { deleteLocalVideo, getLocalVideoUrl, saveLocalVideo } from '../lib/localVideoStore'
import { getFirebaseServices, hasFirebaseConfig } from './config'

const localStorageKey = 'video-slide-web:presentations'

type UploadResult = {
  storagePath: string
  downloadUrl: string
}

function isMissingStorageObject(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'storage/object-not-found'
  )
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId))
  })
}

function readLocalPresentations() {
  const rawValue = localStorage.getItem(localStorageKey)

  if (!rawValue) {
    return []
  }

  try {
    return JSON.parse(rawValue) as Presentation[]
  } catch {
    localStorage.removeItem(localStorageKey)
    return []
  }
}

function writeLocalPresentations(presentations: Presentation[]) {
  localStorage.setItem(localStorageKey, JSON.stringify(presentations))
}

async function hydrateLocalVideos(presentations: Presentation[]) {
  return Promise.all(
    presentations.map(async (presentation) => ({
      ...presentation,
      videos: await Promise.all(
        presentation.videos.map(async (video) => {
          if (!video.storagePath.startsWith('local-preview://')) {
            return video
          }

          return {
            ...video,
            downloadUrl: (await getLocalVideoUrl(video.storagePath)) || video.downloadUrl,
          }
        }),
      ),
    })),
  )
}

export async function listPresentations() {
  const services = getFirebaseServices()

  if (!services) {
    const presentations = await hydrateLocalVideos(readLocalPresentations())

    return presentations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  const presentationsQuery = query(collection(services.db, 'presentations'), orderBy('updatedAt', 'desc'))
  const snapshot = await withTimeout(
    getDocs(presentationsQuery),
    8000,
    'Firebase configurado, mas o Firestore nao respondeu. Verifique se o banco foi criado e se as regras permitem leitura.',
  )

  return snapshot.docs.map((presentationDoc) => presentationDoc.data() as Presentation)
}

export async function savePresentation(presentation: Presentation) {
  const normalizedPresentation: Presentation = {
    ...presentation,
    videos: presentation.videos
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((video, index) => ({ ...video, order: index })),
    updatedAt: new Date().toISOString(),
  }

  const services = getFirebaseServices()

  if (!services) {
    const presentations = readLocalPresentations()
    const nextPresentations = [
      normalizedPresentation,
      ...presentations.filter((item) => item.id !== normalizedPresentation.id),
    ]

    writeLocalPresentations(nextPresentations)
    return normalizedPresentation
  }

  await withTimeout(
    setDoc(doc(services.db, 'presentations', normalizedPresentation.id), normalizedPresentation),
    12000,
    'Firebase configurado, mas o Firestore nao respondeu ao salvar. Verifique regras de escrita e criacao do banco.',
  )
  return normalizedPresentation
}

export async function deletePresentationVideo(video: Pick<VideoItem, 'storagePath'>) {
  if (video.storagePath.startsWith('local-preview://')) {
    await deleteLocalVideo(video.storagePath)
    return
  }

  const services = getFirebaseServices()

  if (!services) {
    return
  }

  try {
    await withTimeout(
      deleteObject(ref(services.storage, video.storagePath)),
      8000,
      'Firebase Storage nao respondeu ao excluir o video.',
    )
  } catch (error) {
    if (!isMissingStorageObject(error)) {
      throw error
    }
  }
}

export async function deletePresentation(presentation: Presentation) {
  await Promise.all(presentation.videos.map((video) => deletePresentationVideo(video)))

  const services = getFirebaseServices()

  if (!services) {
    writeLocalPresentations(readLocalPresentations().filter((item) => item.id !== presentation.id))
    return
  }

  await withTimeout(
    deleteDoc(doc(services.db, 'presentations', presentation.id)),
    8000,
    'Firebase configurado, mas o Firestore nao respondeu ao excluir.',
  )
}

export async function uploadPresentationVideo(
  presentationId: string,
  videoId: string,
  file: File,
  onProgress: (progress: number) => void,
) {
  const services = getFirebaseServices()

  if (!services) {
    onProgress(100)
    const storagePath = `local-preview://${presentationId}/${videoId}/${sanitizeFileName(file.name)}`
    await saveLocalVideo(storagePath, file)

    return Promise.resolve({
      storagePath,
      downloadUrl: await getLocalVideoUrl(storagePath),
    })
  }

  const storagePath = `presentations/${presentationId}/videos/${videoId}-${sanitizeFileName(file.name)}`
  const uploadTask = uploadBytesResumable(ref(services.storage, storagePath), file, {
    contentType: file.type,
  })

  return withTimeout(
    new Promise<UploadResult>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
        },
        reject,
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
          resolve({ storagePath, downloadUrl })
        },
      )
    }),
    60000,
    'Firebase Storage nao respondeu ao upload. Verifique bucket, regras e conexao.',
  )
}

export function getPersistenceLabel() {
  return hasFirebaseConfig ? 'Firebase ativo' : 'Modo local sem Firebase'
}
