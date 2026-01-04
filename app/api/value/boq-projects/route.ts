import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listBoqProjects } from '@/lib/server/boqStore'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function GET() {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  try {
    const projects = await listBoqProjects()
    return NextResponse.json({ projects })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载项目列表', 500)
  }
}
