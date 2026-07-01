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
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from 'firebase/storage'
import type { Presentation } from '../../entities/presentation/types'
import { sanitizeFileName } from '../lib/file'
import { getLocalVideoUrl, saveLocalVideo } from '../lib/localVideoStore'
import { getFirebaseServices, hasFirebaseConfig } from './config'

const localStorageKey = 'video-slide-web:presentations'

type UploadResult = {
  storagePath: string
  downloadUrl: string
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
  const snapshot = await getDocs(presentationsQuery)

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

  await setDoc(doc(services.db, 'presentations', normalizedPresentation.id), normalizedPresentation)
  return normalizedPresentation
}

export async function deletePresentation(presentationId: string) {
  const services = getFirebaseServices()

  if (!services) {
    writeLocalPresentations(readLocalPresentations().filter((item) => item.id !== presentationId))
    return
  }

  await deleteDoc(doc(services.db, 'presentations', presentationId))
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

  return new Promise<UploadResult>((resolve, reject) => {
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
  })
}

export function getPersistenceLabel() {
  return hasFirebaseConfig ? 'Firebase ativo' : 'Modo local sem Firebase'
}
