'use client'

import { Modal } from '@/components/Modal'

type Props = {
  open: boolean
  title: string
  html: string
  onClose: () => void
}

export function TemplatePreviewModal({ open, title, html, onClose }: Props) {
  return (
    <Modal open={open} title={title} onClose={onClose} widthClassName="max-w-5xl">
      <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200">
        <iframe
          srcDoc={html}
          className="h-full w-full border-0 bg-white"
          title="Template Preview"
          sandbox="allow-same-origin"
        />
      </div>
    </Modal>
  )
}
