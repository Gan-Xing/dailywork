'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import Image from 'next/image';

import { EquipmentTable } from '@/components/report/EquipmentTable';
import { MaterialsTable } from '@/components/report/MaterialsTable';
import { PersonnelTable } from '@/components/report/PersonnelTable';
import { SectionCard } from '@/components/report/SectionCard';
import { WeatherTable } from '@/components/report/WeatherTable';
import {
	additionalNarrativeSections,
	equipmentEntries,
	materialItems,
	observationBlocks,
	personnelRoles,
	worksExecutedBlocks,
	type AdditionalSectionKey,
	type ObservationKey,
	type WeatherPeriod,
	type WorkBlock
} from '@/lib/reportSchema';
import { formatCopy, getCopy, localeLabels, locales, type Locale } from '@/lib/i18n';
import {
	createInitialReportState,
	type DailyReport,
	type EquipmentStatus,
	type LocalizedRichText,
	type MaterialStock,
	type PersonnelCount,
	type WeatherEntry
} from '@/lib/reportState';
import {
	createReportForDate,
	DATE_KEY_REGEX,
	normalizeReportForDate,
	recalcMaterialRow
} from '@/lib/reportUtils';

const participantEntities = [
	{
		id: 'meer',
		label: {
			fr: "MINISTERE DE L'EQUIPEMENT ET DE L'ENTRETIEN ROUTIER (MEER)",
			zh: '科特迪瓦设备与道路维护部 (MEER)'
		},
		logo: { src: '/meer.png', width: 160, height: 80 }
	},
	{
		id: 'delegue',
		label: {
			fr: "Maître d'ouvrage délégué",
			zh: '业主代表'
		},
		logo: { src: '/ageroute.png', width: 160, height: 80 }
	},
	{
		id: 'moe',
		label: {
			fr: "Maître d'œuvre",
			zh: '监理/设计单位'
		},
		logo: { src: '/bnetd_logo.svg', width: 160, height: 80 }
	},
	{
		id: 'entrepreneur',
		label: {
			fr: 'Entrepreneur',
			zh: '承包商'
		},
		logo: { src: '/logo_porteo_btp.svg', width: 160, height: 80 }
	}
] as const;

const [primaryEntity, ...secondaryEntities] = participantEntities;

const monthOptions = [
	{ value: '01', label: { fr: 'Janvier', zh: '1月' } },
	{ value: '02', label: { fr: 'Février', zh: '2月' } },
	{ value: '03', label: { fr: 'Mars', zh: '3月' } },
	{ value: '04', label: { fr: 'Avril', zh: '4月' } },
	{ value: '05', label: { fr: 'Mai', zh: '5月' } },
	{ value: '06', label: { fr: 'Juin', zh: '6月' } },
	{ value: '07', label: { fr: 'Juillet', zh: '7月' } },
	{ value: '08', label: { fr: 'Août', zh: '8月' } },
	{ value: '09', label: { fr: 'Septembre', zh: '9月' } },
	{ value: '10', label: { fr: 'Octobre', zh: '10月' } },
	{ value: '11', label: { fr: 'Novembre', zh: '11月' } },
	{ value: '12', label: { fr: 'Décembre', zh: '12月' } }
] as const;

const yearOptions = [
	{ value: '2025', label: { fr: '2025', zh: '2025年' } },
	{ value: '2026', label: { fr: '2026', zh: '2026年' } }
] as const;

const selectPlaceholder = {
	fr: 'Sélectionner',
	zh: '请选择'
} as const;

const homeLabelMap = {
	zh: '返回首页',
	fr: "Retour à l'accueil"
} as const;

const reportDateLabelMap = {
	zh: '日报日期',
	fr: 'Date du rapport'
} as const;

const saveLabelMap = {
	zh: '确认保存',
	fr: "Confirmer l'enregistrement"
} as const;

const savingLabelMap = {
	zh: '保存中...',
	fr: 'Enregistrement...'
} as const;

type NarrativeGroup = 'observations' | 'works' | 'additional';

type ObservationSectionRef = {
	key: `observations.${ObservationKey}`;
	group: 'observations';
	id: ObservationKey;
	labelFr: string;
	labelZh: string;
};

type WorkSectionRef = {
	key: `works.${WorkBlock}`;
	group: 'works';
	id: WorkBlock;
	labelFr: string;
	labelZh: string;
};

type AdditionalSectionRef = {
	key: `additional.${AdditionalSectionKey}`;
	group: 'additional';
	id: AdditionalSectionKey;
	labelFr: string;
	labelZh: string;
};

