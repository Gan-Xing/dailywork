export interface Party {
  organization: string
  date: string
  lastName: string
  firstName: string
  signature?: string
  time?: string
}

export interface SubmissionItem {
  designation: string
  quantity?: number
  observation?: string
}

export interface SubmissionData {
  documentMeta: {
    projectName: string
    projectCode: string
    contractNumbers: string[]
    bordereauNumber: number
    subject: string
  }
  parties: {
    sender: Party
    recipient: Party
  }
  items: SubmissionItem[]
  comments?: string
}
