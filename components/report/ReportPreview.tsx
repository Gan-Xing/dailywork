'use client';

import { Fragment, type ReactNode } from 'react';

import Image from 'next/image';

import type { Locale } from '@/lib/i18n';
import {
	additionalNarrativeSections,
	equipmentCatalog,
	materialItems,
	observationBlocks,
	personnelGroups,
	weatherConditions,
	weatherPeriods,
	worksExecutedBlocks
} from '@/lib/reportSchema';
import type { DailyReport, LocalizedRichText } from '@/lib/reportState';

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

interface LocalizedLabel {
	fr: string;
	zh: string;
}

const [primaryEntity, ...secondaryEntities] = participantEntities;

const monthLabels: Record<string, LocalizedLabel> = {
	'01': { fr: 'Janvier', zh: '1月' },
	'02': { fr: 'Février', zh: '2月' },
	'03': { fr: 'Mars', zh: '3月' },
	'04': { fr: 'Avril', zh: '4月' },
	'05': { fr: 'Mai', zh: '5月' },
	'06': { fr: 'Juin', zh: '6月' },
	'07': { fr: 'Juillet', zh: '7月' },
	'08': { fr: 'Août', zh: '8月' },
	'09': { fr: 'Septembre', zh: '9月' },
	'10': { fr: 'Octobre', zh: '10月' },
	'11': { fr: 'Novembre', zh: '11月' },
	'12': { fr: 'Décembre', zh: '12月' }
};

const weatherConditionMap = weatherConditions.reduce<Record<string, LocalizedLabel>>(
	(acc, condition) => {
		acc[condition.id] = condition.label;
		return acc;
	},
	{}
);

const formatDate = (value: string) => {
	if (!value) return '—';
	const [year, month, day] = value.split('-');
	if (year && month && day) {
		return `${day}/${month}/${year}`;
	}
	return value;
};

const displayValue = (value?: string | number | null) => {
	if (value === undefined || value === null) return '—';
	const source = typeof value === 'number' ? String(value) : value;
	const trimmed = source.trim();
	return trimmed === '' ? '—' : trimmed;
};

const getNarrativeText = (entry: LocalizedRichText | undefined, locale: Locale) => {
	if (!entry) return 'RAS';
	const preferred = entry[locale];
	if (preferred && preferred.trim()) {
		return preferred;
	}
	const fallback = locale === 'fr' ? entry.zh : entry.fr;
	return fallback && fallback.trim() ? fallback : 'RAS';
};

const sumPersonnel = (report: DailyReport, field: keyof DailyReport['expatriate']) =>
	Object.values(report.personnel).reduce(
		(acc, role) => acc + (Number(role[field]) || 0),
		0
	);

const sectionTitle = (label: LocalizedLabel, locale: Locale) => label[locale] ?? label.fr;

export interface ReportPreviewProps {
	report: DailyReport;
	locale?: Locale;
	className?: string;
}