type NarrativeSectionRef = ObservationSectionRef | WorkSectionRef | AdditionalSectionRef;

const narrativeSections: NarrativeSectionRef[] = [
	...observationBlocks.map<ObservationSectionRef>((block) => ({
		key: `observations.${block.id}`,
		group: 'observations',
		id: block.id,
		labelFr: block.label.fr,
		labelZh: block.label.zh
	})),
	...worksExecutedBlocks.map<WorkSectionRef>((block) => ({
		key: `works.${block.id}`,
		group: 'works',
		id: block.id,
		labelFr: block.label.fr,
		labelZh: block.label.zh
	})),
	...additionalNarrativeSections.map<AdditionalSectionRef>((section) => ({
		key: `additional.${section.id}`,
		group: 'additional',
		id: section.id,
		labelFr: section.label.fr,
		labelZh: section.label.zh
	}))
];

const narrativeSectionMap = narrativeSections.reduce<Record<string, NarrativeSectionRef>>(
	(acc, ref) => {
		acc[ref.key] = ref;
		return acc;
	},
	{}
);

const getNarrativeRef = (group: NarrativeGroup, id: string) =>
	narrativeSectionMap[`${group}.${id}`];

const cleanText = (value: string) => value.replace(/\u00a0/g, ' ').trim();

const hasMeaningfulChineseContent = (value: string) => {
	const normalized = cleanText(value);
	if (!normalized) return false;
	return normalized.toUpperCase() !== 'RAS';
};

const hasAnyContent = (value: string) => Boolean(cleanText(value));

const getNarrativeValue = (
	report: DailyReport,
	ref: NarrativeSectionRef,
	targetLocale: Locale
): string => {
	switch (ref.group) {
		case 'observations':
			return report.observations?.[ref.id]?.[targetLocale] ?? '';
		case 'works':
			return report.works?.[ref.id]?.[targetLocale] ?? '';
		case 'additional':
			return report.additional?.[ref.id]?.[targetLocale] ?? '';
		default:
			return '';
	}
};

const applyFrenchTranslation = (
	report: DailyReport,
	ref: NarrativeSectionRef,
	translation: string
): DailyReport => {
	const trimmed = cleanText(translation);
	if (!trimmed) {
		return report;
	}

	const hasChinese = hasMeaningfulChineseContent(getNarrativeValue(report, ref, 'zh'));
	const hasFrench = hasAnyContent(getNarrativeValue(report, ref, 'fr'));

	if (!hasChinese || hasFrench) {
		return report;
	}

	switch (ref.group) {
		case 'observations':
			return {
				...report,
				observations: {
					...report.observations,
					[ref.id]: {
						...report.observations[ref.id],
						fr: trimmed
					}
				}
			};
		case 'works':
			return {
				...report,
				works: {
					...report.works,
					[ref.id]: { ...report.works[ref.id], fr: trimmed }
				}
			};
		case 'additional':
			return {
				...report,
				additional: {
					...report.additional,
					[ref.id]: {
						...report.additional[ref.id],
						fr: trimmed
					}
				}
			};
		default:
			return report;
	}
};

type TranslationStatus = 'pending' | 'success' | 'error';

interface TranslationEntry {
	status: TranslationStatus;
	error?: string;
}

