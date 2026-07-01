import type { VideoItem } from '../video/types'

export type PresentationStatus = 'draft' | 'ready'

export type Presentation = {
  id: string
  title: string
  videos: VideoItem[]
  status: PresentationStatus
  createdAt: string
  updatedAt: string
}
