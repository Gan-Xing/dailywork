import type { SubmissionData } from '@/types/documents'

export const DEFAULT_SUBMISSION_TITLE = 'Réception'
export const DEFAULT_SUBMISSION_SUBJECT = 'Transmission de Demandes de Réception'
export const DEFAULT_SUBMISSION_PROJECT_NAME =
  "TRAVAUX DE RENFORCEMENT DE LA ROUTE BONDOUKOU -BOUNA Y COMPRIS L'AMENAGEMENT DES TRAVERSEES DE BOUNA, BONDOUKOU ET AGNIBILEKROU"
export const DEFAULT_SUBMISSION_PROJECT_CODE = 'QUA-VOIR-BDK-TANDA'
export const DEFAULT_SUBMISSION_CONTRACT_NUMBERS = ['090/2025', '091/2025'] as const
export const DEFAULT_SUBMISSION_SENDER = {
  organization: 'CRBC',
  lastName: 'GAN',
  firstName: 'XING',
} as const
export const DEFAULT_SUBMISSION_RECIPIENT = {
  organization: 'PORTEO',
  lastName: '',
  firstName: '',
} as const

const pad = (value: number) => String(value).padStart(2, '0')

const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const formatLocalTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

export const buildDefaultSubmissionDraft = ({
  suggestedSubmissionNumber,
  now = new Date(),
}: {
  suggestedSubmissionNumber: number
  now?: Date
}): { title: string; data: SubmissionData } => {
  const safeNumber =
    Number.isFinite(suggestedSubmissionNumber) && suggestedSubmissionNumber > 0
      ? Math.trunc(suggestedSubmissionNumber)
      : 1

  return {
    title: DEFAULT_SUBMISSION_TITLE,
    data: {
      documentMeta: {
        projectName: DEFAULT_SUBMISSION_PROJECT_NAME,
        projectCode: DEFAULT_SUBMISSION_PROJECT_CODE,
        contractNumbers: [...DEFAULT_SUBMISSION_CONTRACT_NUMBERS],
        bordereauNumber: safeNumber,
        subject: DEFAULT_SUBMISSION_SUBJECT,
      },
      parties: {
        sender: {
          organization: DEFAULT_SUBMISSION_SENDER.organization,
          date: formatLocalDate(now),
          lastName: DEFAULT_SUBMISSION_SENDER.lastName,
          firstName: DEFAULT_SUBMISSION_SENDER.firstName,
          time: formatLocalTime(now),
        },
        recipient: {
          organization: DEFAULT_SUBMISSION_RECIPIENT.organization,
          date: '',
          lastName: DEFAULT_SUBMISSION_RECIPIENT.lastName,
          firstName: DEFAULT_SUBMISSION_RECIPIENT.firstName,
        },
      },
      items: [],
      comments: '',
    },
  }
}

export const applySubmissionNumberToData = (data: unknown, submissionNumber: number) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data

  const source = data as Record<string, unknown>
  const documentMeta =
    source.documentMeta && typeof source.documentMeta === 'object' && !Array.isArray(source.documentMeta)
      ? (source.documentMeta as Record<string, unknown>)
      : {}

  return {
    ...source,
    documentMeta: {
      ...documentMeta,
      bordereauNumber: submissionNumber,
    },
  }
}