export default function ReportEditorPage() {
	const params = useParams<{ date: string }>();
	const router = useRouter();
	const activeDate = typeof params?.date === 'string' ? params.date : '';
	const [report, setReport] = useState<DailyReport>(() => createInitialReportState());
	const [locale, setLocale] = useState<Locale>('zh');
	const [isReady, setIsReady] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [translationState, setTranslationState] = useState<
		Record<string, TranslationEntry>
	>({});
	const copy = useMemo(() => getCopy(locale), [locale]);

	useEffect(() => {
		if (!activeDate || !DATE_KEY_REGEX.test(activeDate)) {
			setLoadError('请选择有效的日期');
			setIsReady(true);
			return;
		}

		let cancelled = false;
		const controller = new AbortController();

		const loadReport = async () => {
			setIsReady(false);
			setLoadError(null);
			try {
				const response = await fetch(`/api/reports/${activeDate}`, {
					cache: 'no-store',
					signal: controller.signal
				});
				if (!response.ok) {
					throw new Error('Failed to load report');
				}
				const data = (await response.json()) as {
					report: DailyReport;
					exists: boolean;
					previousDate: string | null;
				};
				if (!cancelled) {
					setReport(
						normalizeReportForDate(
							data.report,
							activeDate
						)
					);
				}
			} catch (error) {
				if ((error as Error).name === 'AbortError') {
					return;
				}
				if (!cancelled) {
					setLoadError('加载日报失败，请稍后再试。');
					setReport(createReportForDate(activeDate));
				}
			} finally {
				if (!cancelled) {
					setIsReady(true);
				}
			}
		};

		loadReport();

		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [activeDate]);

	const handleSave = async () => {
		if (!activeDate || !DATE_KEY_REGEX.test(activeDate)) return;
		setIsSaving(true);
		setSaveError(null);
		try {
			const normalized = normalizeReportForDate(report, activeDate);
			const response = await fetch(`/api/reports/${activeDate}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ report: normalized })
			});
			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as {
					message?: string;
				} | null;
				throw new Error(data?.message ?? 'Failed to save report');
			}
			router.push('/');
			router.refresh();
		} catch (error) {
			setSaveError((error as Error).message || '保存失败，请稍后再试。');
		} finally {
			setIsSaving(false);
		}
	};

	const handleBack = () => {
		router.push('/');
	};

	const previewStorageKey = activeDate ? `report-preview-${activeDate}` : null;
	const homeButtonBase = homeLabelMap[locale];
	const homeButtonLabel = `← ${homeButtonBase}`;
	const reportDateLabel = reportDateLabelMap[locale];
	const saveButtonLabel = saveLabelMap[locale];
	const savingButtonLabel = savingLabelMap[locale];
	const breadcrumbHome = locale === 'fr' ? 'Accueil' : '首页';
	const breadcrumbReports = locale === 'fr' ? 'Rapports journaliers' : '日报管理';
	const breadcrumbDate = report.metadata.date || activeDate || '--';

	const handlePreviewNavigate = () => {
		if (!activeDate || !DATE_KEY_REGEX.test(activeDate)) {
			return;
		}
		if (typeof window !== 'undefined' && previewStorageKey) {
			try {
				const normalized = normalizeReportForDate(
					report,
					activeDate
				);
				window.sessionStorage.setItem(
					previewStorageKey,
					JSON.stringify(normalized)
				);
			} catch {
				// ignore storage quota errors
			}
		}
		router.push(`/reports/${activeDate}/preview?locale=${locale}`);
	};

	const equipmentTotals = useMemo(
		() =>
			Object.values(report.equipment).reduce(
				(acc, entry) => ({
					total: acc.total + (Number(entry.total) || 0),
					marche: acc.marche + (Number(entry.marche) || 0),
					panne: acc.panne + (Number(entry.panne) || 0),
					arret: acc.arret + (Number(entry.arret) || 0)
				}),
				{ total: 0, marche: 0, panne: 0, arret: 0 }
			),
		[report.equipment]
	);

	const personnelTotals = useMemo(
		() =>
			Object.values(report.personnel).reduce(
				(acc, entry) => ({
					present:
						acc.present +
						(Number(entry.present) || 0),
					absent: acc.absent + (Number(entry.absent) || 0)
				}),
				{ present: 0, absent: 0 }
			),
		[report.personnel]
	);

	const updateMetadata = <K extends keyof DailyReport['metadata']>(
		field: K,
		value: string
	) => {
		setReport((prev) => ({
			...prev,
			metadata: { ...prev.metadata, [field]: value }
		}));
	};

	const updateWeather = (
		period: WeatherPeriod,
		field: keyof WeatherEntry,
		value: string
	) => {
		setReport((prev) => ({
			...prev,
			weather: {
				...prev.weather,
				[period]: { ...prev.weather[period], [field]: value }
			}
		}));
	};

	const updateEquipment = (id: string, field: keyof EquipmentStatus, value: string) => {
		setReport((prev) => ({
			...prev,
			equipment: {
				...prev.equipment,
				[id]: { ...prev.equipment[id], [field]: value }
			}
		}));
	};

	const updateMaterials = (id: string, field: keyof MaterialStock, value: string) => {
		if (field === 'current') {
			return;
		}
		setReport((prev) => {
			const nextRow = recalcMaterialRow({
				...(prev.materials[id] ?? {
					previous: '0',
					entry: '0',
					exit: '0',
					current: '0'
				}),
				[field]: value
			});
			return {
				...prev,
				materials: {
					...prev.materials,
					[id]: nextRow
				}
			};
		});
	};

	const updatePersonnel = (id: string, field: keyof PersonnelCount, value: string) => {
		setReport((prev) => ({
			...prev,
			personnel: {
				...prev.personnel,
				[id]: { ...prev.personnel[id], [field]: value }
			}
		}));
	};

	const updateExpatriate = (field: keyof PersonnelCount, value: string) => {
		setReport((prev) => ({
			...prev,
			expatriate: { ...prev.expatriate, [field]: value }
		}));
	};

	const updateObservation = (key: ObservationKey, targetLocale: Locale, value: string) => {
		setReport((prev) => ({
			...prev,
			observations: {
				...prev.observations,
				[key]: { ...prev.observations[key], [targetLocale]: value }
			}
		}));
	};

	const updateWork = (key: WorkBlock, targetLocale: Locale, value: string) => {
		setReport((prev) => ({
			...prev,
			works: {
				...prev.works,
				[key]: { ...prev.works[key], [targetLocale]: value }
			}
		}));
	};

	const updateAdditional = (
		key: AdditionalSectionKey,
		targetLocale: Locale,
		value: string
	) => {
		setReport((prev) => ({
			...prev,
			additional: {
				...prev.additional,
				[key]: { ...prev.additional[key], [targetLocale]: value }
			}
		}));
	};

	const requestTranslation = useCallback(
		async (sectionRef: NarrativeSectionRef, source: string) => {
			const payload = {
				content: source,
				section: `${sectionRef.labelFr} / ${sectionRef.labelZh}`,
				sourceLocale: 'zh' as Locale,
				targetLocale: 'fr' as Locale
			};
			setTranslationState((prev) => ({
				...prev,
				[sectionRef.key]: { status: 'pending' }
			}));
			try {
				const response = await fetch('/api/translate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const data = (await response.json().catch(() => null)) as {
					translation?: string;
					message?: string;
				} | null;
				if (!response.ok) {
					throw new Error(
						data?.message ??
							'La requête de traduction a échoué'
					);
				}
				const translation =
					typeof data?.translation === 'string'
						? data.translation.trim()
						: '';
				if (!translation) {
					throw new Error(
						'La traduction renvoyée est vide'
					);
				}
				setReport((prev) =>
					applyFrenchTranslation(
						prev,
						sectionRef,
						translation
					)
				);
				setTranslationState((prev) => ({
					...prev,
					[sectionRef.key]: { status: 'success' }
				}));
			} catch (error) {
				setTranslationState((prev) => ({
					...prev,
					[sectionRef.key]: {
						status: 'error',
						error:
							(error as Error).message ||
							'Échec de la traduction'
					}
				}));
			}
		},
		[setReport]
	);

	const handleManualTranslation = (sectionRef: NarrativeSectionRef) => {
		const chineseValue = getNarrativeValue(report, sectionRef, 'zh');
		if (!hasMeaningfulChineseContent(chineseValue)) {
			return;
		}
		requestTranslation(sectionRef, cleanText(chineseValue));
	};

	useEffect(() => {
		if (locale !== 'fr') {
			return;
		}

		setReport((prev) => {
			let updated = false;
			let nextObservations = prev.observations;
			let nextWorks = prev.works;
			let nextAdditional = prev.additional;

			narrativeSections.forEach((section) => {
				let entry: LocalizedRichText | undefined;
				if (section.group === 'observations') {
					entry = nextObservations[section.id];
				} else if (section.group === 'works') {
					entry = nextWorks[section.id];
				} else {
					entry = nextAdditional[section.id];
				}
				const chineseValue = entry?.zh ?? '';
				if (hasMeaningfulChineseContent(chineseValue)) {
					return;
				}
				const frenchValue = entry?.fr ?? '';
				if (hasAnyContent(frenchValue)) {
					return;
				}
				if (section.group === 'observations') {
					if (nextObservations === prev.observations) {
						nextObservations = {
							...nextObservations
						};
					}
					nextObservations[section.id] = {
						...entry,
						fr: 'RAS'
					};
				} else if (section.group === 'works') {
					if (nextWorks === prev.works) {
						nextWorks = { ...nextWorks };
					}
					nextWorks[section.id] = { ...entry, fr: 'RAS' };
				} else {
					if (nextAdditional === prev.additional) {
						nextAdditional = { ...nextAdditional };
					}
					nextAdditional[section.id] = {
						...entry,
						fr: 'RAS'
					};
				}
				updated = true;
			});

			if (!updated) {
				return prev;
			}

			return {
				...prev,
				observations: nextObservations,
				works: nextWorks,
				additional: nextAdditional
			};
		});
	}, [locale]);

	useEffect(() => {
		if (locale !== 'fr') {
			return;
		}

		narrativeSections.forEach((section) => {
			const chineseValue = getNarrativeValue(report, section, 'zh');
			if (!hasMeaningfulChineseContent(chineseValue)) {
				return;
			}
			const frenchValue = getNarrativeValue(report, section, 'fr');
			if (hasAnyContent(frenchValue)) {
				return;
			}
			const statusEntry = translationState[section.key];
			if (
				statusEntry?.status === 'pending' ||
				statusEntry?.status === 'error'
			) {
				return;
			}
			requestTranslation(section, cleanText(chineseValue));
		});
	}, [locale, report, requestTranslation, translationState]);

	if (!isReady) {
		return (
			<main className='mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10'>
				<p className='text-center text-sm text-slate-500'>
					加载中...
				</p>
			</main>
		);
	}

	if (loadError) {
		return (
			<main className='mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10'>
				<div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700'>
					{loadError}
				</div>
				<button
					type='button'
					className='mx-auto rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
					onClick={handleBack}>
					{homeButtonBase}
				</button>
			</main>
		);
	}

	const equipmentSummaryHelper = formatCopy(copy.summary.equipment.helperTemplate, {
		total: equipmentTotals.total,
		marche: equipmentTotals.marche
	});
	const materialsSummaryHelper = formatCopy(copy.summary.materials.helperTemplate, {});
	const personnelSummaryHelper = formatCopy(copy.summary.personnel.helperTemplate, {
		present: personnelTotals.present,
		absent: personnelTotals.absent
	});

	return (
		<>
			<main className='mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:px-8 lg:py-12'>
				<nav className='flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600'>
					<Link
						href='/'
						className='rounded-full border border-slate-200 bg-white/80 px-3 py-1 transition hover:bg-white'>
						{breadcrumbHome}
					</Link>
					<span className='text-slate-400'>/</span>
					<Link
						href='/reports'
						className='rounded-full border border-slate-200 bg-white/80 px-3 py-1 transition hover:bg-white'>
						{breadcrumbReports}
					</Link>
					<span className='text-slate-400'>/</span>
					<span className='rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-slate-800'>
						{breadcrumbDate}
					</span>
				</nav>
				<div className='rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm'>
					<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
						<button
							type='button'
							className='inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
							onClick={handleBack}>
							{homeButtonLabel}
						</button>
						<div className='text-center sm:text-left'>
							<p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
								{reportDateLabel}
							</p>
							<p className='text-2xl font-semibold text-slate-900'>
								{report.metadata
									.date ||
									activeDate}
							</p>
						</div>
						<div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
							<button
								type='button'
								className='inline-flex items-center justify-center rounded-2xl border border-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
								onClick={
									handlePreviewNavigate
								}>
								{
									copy
										.common
										.previewButtonLabel
								}
							</button>
							<button
								type='button'
								className='inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400'
								onClick={handleSave}
								disabled={isSaving}>
								{isSaving
									? savingButtonLabel
									: saveButtonLabel}
							</button>
						</div>
					</div>
					{saveError ? (
						<p className='mt-2 text-center text-xs text-red-600 sm:text-right'>
							{saveError}
						</p>
					) : null}
				</div>

				<div className='flex justify-end'>
					<LocaleToggle
						label={copy.common.languageToggleLabel}
						value={locale}
						onChange={setLocale}
					/>
				</div>
				<header className='rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm shadow-slate-100'>
					<div className='grid gap-6 lg:grid-cols-2'>
						<div>
							<p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
								{
									copy
										.header
										.logosTitle
								}
							</p>
							<div className='mt-3 flex flex-col gap-3 lg:flex-row lg:items-stretch'>
								<div className='flex flex-col items-center gap-3 rounded-3xl border border-slate-100 bg-white px-6 py-5 text-center shadow-sm lg:basis-5/12'>
									<div className='flex h-24 w-full items-center justify-center rounded-2xl bg-slate-50'>
										<Image
											src={
												primaryEntity
													.logo
													.src
											}
											alt={
												primaryEntity
													.label[
													locale
												]
											}
											width={
												primaryEntity
													.logo
													.width
											}
											height={
												primaryEntity
													.logo
													.height
											}
											className='max-h-16 w-auto object-contain'
										/>
									</div>
									<span className='text-xs font-semibold uppercase tracking-wide text-slate-700'>
										{
											primaryEntity
												.label[
												locale
											]
										}
									</span>
								</div>
								<div className='grid gap-3 lg:basis-7/12'>
									{secondaryEntities.map(
										(
											entity
										) => (
											<div
												key={
													entity.id
												}
												className='rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-600 shadow-sm'>
												<div className='grid grid-cols-[1fr_auto] items-center gap-3'>
													<span className='text-xs font-semibold uppercase tracking-wide'>
														{
															entity
																.label[
																locale
															]
														}
													</span>
													<div className='flex h-14 w-28 items-center justify-center rounded-xl bg-white'>
														<Image
															src={
																entity
																	.logo
																	.src
															}
															alt={
																entity
																	.label[
																	locale
																]
															}
															width={
																entity
																	.logo
																	.width
															}
															height={
																entity
																	.logo
																	.height
															}
															className='max-h-10 w-auto object-contain'
														/>
													</div>
												</div>
											</div>
										)
									)}
								</div>
							</div>
						</div>
						<div className='rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5'>
							<p className='text-xs font-semibold uppercase tracking-wide text-blue-600'>
								{
									copy
										.header
										.siteLabel
								}
							</p>
							<p className='mt-3 text-sm text-slate-700'>
								{
									copy
										.header
										.siteDescription
								}
							</p>
						</div>
					</div>
					<div className='mt-6 grid gap-4 sm:grid-cols-3'>
						<SummaryCard
							label={
								copy.summary
									.equipment
									.label
							}
							value={`${equipmentEntries.length} ${copy.summary.equipment.unit}`}
							helper={
								equipmentSummaryHelper
							}
						/>
						<SummaryCard
							label={
								copy.summary
									.materials
									.label
							}
							value={`${materialItems.length} ${copy.summary.materials.unit}`}
							helper={
								materialsSummaryHelper
							}
						/>
						<SummaryCard
							label={
								copy.summary
									.personnel
									.label
							}
							value={`${personnelRoles.length} ${copy.summary.personnel.unit}`}
							helper={
								personnelSummaryHelper
							}
						/>
					</div>
				</header>

				<SectionCard
					title={copy.sections.metadata.title}
					description={copy.sections.metadata.description}>
					<div className='grid gap-4 md:grid-cols-3'>
						<Field
							label={
								copy.sections
									.metadata
									.fields
									.month
							}
							htmlFor='journal-month'>
							<select
								id='journal-month'
								className='w-full rounded border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
								value={
									report
										.metadata
										.month
								}
								onChange={(event) =>
									updateMetadata(
										'month',
										event
											.target
											.value
									)
								}>
								<option value=''>
									{
										selectPlaceholder[
											locale
										]
									}
								</option>
								{monthOptions.map(
									(
										option
									) => (
										<option
											key={
												option.value
											}
											value={
												option.value
											}>
											{
												option
													.label[
													locale
												]
											}
										</option>
									)
								)}
							</select>
						</Field>
						<Field
							label={
								copy.sections
									.metadata
									.fields
									.year
							}
							htmlFor='journal-year'>
							<select
								id='journal-year'
								className='w-full rounded border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
								value={
									report
										.metadata
										.year
								}
								onChange={(event) =>
									updateMetadata(
										'year',
										event
											.target
											.value
									)
								}>
								<option value=''>
									{
										selectPlaceholder[
											locale
										]
									}
								</option>
								{yearOptions.map(
									(
										option
									) => (
										<option
											key={
												option.value
											}
											value={
												option.value
											}>
											{
												option
													.label[
													locale
												]
											}
										</option>
									)
								)}
							</select>
						</Field>
						<Field
							label={
								copy.sections
									.metadata
									.fields
									.date
							}
							htmlFor='journal-date'>
							<input
								id='journal-date'
								type='date'
								className='w-full rounded border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
								value={
									report
										.metadata
										.date
								}
								onChange={(event) =>
									updateMetadata(
										'date',
										event
											.target
											.value
									)
								}
							/>
						</Field>
					</div>
				</SectionCard>

				<SectionCard
					title={copy.sections.schedule.title}
					description={copy.sections.schedule.description}>
					<div className='grid gap-4 md:grid-cols-2'>
						<Field
							label={
								copy.sections
									.schedule
									.fields
									.horaires
							}>
							<input
								className='w-full rounded border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
								value={
									report
										.metadata
										.horaires
								}
								onChange={(event) =>
									updateMetadata(
										'horaires',
										event
											.target
											.value
									)
								}
							/>
						</Field>
						<Field
							label={
								copy.sections
									.schedule
									.fields
									.stoppage
							}>
							<textarea
								rows={3}
								className='w-full rounded border border-amber-200 px-4 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
								placeholder={
									copy
										.sections
										.schedule
										.fields
										.stoppagePlaceholder
								}
								value={
									report
										.metadata
										.stoppageCause
								}
								onChange={(event) =>
									updateMetadata(
										'stoppageCause',
										event
											.target
											.value
									)
								}
							/>
						</Field>
					</div>
				</SectionCard>

				<SectionCard
					title={copy.sections.weather.title}
					description={copy.sections.weather.description}>
					<WeatherTable
						data={report.weather}
						onChange={updateWeather}
						locale={locale}
						copy={copy.tables.weather}
					/>
				</SectionCard>

				<SectionCard
					title={copy.sections.equipment.title}
					description={copy.sections.equipment.description}>
					<EquipmentTable
						data={report.equipment}
						onChange={updateEquipment}
						locale={locale}
						copy={copy.tables.equipment}
					/>
				</SectionCard>

				<SectionCard
					title={copy.sections.materials.title}
					description={copy.sections.materials.description}>
					<MaterialsTable
						data={report.materials}
						onChange={updateMaterials}
						locale={locale}
						copy={copy.tables.materials}
					/>
				</SectionCard>

				<SectionCard
					title={copy.sections.personnel.title}
					description={copy.sections.personnel.description}>
					<PersonnelTable
						data={report.personnel}
						expatriate={report.expatriate}
						onChange={updatePersonnel}
						onExpatChange={updateExpatriate}
						locale={locale}
						copy={copy.tables.personnel}
					/>
				</SectionCard>

				<SectionCard
					title={copy.sections.observations.title}
					description={
						copy.sections.observations.description
					}>
					<div className='grid gap-6 md:grid-cols-2'>
						{observationBlocks.map((block) => {
							const sectionRef =
								getNarrativeRef(
									'observations',
									block.id
								);
							const entry = sectionRef
								? translationState[
										sectionRef
											.key
								  ]
								: undefined;
							const chineseValue =
								report.observations[
									block.id
								].zh;
							const frenchValue =
								report.observations[
									block.id
								].fr;
							const canRetry =
								locale === 'fr' &&
								hasMeaningfulChineseContent(
									chineseValue
								) &&
								!hasAnyContent(
									frenchValue
								);
							return (
								<div
									key={
										block.id
									}
									className='space-y-2'>
									<RichTextField
										label={
											block
												.label[
												locale
											]
										}
										helper={
											block
												.helper[
												locale
											]
										}
										value={
											report
												.observations[
												block
													.id
											][
												locale
											]
										}
										onChange={(
											value
										) =>
											updateObservation(
												block.id,
												locale,
												value
											)
										}
									/>
									{locale ===
										'fr' &&
									sectionRef ? (
										<TranslationStatusHint
											entry={
												entry
											}
											canRetry={
												canRetry
											}
											onRetry={() =>
												handleManualTranslation(
													sectionRef
												)
											}
										/>
									) : null}
								</div>
							);
						})}
					</div>
				</SectionCard>

				<SectionCard
					title={copy.sections.works.title}
					description={copy.sections.works.description}>
					<div className='grid gap-6 md:grid-cols-2'>
						{worksExecutedBlocks.map((block) => {
							const sectionRef =
								getNarrativeRef(
									'works',
									block.id
								);
							const entry = sectionRef
								? translationState[
										sectionRef
											.key
								  ]
								: undefined;
							const chineseValue =
								report.works[
									block.id
								].zh;
							const frenchValue =
								report.works[
									block.id
								].fr;
							const canRetry =
								locale === 'fr' &&
								hasMeaningfulChineseContent(
									chineseValue
								) &&
								!hasAnyContent(
									frenchValue
								);
							return (
								<div
									key={
										block.id
									}
									className='space-y-2'>
									<RichTextField
										label={
											block
												.label[
												locale
											]
										}
										value={
											report
												.works[
												block
													.id
											][
												locale
											]
										}
										onChange={(
											value
										) =>
											updateWork(
												block.id,
												locale,
												value
											)
										}
									/>
									{locale ===
										'fr' &&
									sectionRef ? (
										<TranslationStatusHint
											entry={
												entry
											}
											canRetry={
												canRetry
											}
											onRetry={() =>
												handleManualTranslation(
													sectionRef
												)
											}
										/>
									) : null}
								</div>
							);
						})}
					</div>
				</SectionCard>

				<SectionCard
					title={copy.sections.additional.title}
					description={
						copy.sections.additional.description
					}>
					<div className='grid gap-6 md:grid-cols-2'>
						{additionalNarrativeSections.map(
							(section) => {
								const sectionRef =
									getNarrativeRef(
										'additional',
										section.id
									);
								const entry =
									sectionRef
										? translationState[
												sectionRef
													.key
										  ]
										: undefined;
								const chineseValue =
									report
										.additional[
										section
											.id
									].zh;
								const frenchValue =
									report
										.additional[
										section
											.id
									].fr;
								const canRetry =
									locale ===
										'fr' &&
									hasMeaningfulChineseContent(
										chineseValue
									) &&
									!hasAnyContent(
										frenchValue
									);
								return (
									<div
										key={
											section.id
										}
										className='space-y-2'>
										<RichTextField
											label={
												section
													.label[
													locale
												]
											}
											helper={
												section
													.helper[
													locale
												]
											}
											value={
												report
													.additional[
													section
														.id
												][
													locale
												]
											}
											onChange={(
												value
											) =>
												updateAdditional(
													section.id,
													locale,
													value
												)
											}
										/>
										{locale ===
											'fr' &&
										sectionRef ? (
											<TranslationStatusHint
												entry={
													entry
												}
												canRetry={
													canRetry
												}
												onRetry={() =>
													handleManualTranslation(
														sectionRef
													)
												}
											/>
										) : null}
									</div>
								);
							}
						)}
					</div>
				</SectionCard>
			</main>
		</>
	);
}

function LocaleToggle({
	label,
	value,
	onChange
}: {
	label: string;
	value: Locale;
	onChange: (locale: Locale) => void;
}) {
	return (
		<div className='flex items-center gap-3'>
			<span className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
				{label}
			</span>
			<div className='inline-flex rounded-full border border-slate-200 bg-white p-1'>
				{locales.map((option) => {
					const isActive = option === value;
					return (
						<button
							key={option}
							type='button'
							className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
								isActive
									? 'bg-slate-900 text-white'
									: 'text-slate-500 hover:text-slate-900'
							}`}
							onClick={() =>
								onChange(option)
							}
							aria-pressed={isActive}>
							{localeLabels[option]}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
	return (
		<div className='rounded-2xl border border-slate-100 bg-slate-50 p-4'>
			<p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
				{label}
			</p>
			<p className='mt-2 text-2xl font-semibold text-slate-900'>{value}</p>
			{helper ? (
				<p className='mt-1 text-xs text-slate-500'>{helper}</p>
			) : null}
		</div>
	);
}

function Field({
	label,
	htmlFor,
	children
}: {
	label: string;
	htmlFor?: string;
	children: ReactNode;
}) {
	return (
		<label htmlFor={htmlFor} className='flex flex-col gap-2 text-sm text-slate-700'>
			<span className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
				{label}
			</span>
			{children}
		</label>
	);
}

function RichTextField({
	label,
	helper,
	value,
	onChange
}: {
	label: string;
	helper?: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className='flex flex-col gap-2 text-sm text-slate-700'>
			<span className='text-sm font-medium text-slate-900'>{label}</span>
			{helper ? <p className='text-xs text-slate-500'>{helper}</p> : null}
			<textarea
				rows={6}
				className='min-h-[140px] rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500'
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	);
}

function TranslationStatusHint({
	entry,
	canRetry,
	onRetry
}: {
	entry?: TranslationEntry;
	canRetry: boolean;
	onRetry: () => void;
}) {
	if (!entry) {
		return null;
	}

	if (entry.status === 'pending') {
		return (
			<p className='text-xs text-blue-600'>
				Traduction automatique en cours…
			</p>
		);
	}

	if (entry.status === 'success') {
		return (
			<p className='text-xs text-emerald-600'>
				Version française générée à partir du texte chinois.
			</p>
		);
	}

	if (entry.status === 'error') {
		return (
			<div className='flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-3 py-2'>
				<p className='text-xs text-red-600'>
					Échec de la traduction&nbsp;:{' '}
					{entry.error ?? 'Veuillez réessayer plus tard.'}
				</p>
				<button
					type='button'
					className='text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-50'
					onClick={onRetry}
					disabled={!canRetry}>
					Relancer la traduction
				</button>
			</div>
		);
	}

	return null;
}
