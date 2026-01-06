declare module 'archiver' {
  type AppendOptions = {
    name?: string
    [key: string]: unknown
  }

  export interface Archiver {
    abort: () => void
    append: (data: Buffer | string | NodeJS.ReadableStream, options?: AppendOptions) => Archiver
    finalize: () => void | Promise<void>
    on: (event: 'error', listener: (error: Error) => void) => Archiver
    on: (event: string, listener: (...args: unknown[]) => void) => Archiver
    pipe: (destination: NodeJS.WritableStream, options?: { end?: boolean }) => NodeJS.WritableStream
  }

  const archiver: (
    format: string,
    options?: {
      zlib?: {
        level?: number
      }
      [key: string]: unknown
    },
  ) => Archiver
  export default archiver
}
