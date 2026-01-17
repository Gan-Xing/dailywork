'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

import { PageHeaderNav } from '@/components/PageHeaderNav'
import { ReportPreview } from '@/components/report/ReportPreview'
import { getCopy } from '@/lib/i18n'
import { reportLandingBreadcrumbs } from '@/lib/i18n/reportsLanding'
import type { DailyReport } from '@/lib/reportState'
import { getReportPreviewCopy } from '@/lib/i18n/reportPreview'
import { DATE_KEY_REGEX, normalizeReportForDate } from '@/lib/reportUtils'

export const dynamic = 'force-dynamic'

const STORAGE_PREFIX = 'report-preview-'

export default function ReportPreviewPage() {
	const params = useParams<{ date?: string }>()
	const searchParams = useSearchParams()
	const localeParam = searchParams?.get('locale') === 'fr' ? 'fr' : 'zh'
	const copy = getReportPreviewCopy(localeParam)
	const uiCopy = getCopy(localeParam)
	const breadcrumbsCopy = reportLandingBreadcrumbs[localeParam]
	const dateKey = typeof params?.date === 'string' ? params.date : ''
	const [report, setReport] = useState<DailyReport | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const breadcrumbDate = dateKey || '--'

	const header = (
		<PageHeaderNav
			className='z-30 py-4'
			breadcrumbs={[
				{ label: breadcrumbsCopy.home, href: '/' },
				{ label: breadcrumbsCopy.reports, href: '/reports' },
				{ label: breadcrumbDate }
			]}
			title={uiCopy.common.previewTitle}
			subtitle={breadcrumbDate}
			breadcrumbVariant='light'
		/>
	)

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
	}, [copy.error, copy.invalidDate, dateKey])

	if (isLoading) {
		return (
			<main className='min-h-screen bg-slate-50 text-slate-900'>
				{header}
				<section className='mx-auto w-full max-w-[1700px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12'>
					<p className='text-center text-sm text-slate-500'>{copy.loading}</p>
				</section>
			</main>
		)
	}

	if (error || !report) {
		return (
			<main className='min-h-screen bg-slate-50 text-slate-900'>
				{header}
				<section className='mx-auto w-full max-w-[1700px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12'>
					<div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700'>
						{error || copy.error}
					</div>
				</section>
			</main>
		)
	}

	return (
		<main className='min-h-screen bg-slate-50 text-slate-900'>
			{header}
			<section className='flex w-full items-start justify-center bg-slate-200 px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12'>
				<ReportPreview report={report} locale={localeParam} />
			</section>
		</main>
	)
}
