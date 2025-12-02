'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { locales, type Locale } from '@/lib/i18n';
import { usePreferredLocale } from '@/lib/usePreferredLocale';

type Module = {
	title: string;
	href: string;
	tone: string;
	description: string;
	tags: string[];
	cta: string;
};

type Copy = {
	hero: {
		intro: string;
		reports: string;
		connector: string;
		progress: string;
		suffix: string;
		description: string;
		primaryCta: string;
		secondaryCta: string;
	};
	moduleBadge: string;
	moduleStatus: string;
	modules: Module[];
	stats: {
		entriesLabel: string;
		entriesValue: string;
		recentLabel: string;
		recentValue: string;
		upcomingTitle: string;
		upcomingBody: string;
	};
	extension: {
		label: string;
		items: string[];
		description: string;
	};
	auth: {
		login: string;
		loggingIn: string;
		logout: string;
		loggingOut: string;
		title: string;
		username: string;
		password: string;
		hint: string;
		loggedInPrefix: string;
		needLogin: string;
		noPermission: string;
		loginSuccess: string;
		loginFail: string;
		loginRequired: string;
		close: string;
	};
};

const copy: Record<Locale, Copy> = {
	zh: {
		hero: {
			intro: '集中入口，协调',
			reports: '日报',
			connector: '与',
			progress: '进度',
			suffix: '。',
		description:
			'把一线更新、项目里程碑放在同一块操作面板，保持团队节奏一致。当前开放 5 个核心入口（含成员管理、产值计量与财务记账），后续模块可随时接入。',
			primaryCta: '立即填写日报',
			secondaryCta: '查看项目进度'
		},
		moduleBadge: '入口',
		moduleStatus: '持续维护',
		modules: [
			{
				title: '日报系统',
				href: '/reports',
				tone: 'from-blue-400/80 via-cyan-300/80 to-emerald-300/60',
				description: '快速进入日报录入与日历视图，保持现场信息连续更新。',
				tags: ['创建/编辑', '月历视图', '最近更新'],
				cta: '进入日报'
			},
			{
				title: '项目进度',
				href: '/progress',
				tone: 'from-orange-300/80 via-amber-200/80 to-rose-300/80',
				description: '汇总工期节点、关键风险与甘特视图，规划对齐更直观。',
				tags: ['里程碑', '风险跟踪', '甘特预览'],
				cta: '查看进度'
			},
			{
				title: '成员管理',
				href: '/members',
				tone: 'from-teal-300/80 via-sky-300/80 to-indigo-300/70',
				description:
					'集中维护成员信息、角色与权限，支持导入导出与审计记录，中法双语可切换。',
				tags: ['成员信息', '角色/权限', '导入导出'],
				cta: '进入成员管理'
			},
			{
				title: '财务记账',
				href: '/finance',
				tone: 'from-emerald-300/80 via-teal-300/80 to-blue-400/70',
				description: '按项目录入财务流水，支持序号自动生成、分类与税费字段，方便后续统计。',
				tags: ['项目选择', '分类/支付方式', '含税金额'],
				cta: '进入财务'
			},
			{
				title: '产值计量',
				href: '/value',
				tone: 'from-indigo-300/80 via-purple-300/80 to-fuchsia-300/80',
				description: '按分项统计设计/完成量与单价，实时跟踪产值进度与完成率。',
				tags: ['单价/产值', '完成率', '工程汇总'],
				cta: '查看产值详情'
			}
		],
		stats: {
			entriesLabel: '当前入口',
			entriesValue: '5',
			recentLabel: '最近更新',
			recentValue: '新增成员管理与产值计量入口，日报/进度/财务持续维护',
			upcomingTitle: '即将推出',
			upcomingBody: '支持更多入口：质量巡检、物资追踪、风险复盘。'
		},
		extension: {
			label: '扩展空间',
			items: ['质量巡检', '物资进出', '风险复盘', 'AI 总结', '导出中心'],
			description: '未来的入口会延续同一视觉规范：清晰分区、带状态标识、可快速跳转到具体场景。需要新增模块时直接在此卡片组追加即可。'
		},
		auth: {
			login: '登录',
			loggingIn: '登录中...',
			logout: '退出登录',
			loggingOut: '正在退出...',
			title: '登录',
			username: '用户名',
			password: '密码',
			hint: '如无账号，请联系管理员开通。',
			loggedInPrefix: '已登录',
			needLogin: '需登录',
			noPermission: '权限不足',
			loginSuccess: '登录成功，权限已更新',
			loginFail: '登录失败',
			loginRequired: '请先登录后再访问该模块',
			close: '关闭'
		}
	},
	fr: {
		hero: {
			intro: 'Un hub unique pour coordonner les',
			reports: 'rapports journaliers',
			connector: 'et le',
			progress: "suivi d'avancement",
			suffix: '.',
		description:
				'Regroupez les mises à jour terrain et les jalons projet sur le même tableau de bord. Cinq accès clés (dont la gestion des membres, le calcul des valeurs et la comptabilité) sont prêts, les suivants se brancheront facilement.',
			primaryCta: 'Remplir un rapport',
			secondaryCta: "Voir l'avancement"
		},
		moduleBadge: 'Entrée',
		moduleStatus: 'Maintenance continue',
		modules: [
			{
				title: 'Rapport quotidien',
				href: '/reports',
				tone: 'from-blue-400/80 via-cyan-300/80 to-emerald-300/60',
				description: 'Accès direct à la saisie, au calendrier et aux derniers rapports pour garder le terrain synchronisé.',
				tags: [
					'Créer/éditer',
					'Vue calendrier',
					'Dernières mises à jour'
				],
				cta: 'Ouvrir le rapport'
			},
			{
				title: 'Avancement du projet',
				href: '/progress',
				tone: 'from-orange-300/80 via-amber-200/80 to-rose-300/80',
				description: 'Rassembler jalons, risques clés et aperçu Gantt pour un alignement clair.',
				tags: ['Jalons', 'Suivi des risques', 'Vue Gantt'],
				cta: "Consulter l'avancement"
			},
			{
				title: 'Gestion des membres',
				href: '/members',
				tone: 'from-teal-300/80 via-sky-300/80 to-indigo-300/70',
				description:
					'Centraliser les fiches, rôles et permissions avec import/export et audit, en chinois et français.',
				tags: ['Profils', 'Rôles/Permissions', 'Import/Export'],
				cta: 'Ouvrir membres'
			},
			{
				title: 'Comptabilité',
				href: '/finance',
				tone: 'from-emerald-300/80 via-teal-300/80 to-blue-400/70',
				description: 'Saisir les écritures par projet avec numéro auto, catégorie, mode de paiement et TVA pour préparer les états financiers.',
				tags: ['Projet', 'Catégorie/paiement', 'Montant TTC'],
				cta: 'Ouvrir la compta'
			},
			{
				title: 'Calcul des valeurs',
				href: '/value',
				tone: 'from-indigo-300/80 via-purple-300/80 to-fuchsia-300/80',
				description: 'Regroupe quantités prévues/réalisées et prix unitaires par sous-ouvrage pour suivre la valeur validée.',
				tags: ['Prix unitaires', 'Valeurs réalisées', 'Progression'],
				cta: 'Voir les valeurs'
			}
		],
		stats: {
			entriesLabel: 'Entrées actives',
			entriesValue: '5',
			recentLabel: 'Mise à jour',
			recentValue: 'Entrées membres et valeurs ajoutées, rapport/avancement/compta synchronisés',
			upcomingTitle: 'Prochainement',
			upcomingBody: 'Inspection qualité, flux matériaux, revues de risques.'
		},
		extension: {
			label: "Espace d'extension",
			items: [
				'Inspection qualité',
				'Flux de matériaux',
				'Revue des risques',
				'Synthèse IA',
				"Centre d'export"
			],
			description: 'Les futurs modules suivront la même grille visuelle : zones claires, statut visible et navigation rapide vers chaque scénario. Ajoutez simplement une carte ici quand un nouveau module arrive.'
		},
		auth: {
			login: 'Connexion',
			loggingIn: 'Connexion...',
			logout: 'Déconnexion',
			loggingOut: 'Déconnexion...',
			title: 'Connexion',
			username: 'Identifiant',
			password: 'Mot de passe',
			hint: 'Si vous n’avez pas de compte, contactez un administrateur.',
			loggedInPrefix: 'Connecté',
			needLogin: 'Connexion requise',
			noPermission: 'Droit insuffisant',
			loginSuccess: 'Connecté, droits mis à jour',
			loginFail: 'Échec de connexion',
			loginRequired: 'Connectez-vous pour accéder à ce module',
			close: 'Fermer'
		}
	}
};

