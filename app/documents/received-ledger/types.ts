export type ReceivedLedgerMainPdf = {
  id: number
  originalName: string
  mimeType: string
  size: number
  createdAt: string
}

export type ReceivedLedgerRow = {
  id: number
  category: string
  projectId: number
  projectName: string
  roadSectionId: number | null
  roadSectionName: string | null
  structureName: string | null
  sizeSpec: string | null
  versionTag: string | null
  documentName: string
  documentCode: string | null
  coverageScope: string | null
  sourceOrg: string | null
  receivedAt: string
  receivedById: number | null
  receivedByName: string | null
  receivedByText: string | null
  status: string
  remark: string | null
  mainPdf: ReceivedLedgerMainPdf | null
  attachmentCount: number
  createdAt: string
  updatedAt: string
}

export type ReceivedLedgerListResult = {
  items: ReceivedLedgerRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  summary: {
    missingMainPdfCount: number
    withMainPdfCount: number
  }
}
