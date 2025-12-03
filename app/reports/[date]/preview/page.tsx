'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

import { ReportPreview } from '@/components/report/ReportPreview'
import type { DailyReport } from '@/lib/reportState'
import { getReportPreviewCopy } from '@/lib/i18n/reportPreview'
import { DATE_KEY_REGEX, normalizeReportForDate } from '@/lib/reportUtils'

const STORAGE_PREFIX = 'report-preview-'

export default function ReportPreviewPage() {
	const params = useParams<{ date?: string }>()
	const searchParams = useSearchParams()
	const localeParam = searchParams?.get('locale') === 'fr' ? 'fr' : 'zh'
	const copy = getReportPreviewCopy(localeParam)
	const dateKey = typeof params?.date === 'string' ? params.date : ''
	const [report, setReport] = useState<DailyReport | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		let isMounted = true
		if (!dateKey || !DATE_KEY_REGEX.test(dateKey)) {
			setError(copy.invalidDate)
			setIsLoading(false)
			return
		}

		const loadReport = async () => {
			const storageKey = `${STORAGE_PREFIX}${dateKey}`
			let payload: DailyReport | null = null

			if (typeof window !== 'undefined') {
				const stored = window.sessionStorage.getItem(storageKey)
				if (stored) {
					try {
						payload = normalizeReportForDate(JSON.parse(stored) as DailyReport, dateKey)
					} catch {
						payload = null
					}
					window.sessionStorage.removeItem(storageKey)
				}
			}

			if (!payload) {
				try {
					const response = await fetch(`/api/reports/${dateKey}`, { cache: 'no-store' })
					if (!response.ok) {
						throw new Error(copy.error)
					}
					const data = (await response.json()) as { report: DailyReport }
					payload = normalizeReportForDate(data.report, dateKey)
				} catch (fetchError) {
					if (isMounted) {
						setError(
							(fetchError as Error).message || copy.error,
						)
						setIsLoading(false)
					}
					return
				}
			}

			if (isMounted) {
				setReport(payload)
				setIsLoading(false)
			}
		}

		loadReport()

		return () => {
			isMounted = false
		}
	}, [dateKey])

	if (isLoading) {
		return (
			<main className='mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10'>
				<p className='text-center text-sm text-slate-500'>{copy.loading}</p>
			</main>
		)
	}

	if (error || !report) {
		return (
			<main className='mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10'>
				<div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700'>
					{error || copy.error}
				</div>
			</main>
		)
	}

	return (
		<main className='flex min-h-screen w-full items-start justify-center bg-slate-200 p-4'>
			<ReportPreview report={report} locale={localeParam} />
		</main>
	)
}