export function ReportPreview({ report, locale = 'fr', className }: ReportPreviewProps) {
	const containerClassName = [
		'flex min-h-full w-full items-start justify-center bg-slate-200 p-0 print:bg-white',
		className
	]
		.filter(Boolean)
		.join(' ');
	const activeMonth = sectionTitle(
		monthLabels[report.metadata.month] ?? { fr: '—', zh: '—' },
		locale
	);
	const journalDate = formatDate(report.metadata.date || '');
	const totalPresent = sumPersonnel(report, 'present');
	const totalAbsent = sumPersonnel(report, 'absent');

	return (
		<div className={containerClassName}>
			<div className='flex w-full items-stretch justify-center bg-white p-0'>
				<div className='flex min-h-[1123px] w-full flex-col'>
					<div className='flex flex-col lg:flex-row lg:items-start'>
						<div className='w-full lg:basis-[25%] lg:max-w-[25%]'>
							<PrimaryIdentityPanel
								locale={locale}
							/>
						</div>
						<div className='w-full lg:basis-[25%] lg:max-w-[25%] lg:-ml-px'>
							<StakeholderPanel
								locale={locale}
							/>
						</div>
						<div className='w-full lg:basis-[50%] lg:max-w-[50%] lg:-ml-px'>
							<JournalInfoPanel
								locale={locale}
								monthLabel={
									activeMonth
								}
								year={displayValue(
									report
										.metadata
										.year
								)}
								date={journalDate}
								horaires={displayValue(
									report
										.metadata
										.horaires
								)}
								stoppage={displayValue(
									report
										.metadata
										.stoppageCause
								)}
								weather={
									report.weather
								}
							/>
						</div>
					</div>

					<div className='flex flex-col lg:flex-row lg:items-start lg:-mt-px'>
						<div className='flex w-full flex-col lg:basis-[25%] lg:max-w-[25%]'>
							<EquipmentTablePreview
								report={report}
								locale={locale}
							/>
							<MaterialsPreview
								report={report}
								locale={locale}
							/>
						</div>

						<div className='flex w-full flex-col lg:flex-1 lg:-ml-px'>
							<div className='flex flex-col lg:flex-row lg:items-stretch'>
								<div className='flex h-full flex-1 flex-col lg:basis-[40%] lg:max-w-[40%]'>
									<PersonnelPreview
										report={
											report
										}
										totalPresent={
											totalPresent
										}
										totalAbsent={
											totalAbsent
										}
										locale={
											locale
										}
									/>
								</div>
								<div
									className='flex h-full flex-1 flex-col lg:basis-[60%] lg:max-w-[60%] lg:-ml-px'
									style={{
										height: 'auto'
									}}>
									<ObservationGrid
										report={
											report
										}
										locale={
											locale
										}
									/>
								</div>
							</div>

							<div className='grid lg:grid-cols-2'>
								<NarrativeStack
									title='Travaux exécutés'
									locale={
										locale
									}
									bannerLabel='TRAVAUX EXECUTES'
									entries={worksExecutedBlocks.map(
										(
											block
										) => ({
											id: block.id,
											label: block.label,
											value: getNarrativeText(
												report
													.works[
													block
														.id
												],
												locale
											)
										})
									)}
								/>
								<NarrativeStack
									title='Contrôles'
									locale={
										locale
									}
									bannerLabel='CONTRÔLES'
									showVisa
									entries={additionalNarrativeSections.map(
										(
											section
										) => ({
											id: section.id,
											label: section.label,
											value: getNarrativeText(
												report
													.additional[
													section
														.id
												],
												locale
											)
										})
									)}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function SectionFrame({
	title,
	children,
	contentClassName,
	fullHeight = true
}: {
	title: string;
	children: ReactNode;
	contentClassName?: string;
	fullHeight?: boolean;
}) {
	const contentClasses = ['flex-1 overflow-hidden', contentClassName]
		.filter(Boolean)
		.join(' ');
	const frameClasses = [
		'flex',
		fullHeight ? 'h-full' : '',
		'flex-col',
		'overflow-hidden',
		'border',
		'border-slate-300',
		'bg-white'
	]
		.filter(Boolean)
		.join(' ');
	return (
		<section className={frameClasses}>
			<div className={contentClasses}>{children}</div>
		</section>
	);
}

function PrimaryIdentityPanel({ locale }: { locale: Locale }) {
	return (
		<SectionFrame title='' fullHeight={false}>
			<div className='flex h-full flex-col items-center justify-between gap-2 p-0 text-center'>
				<div className='flex h-20 w-full items-center justify-center bg-slate-50'>
					<Image
						src={primaryEntity.logo.src}
						alt={primaryEntity.label[locale]}
						width={primaryEntity.logo.width}
						height={primaryEntity.logo.height}
						className='max-h-16 w-auto object-contain'
					/>
				</div>
				<p className='text-[7px] font-semibold uppercase leading-tight text-slate-700'>
					{primaryEntity.label[locale]}
				</p>
				<div className='flex w-full flex-1 flex-col justify-center border border-slate-200 bg-white px-2 py-1.5 text-left text-[7px] leading-tight text-slate-700'>
					<p className='mt-0 break-words leading-tight'>
						TRAVAUX DE RENFORCEMENT DE LA ROUTE
						BONDOUKOU - BOUNA Y COMPRIS
						L&apos;AMENAGEMENT DES TRAVERSEES DE
						BOUNA, BONDOUKOU ET AGNIBILEKROU (MARCHE
						2024 - 0 - 11 - 00 - 2 - 0560/-330)
					</p>
				</div>
			</div>
		</SectionFrame>
	);
}

function StakeholderPanel({ locale }: { locale: Locale }) {
	const stakeholders = secondaryEntities;
	return (
		<SectionFrame title='' fullHeight={false}>
			<div className='flex flex-col gap-1 p-0'>
				{stakeholders.map((stakeholder) => (
					<div
						key={stakeholder.id}
						className='flex items-center justify-between gap-1 border border-slate-200 bg-white p-0'>
						<p className='text-left text-[8px] font-semibold uppercase leading-tight text-slate-700'>
							{stakeholder.label[locale]}
						</p>
						<div className='flex h-10 w-20 items-center justify-center bg-slate-50'>
							<Image
								src={
									stakeholder
										.logo
										.src
								}
								alt={
									stakeholder
										.label[
										locale
									]
								}
								width={
									stakeholder
										.logo
										.width
								}
								height={
									stakeholder
										.logo
										.height
								}
								className='max-h-8 w-auto object-contain'
							/>
						</div>
					</div>
				))}
			</div>
		</SectionFrame>
	);
}

function JournalInfoPanel({
	locale,
	monthLabel,
	year,
	date,
	horaires,
	stoppage,
	weather
}: {
	locale: Locale;
	monthLabel: string;
	year: string;
	date: string;
	horaires: string;
	stoppage: string;
	weather: DailyReport['weather'];
}) {
	return (
		<SectionFrame title=''>
			<div className='flex h-full flex-col gap-1.5 p-0 text-[9px] text-slate-600'>
				<div className='grid gap-1 md:grid-cols-[2fr_1fr] md:items-stretch'>
					<div className='flex h-full flex-col justify-between border border-slate-200 bg-white p-0'>
						<p className='break-words text-[9px] font-semibold uppercase leading-tight tracking-wide text-slate-800'>
							JOURNAL DE CHANTIER DU MOIS DE{' '}
							{monthLabel || '…'}{' '}
							{year || '…'}
						</p>
					</div>
					<div className='grid h-full grid-rows-3 gap-1 border border-slate-200 bg-white p-0 text-[8px] font-semibold text-slate-700'>
						<div className='flex items-center justify-center bg-slate-50 p-0 text-[9px] text-slate-800 leading-tight'>
							QUA - JDC - F2527
						</div>
						<div className='flex items-center justify-center bg-slate-50 p-0 leading-tight'>
							Date : {date || '—'}
						</div>
						<div className='flex items-center justify-center bg-slate-50 p-0 leading-tight'>
							Indice : 01
						</div>
					</div>
				</div>

				<div className='grid gap-1 md:grid-cols-[2fr_1fr]'>
					<div className='flex h-full flex-col overflow-hidden border border-slate-300 bg-white'>
						<table className='h-full w-full border-collapse text-[7px]'>
							<tbody>
								<tr>
									<td className='relative border border-slate-200 p-0 text-[8px] font-semibold uppercase tracking-wide text-slate-600'>
										<svg
											className='pointer-events-none absolute left-0 top-0 h-full w-full'
											viewBox='0 0 100 100'
											aria-hidden='true'>
											<line
												x1='0'
												y1='100'
												x2='100'
												y2='0'
												stroke='#cbd5f5'
												strokeWidth='0.8'
											/>
										</svg>
										<span className='absolute left-1 top-0.5 text-[8px] text-slate-700'>
											Objet
										</span>
										<span className='absolute bottom-0.5 right-1 text-[8px] text-slate-700'>
											Période
										</span>
									</td>
									{weatherPeriods.map(
										(
											period
										) => (
											<td
												key={
													period
												}
												className='border border-slate-200 p-0 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-700'>
												Relevé
												à{' '}
												{
													period
												}
											</td>
										)
									)}
									<td
										rowSpan={
											3
										}
										className='w-[18%] border border-slate-200 p-0 align-top text-[8px] font-semibold uppercase tracking-wide text-slate-700'>
										<div className='flex h-full flex-col'>
											<div className='border-b border-slate-200 p-0 text-center'>
												Mention
												possible
											</div>
											<div className='flex flex-col gap-0.5 p-1 text-left text-[8px] font-semibold normal-case text-slate-700'>
												<span>
													E
													=
													Ensoleillé
												</span>
												<span>
													C
													=
													Couvert
												</span>
												<span>
													B
													=
													Brouillard
												</span>
												<span>
													P
													=
													Pluie
												</span>
											</div>
										</div>
									</td>
								</tr>
								<tr>
									<td className='border border-slate-200 p-0 font-semibold text-slate-700'>
										Condition
										météorologique
									</td>
									{weatherPeriods.map(
										(
											period
										) => {
											const condition =
												weather[
													period
												];
											const label =
												condition
													? sectionTitle(
															weatherConditionMap[
																condition
																	.condition
															] ?? {
																fr: '—',
																zh: '—'
															},
															locale
													  )
													: '—';
											return (
												<td
													key={`${period}-condition`}
													className='border border-slate-200 p-0 text-center text-[9px] font-semibold text-slate-800'>
													{
														label
													}
												</td>
											);
										}
									)}
								</tr>
								<tr className='align-top'>
									<td className='border border-slate-200 p-0 font-semibold text-slate-700 align-top'>
										Pluviométrie
										(mm)
									</td>
									{weatherPeriods.map(
										(
											period
										) => {
											const rainfall =
												weather[
													period
												]
													?.rainfall ??
												'';
											return (
												<td
													key={`${period}-rainfall`}
													className='border border-slate-200 p-0 text-center text-[9px] font-semibold text-slate-800 align-top'>
													{displayValue(
														rainfall
													)}
												</td>
											);
										}
									)}
								</tr>
							</tbody>
						</table>
					</div>
					<div className='flex flex-col gap-1 border border-slate-200 bg-white p-1 text-[8px] text-slate-700'>
						<div className='flex items-center justify-center border border-dashed border-slate-300 py-1 px-1'>
							<div className='text-center'>
								<p className='text-[8px] font-semibold uppercase tracking-wide text-slate-600'>
									Horaires
								</p>
								<p className='text-[8px] font-semibold text-slate-900'>
									{horaires}
								</p>
							</div>
						</div>
						<div className='flex flex-col border border-dashed border-slate-300 p-1'>
							<p className='text-[8px] font-semibold uppercase tracking-wide text-slate-600'>
								Arrêt exceptionnel
							</p>
							<p className='mt-1 text-[7px] leading-tight text-slate-700 whitespace-pre-wrap'>
								{stoppage}
							</p>
						</div>
					</div>
				</div>
			</div>
		</SectionFrame>
	);
}

function EquipmentTablePreview({ report, locale }: { report: DailyReport; locale: Locale }) {
	const equipmentTotals = Object.values(report.equipment).reduce(
		(acc, entry) => ({
			total: acc.total + Number(entry.total || 0),
			marche: acc.marche + Number(entry.marche || 0),
			panne: acc.panne + Number(entry.panne || 0),
			arret: acc.arret + Number(entry.arret || 0)
		}),
		{ total: 0, marche: 0, panne: 0, arret: 0 }
	);

	return (
		<SectionFrame title='Matériel sur le chantier'>
			<div className='overflow-hidden'>
				<div className='border border-slate-300 bg-slate-50 py-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-700'>
					MATÉRIEL SUR LE CHANTIER
				</div>
				<table className='w-full table-fixed text-[8px] text-slate-700'>
					<colgroup>
						<col className='w-[5%]' />
						<col className='w-1/2' />
						<col />
						<col />
						<col />
						<col />
					</colgroup>
					<thead className='bg-slate-50'>
						<tr>
							<th
								colSpan={2}
								className='border border-slate-200 text-center'>
								Désignation
							</th>
							<th className='border border-slate-200'>
								Total
							</th>
							<th className='border border-slate-200'>
								Marche
							</th>
							<th className='border border-slate-200'>
								Panne
							</th>
							<th className='border border-slate-200'>
								Arrêt
							</th>
						</tr>
					</thead>
					<tbody>
						{equipmentCatalog.map((category) => (
							<Fragment key={category.id}>
								{category.items.map(
									(
										item,
										index
									) => {
										const entryId = `${category.id}-${item.id}`;
										const status =
											report
												.equipment[
												entryId
											];
										return (
											<tr
												key={
													entryId
												}>
												{index ===
												0 ? (
													<td
														rowSpan={
															category
																.items
																.length
														}
														className='border border-slate-200 bg-slate-50 text-center align-middle text-[8px] font-semibold uppercase tracking-wide text-slate-500'>
														<span
															className={`inline-block [writing-mode:vertical-rl] ${
																locale === 'fr' ? 'rotate-180' : ''
															}`}>
															{sectionTitle(
																category.name,
																locale
															)}
														</span>
													</td>
												) : null}
												<td className='border border-slate-200 text-left'>
													{sectionTitle(
														item.label,
														locale
													)}
												</td>
												<td className='border border-slate-200 text-center'>
													{displayValue(
														status?.total
													)}
												</td>
												<td className='border border-slate-200 text-center'>
													{displayValue(
														status?.marche
													)}
												</td>
												<td className='border border-slate-200 text-center'>
													{displayValue(
														status?.panne
													)}
												</td>
												<td className='border border-slate-200 text-center'>
													{displayValue(
														status?.arret
													)}
												</td>
											</tr>
										);
									}
								)}
							</Fragment>
						))}
						<tr className='font-semibold uppercase text-slate-600'>
							<td
								colSpan={2}
								className='border border-slate-300 bg-slate-50 text-right pr-2 text-[8px]'>
								Total
							</td>
							<td className='border border-slate-300 text-center'>
								{displayValue(
									String(
										equipmentTotals.total
									)
								)}
							</td>
							<td className='border border-slate-300 text-center'>
								{displayValue(
									String(
										equipmentTotals.marche
									)
								)}
							</td>
							<td className='border border-slate-300 text-center'>
								{displayValue(
									String(
										equipmentTotals.panne
									)
								)}
							</td>
							<td className='border border-slate-300 text-center'>
								{displayValue(
									String(
										equipmentTotals.arret
									)
								)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</SectionFrame>
	);
}

function MaterialsPreview({ report, locale }: { report: DailyReport; locale: Locale }) {
	return (
		<SectionFrame
			title='Approvisionnement en matériaux'
			contentClassName='flex-none overflow-visible'>
			<div className='overflow-hidden'>
				<div className='border border-slate-300 bg-slate-50 py-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-700'>
					APPROVISIONNEMENT EN MATERIAUX
				</div>
				<table className='w-full table-fixed text-[8px] text-slate-700'>
					<thead className='bg-slate-50'>
						<tr>
							<th className='w-1/3 border border-slate-200 text-left'>
								Désignation
							</th>
							<th className='border border-slate-200'>
								Stock préc.
							</th>
							<th className='border border-slate-200'>
								Entrée
							</th>
							<th className='border border-slate-200'>
								Sortie
							</th>
							<th className='border border-slate-200'>
								Nouveau stock
							</th>
						</tr>
					</thead>
					<tbody>
						{materialItems.map((item) => {
							const stock =
								report.materials[
									item.id
								];
							return (
								<tr key={item.id}>
									<td className='border border-slate-200'>
										{sectionTitle(
											item.label,
											locale
										)}{' '}
										<span className='text-[8px] uppercase text-slate-400'>
											(
											{
												item.unit
											}

											)
										</span>
									</td>
									<td className='border border-slate-200 text-center'>
										{displayValue(
											stock?.previous
										)}
									</td>
									<td className='border border-slate-200 text-center'>
										{displayValue(
											stock?.entry
										)}
									</td>
									<td className='border border-slate-200 text-center'>
										{displayValue(
											stock?.exit
										)}
									</td>
									<td className='border border-slate-200 text-center'>
										{displayValue(
											stock?.current
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</SectionFrame>
	);
}

function PersonnelPreview({
	report,
	totalPresent,
	totalAbsent,
	locale
}: {
	report: DailyReport;
	totalPresent: number;
	totalAbsent: number;
	locale: Locale;
}) {
	const managementGroup = personnelGroups.find(
		(group) => group.id === 'management-support'
	);
	const fieldGroup = personnelGroups.find((group) => group.id === 'field-subcontractors');

	if (!managementGroup || !fieldGroup) {
		return null;
	}

	const rightColumnRoles = [
		...fieldGroup.roles,
		{ id: '', label: { fr: '', zh: '' } },
		{ id: '', label: { fr: '', zh: '' } },
		{ id: 'total', label: { fr: 'TOTAL', zh: '总计' } },
		{ id: 'dont-expatrie', label: { fr: 'Dont Expatrié', zh: '外派人数' } }
	];

	const rowCount = Math.max(managementGroup.roles.length, rightColumnRoles.length);
	const rows = Array.from({ length: rowCount }, (_, index) => ({
		left: managementGroup.roles[index],
		right: rightColumnRoles[index]
	}));

	const getPersonnelEntry = (groupId: string, roleId: string) =>
		report.personnel[`${groupId}-${roleId}`] ?? { present: '', absent: '' };

	const formatCount = (value: string) => (value?.trim() ? value : '—');

	return (
		<SectionFrame title='Personnel sur le chantier'>
			<div className='overflow-hidden'>
				<div className='border border-slate-300 bg-slate-50 py-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-700'>
					PERSONNEL SUR LE CHANTIER
				</div>
				<table className='w-full table-fixed text-[8px] text-slate-700'>
					<thead className='bg-slate-50 text-[8px] font-semibold uppercase tracking-wide text-slate-500'>
						<tr>
							<th className='w-[36%] border border-slate-200 text-left'>
								FONCTION
							</th>
							<th className='w-[7%] border border-slate-200 '>
								Présent
							</th>
							<th className='w-[7%] border border-slate-200 '>
								Absent
							</th>
							<th className='w-[36%] border border-slate-200 text-left'>
								FONCTION
							</th>
							<th className='w-[7%] border border-slate-200'>
								Présent
							</th>
							<th className='w-[7%] border border-slate-200'>
								Absent
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(({ left, right }, index) => {
							const leftEntry = left
								? getPersonnelEntry(
										'management-support',
										left.id
								  )
								: undefined;
							let rightEntry:
								| PersonnelCount
								| undefined;
							if (right) {
								if (
									right.id ===
									'total'
								) {
									rightEntry =
										{
											present: String(
												totalPresent
											),
											absent: String(
												totalAbsent
											)
										};
								} else if (
									right.id ===
									'dont-expatrie'
								) {
									rightEntry =
										report.expatriate;
								} else if (
									right.id
								) {
									rightEntry =
										getPersonnelEntry(
											'field-subcontractors',
											right.id
										);
								} else {
									rightEntry =
										undefined;
								}
							}

							return (
								<tr
									key={`${
										left?.id ??
										'left-empty'
									}-${
										right?.id ??
										'right-empty'
									}-${index}`}>
									<td className='w-[36%] border border-slate-200'>
										{left
											? sectionTitle(
													left.label,
													locale
											  )
											: ''}
									</td>
									<td className='w-[7%] border border-slate-200 text-center'>
										{leftEntry
											? formatCount(
													leftEntry.present
											  )
											: '—'}
									</td>
									<td className='w-[7%] border border-slate-200 text-center'>
										{leftEntry
											? formatCount(
													leftEntry.absent
											  )
											: '—'}
									</td>
									<td className='w-[36%] border border-slate-200'>
										{right
											? sectionTitle(
													right.label,
													locale
											  )
											: ''}
									</td>
									<td className='w-[7%] border border-slate-200 text-center'>
										{rightEntry
											? formatCount(
													rightEntry.present
											  )
											: '—'}
									</td>
									<td className='w-[7%] border border-slate-200 text-center'>
										{rightEntry
											? formatCount(
													rightEntry.absent
											  )
											: '—'}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</SectionFrame>
	);
}

function ObservationGrid({ report, locale }: { report: DailyReport; locale: Locale }) {
	return (
		<SectionFrame title='Sûreté · Environnement · Observations'>
			<div className='h-full px-3 py-2'>
				<div className='grid h-full gap-2 lg:grid-cols-2 lg:grid-rows-2'>
					{observationBlocks.map((block) => (
						<div
							key={block.id}
							className='flex h-full flex-col border border-dashed border-slate-300 bg-white text-[8px]'>
							<p className='font-semibold uppercase tracking-wide text-slate-500'>
								{sectionTitle(
									block.label,
									locale
								)}
							</p>
							<div className='mt-1 flex-1 border border-slate-200 bg-white p-1 text-[8px] text-slate-700 whitespace-pre-wrap'>
								{getNarrativeText(
									report
										.observations[
										block
											.id
									],
									locale
								)}
							</div>
						</div>
					))}
				</div>
			</div>
		</SectionFrame>
	);
}

function NarrativeStack({
	title,
	entries,
	locale,
	bannerLabel,
	showVisa = false
}: {
	title: string;
	entries: { id: string; label: LocalizedLabel; value: string }[];
	locale: Locale;
	bannerLabel?: string;
	showVisa?: boolean;
}) {
	return (
		<SectionFrame title={title}>
			<div className='flex h-full flex-col overflow-hidden'>
				{bannerLabel ? (
					<div className='border border-slate-300 bg-slate-50 py-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-700'>
						{bannerLabel}
					</div>
				) : null}
				<div className='flex flex-1 flex-col gap-2 px-3 py-2'>
					{entries.map((entry) => {
						const isSubcontract =
							entry.id === 'sousTraites';
						const isVisaBlock =
							showVisa &&
							entry.id === 'divers';

						if (isVisaBlock) {
							return (
								<div
									key={
										entry.id
									}
									className='flex flex-1 flex-col border border-slate-200'>
									<div className='min-h-[90px] px-3 py-1'>
										<p className='text-[8px] font-semibold uppercase tracking-wide text-slate-500'>
											{sectionTitle(
												entry.label,
												locale
											)}
										</p>
										<p className='text-[8px] text-slate-700 whitespace-pre-wrap'>
											{
												entry.value
											}
										</p>
									</div>
									<div className='border-t border-slate-200 px-3 py-1 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-600'>
										VISA
									</div>
									<div className='flex flex-1 border-t border-slate-200 text-[8px] font-semibold uppercase tracking-wide text-slate-700'>
										<div className='flex min-h-[120px] flex-1 flex-col justify-start border-r border-slate-200 px-3 py-2 text-center'>
											POUR
											LA
											MAITRISE
											D'OEUVRE
										</div>
										<div className='flex min-h-[120px] flex-1 flex-col justify-start px-3 py-2 text-center'>
											POUR
											L'ENTREPRENEUR
										</div>
									</div>
								</div>
							);
						}

						return (
							<div
								key={entry.id}
								className={`border border-slate-200 px-3 py-1 ${
									isSubcontract
										? 'min-h-[180px]'
										: 'min-h-[90px]'
								}`}>
								<p className='text-[8px] font-semibold uppercase tracking-wide text-slate-500'>
									{sectionTitle(
										entry.label,
										locale
									)}
								</p>
								<p className='text-[8px] text-slate-700 whitespace-pre-wrap'>
									{
										entry.value
									}
								</p>
							</div>
						);
					})}
				</div>
			</div>
		</SectionFrame>
	);
}
