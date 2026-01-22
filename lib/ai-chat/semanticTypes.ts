export type SemanticStatus = 'draft' | 'verified'

export type ApiSemanticReturnType = 'list' | 'detail' | 'summary' | 'action' | 'export'

export type ApiSemanticParamLocation = 'path' | 'query'

export type ApiSemanticEntry = {
  key: string
  summary?: string
  intents?: string[]
  examples?: string[]
  inputNotes?: string[]
  outputNotes?: string[]
  returnType?: ApiSemanticReturnType
  idField?: string
  detailEndpointKey?: string
  detailParam?: string
  detailParamLocation?: ApiSemanticParamLocation
  evidenceFields?: string[]
  detailKeys?: string[]
  status?: SemanticStatus
  updatedAt?: string
  updatedBy?: string
}

export type ApiSemanticCatalog = {
  updatedAt: string
  entries: Record<string, ApiSemanticEntry>
}
