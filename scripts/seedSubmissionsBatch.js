#!/usr/bin/env node

/**
 * 批量更新提交单 #6 ~ #66 的内容。
 * 依 submissionNumber 定位并更新 Document、Submission 及明细行。
 *
 * 运行：node scripts/seedSubmissionsBatch.js
 * 需提前配置好 DATABASE_URL 并安装依赖。
 */

const { PrismaClient, DocumentStatus } = require('@prisma/client')

const prisma = new PrismaClient()

const START = 6
const END = 66 // 包含 66

const baseMeta = {
  projectName: "TRAVAUX DE RENFORCEMENT DE LA ROUTE BONDOUKOU -BOUNA Y COMPRIS L'AMENAGEMENT DES TRAVERSEES DE BOUNA, BONDOUKOU ET AGNIBILEKROU",
  projectCode: 'QUA-VOIR-BDK-TANDA',
  contractNumbers: ['090/2025', '091/2025'],
  subject: 'Transmission de Demandes de Réception',
}

const baseParties = {
  sender: {
    organization: 'CRBC',
    date: '2025-12-17',
    lastName: 'GAN',
    firstName: 'XING',
    signature: '',
    time: '22:09',
  },
  recipient: {
    organization: 'PORTEO',
    date: '',
    lastName: '',
    firstName: '',
    signature: '',
    time: '',
  },
}

const templateId = 'cmj9478es0000riubpkxuazqw'
const templateVersion = 1

async function main() {
  for (let n = START; n <= END; n += 1) {
    const submission = await prisma.submission.findUnique({
      where: { submissionNumber: n },
      select: { documentId: true },
    })

    if (!submission) {
      console.log(`Skip #${n}: submissionNumber not found`)
      continue
    }

    const documentId = submission.documentId

    const existingDoc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { data: true, title: true, status: true },
    })

    const previousData = (existingDoc?.data ?? {}) // keep existing structure
    const mergedData = {
      ...previousData,
      documentMeta: {
        ...baseMeta,
        bordereauNumber: n,
        submissionNumber: n,
      },
      parties: baseParties,
      // 保留已有 items / comments，避免覆盖自动生成的明细
      items: Array.isArray(previousData?.items) ? previousData.items : previousData?.items || [],
      comments: previousData?.comments ?? '',
    }

    await prisma.$transaction([
      prisma.submission.update({
        where: { submissionNumber: n },
        data: {
          ...baseMeta,
          bordereauNumber: n,
          submissionNumber: n,
          senderOrg: baseParties.sender.organization,
          senderDate: baseParties.sender.date,
          senderLastName: baseParties.sender.lastName,
          senderFirstName: baseParties.sender.firstName,
          senderSignature: baseParties.sender.signature,
          senderTime: baseParties.sender.time,
          recipientOrg: baseParties.recipient.organization,
          recipientDate: baseParties.recipient.date,
          recipientLastName: baseParties.recipient.lastName,
          recipientFirstName: baseParties.recipient.firstName,
          recipientSignature: baseParties.recipient.signature,
          recipientTime: baseParties.recipient.time,
          comments: existingDoc?.data?.comments ?? '',
        },
      }),
      prisma.document.update({
        where: { id: documentId },
        data: {
          title: existingDoc?.title ?? '',
          status: DocumentStatus.DRAFT,
          data: mergedData,
          templateId,
          templateVersion,
        },
      }),
    ])

    console.log(`Updated submission #${n} (documentId=${documentId}) — items preserved`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
