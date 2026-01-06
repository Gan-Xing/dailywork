import { createHash, createHmac, randomUUID } from 'node:crypto'
import { URL } from 'node:url'

type R2Config = {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  bucket: string
  region: string
}

const SIGNING_ALGORITHM = 'AWS4-HMAC-SHA256'
const SERVICE = 's3'
const DEFAULT_REGION = 'auto'

const getRequiredEnv = (name: string) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

export const getR2Config = (): R2Config => ({
  accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
  secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
  endpoint: getRequiredEnv('R2_ENDPOINT'),
  bucket: getRequiredEnv('R2_BUCKET_NAME'),
  region: process.env.R2_REGION || DEFAULT_REGION,
})

export const buildSignatureStorageKey = (userId: number, originalName: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const normalizedName = originalName.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
  const safeName = normalizedName.length ? normalizedName : 'signature'
  return `members/${userId}/signatures/${timestamp}-${randomUUID()}-${safeName}`
}

const hashSha256 = (payload: string) => createHash('sha256').update(payload).digest('hex')
const hmacSha256 = (key: Buffer | string, payload: string) => createHmac('sha256', key).update(payload).digest()

const toAmzDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, '')

const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )

const encodePath = (value: string) =>
  value
    .split('/')
    .map((segment) => encodeRfc3986(segment))
    .join('/')

const buildCanonicalQuery = (params: Record<string, string>) =>
  Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')

const buildSigningKey = (secretAccessKey: string, dateStamp: string, region: string) => {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, SERVICE)
  return hmacSha256(kService, 'aws4_request')
}

const buildObjectUrl = (config: R2Config, storageKey: string) => {
  const endpoint = new URL(config.endpoint)
  const encodedKey = encodePath(storageKey)
  const pathname = `/${config.bucket}/${encodedKey}`
  return new URL(`${endpoint.origin}${pathname}`)
}

export const createPresignedUrl = ({
  method,
  storageKey,
  expiresInSeconds = 600,
}: {
  method: 'GET' | 'PUT'
  storageKey: string
  expiresInSeconds?: number
}) => {
  const config = getR2Config()
  const url = buildObjectUrl(config, storageKey)
  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`
  const signedHeaders = 'host'

  const params: Record<string, string> = {
    'X-Amz-Algorithm': SIGNING_ALGORITHM,
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': `${expiresInSeconds}`,
    'X-Amz-SignedHeaders': signedHeaders,
  }

  const canonicalRequest = [
    method,
    url.pathname,
    buildCanonicalQuery(params),
    `host:${url.host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    SIGNING_ALGORITHM,
    amzDate,
    credentialScope,
    hashSha256(canonicalRequest),
  ].join('\n')

  const signingKey = buildSigningKey(config.secretAccessKey, dateStamp, config.region)
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  const signedQuery = `${buildCanonicalQuery(params)}&X-Amz-Signature=${signature}`
  return `${url.origin}${url.pathname}?${signedQuery}`
}

export const deleteObject = async (storageKey: string) => {
  const config = getR2Config()
  const url = buildObjectUrl(config, storageKey)
  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = hashSha256('')

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = [
    'DELETE',
    url.pathname,
    url.searchParams.toString(),
    `host:${url.host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`
  const stringToSign = [
    SIGNING_ALGORITHM,
    amzDate,
    credentialScope,
    hashSha256(canonicalRequest),
  ].join('\n')

  const signingKey = buildSigningKey(config.secretAccessKey, dateStamp, config.region)
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  const authorization = `${SIGNING_ALGORITHM} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorization,
    },
  })

  if (!res.ok && res.status !== 404) {
    const body = await res.text()
    throw new Error(`R2 delete failed: ${res.status} ${res.statusText} ${body}`)
  }
}
