'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertDialog } from '@/components/AlertDialog';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { locales, type Locale } from '@/lib/i18n';
import { getHomeCopy } from '@/lib/i18n/home';
import { usePreferredLocale } from '@/lib/usePreferredLocale';

type SessionUser = {
	username: string;
	roles: { id: number; name: string }[];
	permissions: string[];
};

type RoadmapItem = {
	id: number;
	title: string;
	details: string | null;
	priority: number;
	importance: number;
	difficulty: number;
	status: 'PENDING' | 'DONE';
	createdAt: string;
	completedAt: string | null;
};

export default function HomePage() {
	const { locale, setLocale } = usePreferredLocale('zh', locales);
	const t = getHomeCopy(locale);
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
	const [accessDialogOpen, setAccessDialogOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
	const [roadmapLoading, setRoadmapLoading] = useState(false);
	const [roadmapError, setRoadmapError] = useState<string | null>(null);
	const [roadmapIndex, setRoadmapIndex] = useState(0);
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
			'/value': ['value:view'],
			'/roadmap': ['roadmap:view'],
		}),
		[]
	);

	const canViewReports = can(modulePermissions['/reports']);
	const canViewProgress = can(modulePermissions['/progress']);
	const canViewMembers = can(modulePermissions['/members']);
	const canViewFinance = can(modulePermissions['/finance']);
	const canViewRoadmap = can(modulePermissions['/roadmap']);
	const roadmapTitle = canViewRoadmap ? t.extension.title : t.extension.previewTitle;
	const roadmapDescription = canViewRoadmap
		? t.extension.description
		: t.extension.previewDescription;
	const roadmapHelper = canViewRoadmap ? t.extension.helper : t.extension.previewHelper;
	const roadmapPending = useMemo(
		() => roadmapItems.filter((item) => item.status === 'PENDING'),
		[roadmapItems]
	);
	const roadmapDone = useMemo(
		() => roadmapItems.filter((item) => item.status === 'DONE'),
		[roadmapItems]
	);
	const roadmapPreview = useMemo(() => {
		return [...roadmapPending].sort(
			(a, b) => b.priority - a.priority || b.importance - a.importance || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}, [roadmapPending]);

	useEffect(() => {
		const list = roadmapPreview.length ? roadmapPreview : roadmapPending;
		if (list.length <= 1) return;
		const timer = setInterval(() => {
			setRoadmapIndex((prev) => (prev + 1) % list.length);
		}, 5200);
		return () => clearInterval(timer);
	}, [roadmapPending, roadmapPreview]);

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
		const loadRoadmap = async () => {
			if (!canViewRoadmap) return;
			setRoadmapLoading(true);
			setRoadmapError(null);
			try {
				const res = await fetch('/api/roadmap', { credentials: 'include' });
				const data = (await res.json()) as { items?: RoadmapItem[]; message?: string };
				if (!res.ok) {
					throw new Error(data.message ?? '加载失败');
				}
				setRoadmapItems(data.items ?? []);
			} catch (error) {
				setRoadmapError((error as Error).message);
			} finally {
				setRoadmapLoading(false);
			}
		};
		loadRoadmap();
	}, [canViewRoadmap]);

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
		setAccessDialogOpen(true);
	};

	const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsChanging(true);
		setChangeMessage(null);

		if (newPassword !== confirmPassword) {
			setChangeMessage(t.changePassword.mismatch);
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
				setChangeMessage(data.message ?? t.changePassword.updateFailed);
			} else {
				setChangeMessage(t.changePassword.updateSuccess);
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
										{t.changePassword.trigger}
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

				{canViewRoadmap ? (
					<section className='mt-12 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/5 p-6 text-sm text-slate-100 shadow-xl shadow-slate-950/20 backdrop-blur'>
						<div className='grid gap-6 lg:grid-cols-[1.2fr,1fr] lg:items-stretch'>
							<div className='flex h-full flex-col gap-4'>
								<div className='flex items-center gap-2'>
									<div className='h-2 w-2 rounded-full bg-emerald-300' />
									<p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
										{t.extension.label}
									</p>
									<span className='rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-emerald-100'>
										ROADMAP
									</span>
								</div>
								<h2 className='text-2xl font-semibold text-slate-50 sm:text-3xl'>
									{roadmapTitle}
								</h2>
								<p className='max-w-2xl text-slate-200/80'>
									{roadmapDescription}
								</p>
								<div className='mt-auto flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold text-slate-900'>
									<div className='flex flex-wrap items-center gap-3'>
										<span className='inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-3 py-2 text-emerald-900 shadow shadow-emerald-300/20 ring-1 ring-emerald-200/60'>
											<span className='h-2 w-2 rounded-full bg-emerald-400' />
											{t.extension.progressTitle} {roadmapPending.length}
										</span>
										<span className='inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-3 py-2 text-amber-900 shadow shadow-amber-300/20 ring-1 ring-amber-200/60'>
											<span className='h-2 w-2 rounded-full bg-amber-400' />
											{t.extension.doneTitle} {roadmapDone.length}
										</span>
									</div>
									<Link
										href='/roadmap'
										onClick={(event) =>
											handleModuleClick(event, '/roadmap', modulePermissions['/roadmap'])
										}
										aria-disabled={!canViewRoadmap}
										className='inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/15 transition hover:-translate-y-0.5 hover:shadow-emerald-400/25'
									>
										{t.extension.cta}
										<span aria-hidden>↗</span>
									</Link>
								</div>
							</div>
							<div className='flex h-full min-h-[180px] flex-col rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-emerald-500/10'>
								<div className='flex items-center justify-end text-xs text-slate-200/80'>
									{roadmapLoading ? <span className='text-emerald-200'>加载中...</span> : null}
									{roadmapError ? <span className='text-amber-200'>{roadmapError}</span> : null}
								</div>
								<div className='mt-2 flex-1'>
									{(roadmapPreview.length ? roadmapPreview : roadmapPending).length === 0 && !roadmapLoading ? (
										<p className='text-xs text-slate-300/80'>{t.extension.helper}</p>
									) : (
										<div className='relative h-full overflow-hidden'>
											<div className='absolute inset-0 flex items-center'>
												{(() => {
													const list = roadmapPreview.length ? roadmapPreview : roadmapPending;
													const current = list[roadmapIndex % list.length];
													if (!current) return null;
													return (
														<div
															key={`${current.id}-${roadmapIndex}`}
															className='w-full min-h-[156px] rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-slate-50 shadow-sm shadow-slate-900/20 animate-roadmap-rise will-change-transform'
														>
															<div className='flex items-start justify-between gap-2 text-xs text-slate-200/80'>
																<span>{new Date(current.createdAt).toLocaleDateString(locale)}</span>
																<div className='flex gap-1 text-[10px]'>
																	<span className='rounded-full bg-emerald-300/25 px-2 py-0.5 text-emerald-100 ring-1 ring-emerald-300/50'>P{current.priority}</span>
																	<span className='rounded-full bg-cyan-300/25 px-2 py-0.5 text-cyan-100 ring-1 ring-cyan-300/50'>I{current.importance}</span>
																	<span className='rounded-full bg-slate-300/20 px-2 py-0.5 text-slate-100 ring-1 ring-white/30'>D{current.difficulty}</span>
																</div>
															</div>
															<p className='mt-2 text-sm font-semibold text-slate-50'>{current.title}</p>
															{current.details ? (
																<p className='text-xs text-slate-200/80 line-clamp-3'>{current.details}</p>
															) : null}
														</div>
													);
												})()}
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					</section>
				) : (
					<section className='mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-100 shadow-xl shadow-slate-950/20 backdrop-blur'>
						<div className='flex items-center gap-3 overflow-x-auto pb-1'>
							<span className='inline-flex items-center gap-2 whitespace-nowrap text-base font-semibold text-slate-50'>
								<span className='h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]' />
								路线预告
							</span>
							<div className='flex items-center gap-2'>
								{t.extension.previewItems.map((item) => (
									<span
										key={item}
										className='whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-slate-50 transition duration-150 hover:border-white/25 hover:bg-white/15'>
										{item}
									</span>
								))}
							</div>
						</div>
					</section>
				)}
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
								{t.changePassword.title}
							</h2>
							<button
								type='button'
								onClick={() => setChangeOpen(false)}
								className='rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200 transition hover:border-white/40 hover:bg-white/10'
								aria-label={t.auth.close}>
								×
							</button>
						</div>
						<form className='mt-4 space-y-3' onSubmit={handleChangePassword}>
							<label className='flex flex-col gap-2 text-sm text-slate-100'>
								{t.changePassword.current}
								<input
									type='password'
									className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-blue-300 focus:outline-none'
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									required
								/>
							</label>
							<label className='flex flex-col gap-2 text-sm text-slate-100'>
								{t.changePassword.next}
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
								{t.changePassword.confirm}
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
									{isChanging ? t.changePassword.submitting : t.changePassword.save}
								</button>
								{changeMessage ? (
									<span className='text-xs text-amber-200'>
										{changeMessage}
									</span>
								) : (
									<span className='text-xs text-slate-300'>
										{t.changePassword.hint}
									</span>
								)}
							</div>
						</form>
					</div>
				</div>
			) : null}

			<AlertDialog
				open={accessDialogOpen}
				title={t.moduleDialog.title}
				description={t.moduleDialog.description}
				actionLabel={t.moduleDialog.close}
				tone='warning'
				onClose={() => setAccessDialogOpen(false)}
			/>
		</main>
	);
}
