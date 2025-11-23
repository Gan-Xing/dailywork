import Link from 'next/link';

import { RoadBoard } from './RoadBoard';
import type { RoadSectionDTO } from '@/lib/progressTypes';
import { listRoadSections } from '@/lib/server/roadStore';

export default async function ProgressPage() {
	let roads: RoadSectionDTO[] = [];
	let loadError: string | null = null;

	try {
		roads = await listRoadSections();
	} catch (error) {
		loadError = (error as Error).message;
	}

	return (
		<main className='min-h-screen bg-slate-950 text-slate-50'>
			<div className='relative mx-auto max-w-5xl px-6 py-14 sm:px-8'>
				<div className='absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl' />
				<header className='flex flex-col gap-3'>
					<p className='text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100'>
						Project Progress
					</p>
					<h1 className='text-4xl font-semibold leading-tight text-slate-50'>
						道路进度看板
					</h1>
					<p className='max-w-2xl text-sm text-slate-200/80'>
						路段由管理员统一创建（名称 + 起点 +
						终点），后续分项工程、报检与验收都会挂载在这些路段之下。当前页面先完成路段的增删改维护。
					</p>
					<div className='flex gap-3'>
						<Link
							href='/'
							className='inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10'>
							返回首页
						</Link>
						<Link
							href='/reports'
							className='inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5'>
							去填写日报
						</Link>
					</div>
					{loadError ? (
						<p className='text-sm text-amber-200'>
							加载路段列表失败：{loadError}
							。仍可尝试直接新增，保存后会刷新列表。
						</p>
					) : null}
				</header>

				<div className='mt-10'>
					<RoadBoard initialRoads={roads} />
				</div>
			</div>
		</main>
	);
}