type SessionUser = {
	username: string;
	roles: { id: number; name: string }[];
	permissions: string[];
};

export default function HomePage() {
	const { locale, setLocale } = usePreferredLocale('zh', locales);
	const t = copy[locale];
	const [session, setSession] = useState<SessionUser | null>(null);
	const [loginOpen, setLoginOpen] = useState(false);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [loginMessage, setLoginMessage] = useState<string | null>(null);
	const [isSubmitting, setSubmitting] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [changeOpen, setChangeOpen] = useState(false);
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [changeMessage, setChangeMessage] = useState<string | null>(null);
	const [isChanging, setIsChanging] = useState(false);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const searchParams = useSearchParams();

	const can = useCallback(
		(required: string[]) => {
			if (!required.length) return true;
			if (!session) return false;
			return required.some((perm) => session.permissions.includes(perm));
		},
		[session]
	);
	const modulePermissions: Record<string, string[]> = useMemo(
		() => ({
			'/reports': ['report:view', 'report:edit'],
			'/progress': ['progress:view'],
			'/members': ['member:view'],
			'/finance': ['finance:view'],
			'/value': ['progress:view']
		}),
		[]
	);

	const canViewReports = can(modulePermissions['/reports']);
	const canViewProgress = can(modulePermissions['/progress']);
	const canViewMembers = can(modulePermissions['/members']);
	const canViewFinance = can(modulePermissions['/finance']);

	useEffect(() => {
		const loadSession = async () => {
			try {
				const res = await fetch('/api/auth/session', {
					credentials: 'include'
				});
				const data = (await res.json()) as {
					user: SessionUser | null;
				};
				if (data.user) {
					setSession(data.user);
				}
			} catch {
				// ignore
			}
		};
		loadSession();
	}, []);

	useEffect(() => {
		if (searchParams?.get('login') === '1') {
			setLoginOpen(true);
		}
	}, [searchParams]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent | TouchEvent) => {
			if (
				menuOpen &&
				menuRef.current &&
				!menuRef.current.contains(event.target as Node)
			) {
				setMenuOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('touchstart', handleClickOutside);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('touchstart', handleClickOutside);
		};
	}, [menuOpen]);

	const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitting(true);
		setLoginMessage(null);
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			const data = (await res.json()) as {
				user?: SessionUser;
				message?: string;
			};
			if (!res.ok || !data.user) {
				setLoginMessage(data.message ?? t.auth.loginFail);
			} else {
				setSession(data.user);
				setLoginOpen(false);
				setMenuOpen(false);
				setLoginMessage(t.auth.loginSuccess);
			}
		} catch (error) {
			setLoginMessage((error as Error).message);
		} finally {
			setSubmitting(false);
		}
	};

	const handleLogout = async () => {
		setIsLoggingOut(true);
		setLoginMessage(null);
		try {
			await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include'
			});
			setSession(null);
			setMenuOpen(false);
			setChangeOpen(false);
		} finally {
			setIsLoggingOut(false);
		}
	};

	const handleModuleClick = (
		event: React.MouseEvent,
		href: string,
		requiredPermissions: string[]
	) => {
		const allowed = can(requiredPermissions);
		if (allowed) return;
		event.preventDefault();
		if (!session) {
			setLoginOpen(true);
			setLoginMessage(t.auth.loginRequired);
			return;
		}
		const codes = requiredPermissions.length
			? requiredPermissions.join(' / ')
			: t.auth.noPermission;
		alert(`${t.auth.noPermission}：${codes}`);
	};

	const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsChanging(true);
		setChangeMessage(null);

		if (newPassword !== confirmPassword) {
			setChangeMessage('两次输入的新密码不一致');
			setIsChanging(false);
			return;
		}

		try {
			const res = await fetch('/api/auth/change-password', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword })
			});
			const data = (await res.json()) as { message?: string };
			if (!res.ok) {
				setChangeMessage(data.message ?? '修改失败');
			} else {
				setChangeMessage('密码已更新，请妥善保存');
				setCurrentPassword('');
				setNewPassword('');
				setConfirmPassword('');
				setChangeOpen(false);
				setMenuOpen(false);
			}
		} catch (error) {
			setChangeMessage((error as Error).message);
		} finally {
			setIsChanging(false);
		}
	};

	return (
		<main className='relative isolate min-h-screen overflow-hidden bg-slate-950 text-slate-50'>
			<div className='absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(69,162,255,0.15),transparent_25%),radial-gradient(circle_at_90%_10%,rgba(244,137,37,0.16),transparent_20%),radial-gradient(circle_at_60%_70%,rgba(72,236,169,0.15),transparent_25%)]' />
			<div className='absolute left-1/2 top-0 -z-10 h-80 w-[60vw] -translate-x-1/2 rounded-full bg-gradient-to-br from-white/8 via-blue-400/10 to-transparent blur-3xl' />

			<div className='relative mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-12'>
				<div className='mb-6 flex flex-wrap items-center justify-end gap-3'>
					{session ? (
						<div className='relative' ref={menuRef}>
							<button
								type='button'
								onClick={() =>
									setMenuOpen(
										(prev) => !prev
									)
								}
								className='inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-white/20'>
								{t.auth.loggedInPrefix} · {session.username}
								<span aria-hidden>
									▾
								</span>
							</button>
							{menuOpen ? (
								<div className='absolute right-0 mt-2 w-40 rounded-2xl border border-white/15 bg-slate-900/95 p-2 text-xs text-slate-50 shadow-xl shadow-slate-950/30 backdrop-blur'>
									<button
										type='button'
										className='flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-white/10'
										onClick={() => {
											setChangeOpen(true);
											setMenuOpen(false);
										}}>
										修改密码
										<span aria-hidden>
											↗
										</span>
									</button>
									<button
										type='button'
										className='flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-rose-100 transition hover:bg-white/10'
										onClick={() => {
											setMenuOpen(false);
											handleLogout();
										}}
										disabled={
											isLoggingOut
										}>
										{isLoggingOut
											? t.auth.loggingOut
											: t.auth.logout}
										<span aria-hidden>
											⎋
										</span>
									</button>
								</div>
							) : null}
						</div>
					) : (
						<button
							type='button'
							onClick={() =>
								setLoginOpen(true)
							}
							className='rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10'>
							{t.auth.login}
						</button>
					)}
					<LocaleSwitcher
						locale={locale}
						onChange={setLocale}
						variant='dark'
					/>
				</div>
				<header className='flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between'>
					<div className='space-y-4'>
						<p className='inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
							DAILYWORK
							<span className='h-[1px] w-10 bg-slate-300/40' />
							HUB
						</p>
						<div className='space-y-3'>
							<h1 className='text-4xl font-semibold leading-tight sm:text-5xl'>
								{t.hero.intro}
								<span className='bg-gradient-to-r from-blue-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent'>
									{
										t
											.hero
											.reports
									}
								</span>
								<span className='mx-1'>
									{
										t
											.hero
											.connector
									}
								</span>
								<span className='bg-gradient-to-r from-orange-200 via-amber-100 to-rose-200 bg-clip-text text-transparent'>
									{
										t
											.hero
											.progress
									}
								</span>
								{t.hero.suffix}
							</h1>
							<p className='max-w-2xl text-lg text-slate-200/80'>
								{t.hero.description}
							</p>
						</div>
						<div className='flex flex-wrap gap-3'>
							<Link
								href='/reports'
								onClick={(event) =>
									handleModuleClick(event, '/reports', modulePermissions['/reports'])
								}
								aria-disabled={!canViewReports}
								className='inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-blue-500/30 aria-disabled:cursor-not-allowed aria-disabled:opacity-60'>
								{t.hero.primaryCta}
								<span aria-hidden>
									↗
								</span>
							</Link>
							<Link
								href='/progress'
								onClick={(event) =>
									handleModuleClick(event, '/progress', modulePermissions['/progress'])
								}
								aria-disabled={!canViewProgress}
								className='inline-flex items-center gap-2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-50 transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10 aria-disabled:cursor-not-allowed aria-disabled:opacity-60'>
								{
									t.hero
										.secondaryCta
								}
							</Link>
						</div>
					</div>

				</header>

				<section className='mt-12 grid gap-6 md:grid-cols-2'>
					{t.modules.map((module) => {
						const required = modulePermissions[module.href] ?? [];
						const allowed = can(required);
						const locked = !allowed;
						return (
							<Link
								key={module.title}
								href={module.href}
								onClick={(event) => handleModuleClick(event, module.href, required)}
								aria-disabled={locked}
								className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30 transition duration-200 hover:-translate-y-1 hover:border-white/25 hover:shadow-slate-950/40 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 sm:p-6`}
							>
								<div
									className={`absolute inset-0 -z-10 bg-gradient-to-br ${module.tone} opacity-60 transition duration-200 group-hover:opacity-90`}
								/>
								{locked ? (
									<div className='absolute inset-0 z-10 bg-slate-950/30 backdrop-blur-[1px]' />
								) : null}
								<div className='mt-3 flex items-center justify-between gap-3'>
									<h2 className='text-xl font-semibold leading-tight text-slate-950 sm:text-2xl'>
									{module.title}
								</h2>
								{locked ? (
									<span className='shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold leading-none text-amber-100'>
											{session ? t.auth.noPermission : t.auth.needLogin}
										</span>
									) : null}
								</div>
								<p className='mt-2 text-sm text-slate-900/90'>{module.description}</p>
								<div className='mt-3 flex flex-wrap gap-2'>
									{module.tags.map((tag) => (
										<span
											key={tag}
											className='rounded-full bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900'>
											{tag}
										</span>
									))}
								</div>
								<div className='mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition group-hover:translate-x-0.5'>
									{module.cta}
									<span aria-hidden className='text-base'>
										→
									</span>
								</div>
							</Link>
						);
					})}
				</section>

				<section className='mt-12 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-100 backdrop-blur'>
					<div className='flex items-center gap-2'>
						<div className='h-2 w-2 rounded-full bg-emerald-300' />
						<p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
							{t.extension.label}
						</p>
					</div>
					<div className='flex flex-wrap gap-3'>
						{t.extension.items.map((item) => (
							<span
								key={item}
								className='rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-50'>
								{item}
							</span>
						))}
					</div>
					<p className='text-slate-200/80'>
						{t.extension.description}
					</p>
				</section>
			</div>

			{loginOpen ? (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur'>
					<div className='w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-emerald-500/20'>
						<div className='flex items-center justify-between'>
							<h2 className='text-lg font-semibold text-slate-50'>
								{t.auth.title}
							</h2>
							<button
								type='button'
								onClick={() =>
									setLoginOpen(
										false
									)
								}
								className='rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200 transition hover:border-white/40 hover:bg-white/10'
								aria-label={t.auth.close}>
								×
							</button>
						</div>
						<form
							className='mt-4 space-y-3'
							onSubmit={handleLogin}>
							<label className='flex flex-col gap-2 text-sm text-slate-100'>
								{t.auth.username}
								<input
									className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
									value={
										username
									}
									onChange={(
										e
									) =>
										setUsername(
											e
												.target
												.value
										)
									}
									autoComplete='username'
									required
								/>
							</label>
							<label className='flex flex-col gap-2 text-sm text-slate-100'>
								{t.auth.password}
								<input
									type='password'
									className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
									value={
										password
									}
									onChange={(
										e
									) =>
										setPassword(
											e
												.target
												.value
										)
									}
									autoComplete='current-password'
									required
								/>
							</label>
							<div className='flex items-center gap-3'>
								<button
									type='submit'
									disabled={
										isSubmitting
									}
									className='inline-flex items-center justify-center rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70'>
									{isSubmitting
										? t.auth.loggingIn
										: t.auth.login}
								</button>
								{loginMessage ? (
									<span className='text-xs text-amber-200'>
										{
											loginMessage
										}
									</span>
								) : (
									<span className='text-xs text-slate-300'>
										{t.auth.hint}
									</span>
								)}
							</div>
						</form>
					</div>
				</div>
			) : null}

			{changeOpen ? (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur'>
					<div className='w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-blue-500/20'>
						<div className='flex items-center justify-between'>
							<h2 className='text-lg font-semibold text-slate-50'>
								修改密码
							</h2>
							<button
								type='button'
								onClick={() => setChangeOpen(false)}
								className='rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200 transition hover:border-white/40 hover:bg-white/10'
								aria-label={locale === 'fr' ? 'Fermer' : '关闭'}>
								×
							</button>
						</div>
						<form className='mt-4 space-y-3' onSubmit={handleChangePassword}>
							<label className='flex flex-col gap-2 text-sm text-slate-100'>
								当前密码
								<input
									type='password'
									className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-blue-300 focus:outline-none'
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									required
								/>
							</label>
							<label className='flex flex-col gap-2 text-sm text-slate-100'>
								新密码
								<input
									type='password'
									className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-blue-300 focus:outline-none'
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									required
									minLength={6}
								/>
							</label>
							<label className='flex flex-col gap-2 text-sm text-slate-100'>
								确认新密码
								<input
									type='password'
									className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-blue-300 focus:outline-none'
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									required
									minLength={6}
								/>
							</label>
							<div className='flex items-center gap-3'>
								<button
									type='submit'
									disabled={isChanging}
									className='inline-flex items-center justify-center rounded-2xl bg-blue-200 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-blue-400/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70'>
									{isChanging ? '提交中...' : '保存密码'}
								</button>
								{changeMessage ? (
									<span className='text-xs text-amber-200'>
										{changeMessage}
									</span>
								) : (
									<span className='text-xs text-slate-300'>
										最短 6 位，修改后会保持登录状态
									</span>
								)}
							</div>
						</form>
					</div>
				</div>
			) : null}
		</main>
	);
}
