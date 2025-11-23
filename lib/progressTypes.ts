export interface RoadSectionPayload {
  slug: string
  name: string
  startPk: string
  endPk: string
}

export interface RoadSectionDTO extends RoadSectionPayload {
  id: number
  createdAt: string
  updatedAt: string
}
