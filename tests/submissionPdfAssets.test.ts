import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { inlineSubmissionPdfAssets } from '../lib/documents/pdfAssets'

const publicDirectory = path.resolve('public')

test('inlines the CRBC logo used by submission PDFs', async () => {
  const html = '<img class="logo" src="https://dailywork.example/logo_rb.png?version=1" alt="CRBC">'
  const rendered = await inlineSubmissionPdfAssets(html, publicDirectory)

  assert.match(rendered, /src="data:image\/png;base64,[A-Za-z0-9+/=]+"/)
  assert.doesNotMatch(rendered, /dailywork\.example/)
})

test('leaves unrelated image assets unchanged', async () => {
  const html = '<img src="https://example.com/other.png" alt="Other">'

  assert.equal(await inlineSubmissionPdfAssets(html, publicDirectory), html)
})
