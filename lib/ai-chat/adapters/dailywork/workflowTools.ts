import type { ChatTool } from '../../types'
import { loadAiChatActor } from '@/lib/server/aiChatAccess'
import { getWeeklyPlanSnapshot, prepareWeeklyPlanJob, publicAiJob } from '@/lib/server/aiChatWorkflowStore'
import { AiBusinessError, positiveId } from '../../weeklyPlanChanges'

export const buildWorkflowTools = (): ChatTool[] => [
  {
    name: 'get_weekly_plan_snapshot',
    description: 'Read all rows and the exact version of one weekly plan by ID. Use the normal weekly-plan list API to find an ID first; never guess the latest plan.',
    schema: { type: 'object', properties: { planId: { type: 'number' } }, required: ['planId'] },
    requiredPermissions: ['material:view'],
    formatResult: (result) => `TOOL_RESULT get_weekly_plan_snapshot: ${JSON.stringify(result)}`,
    handler: async (args, context) => {
      try {
        if (!context.session) throw new AiBusinessError('Login required.', 401)
        const actor = await loadAiChatActor(context.session.id)
        const snapshot = await getWeeklyPlanSnapshot(actor, positiveId(args.planId))
        return { ok: true, content: JSON.stringify(snapshot), data: snapshot }
      } catch (error) {
        return { ok: false, content: error instanceof Error ? error.message : 'Read failed.' }
      }
    },
  },
  ...(['WEEKLY_PLAN_CHANGE', 'WEEKLY_PDF'] as const).map((kind): ChatTool => ({
    name: kind === 'WEEKLY_PLAN_CHANGE' ? 'prepare_weekly_plan_changes' : 'request_weekly_plan_pdf',
    description: kind === 'WEEKLY_PLAN_CHANGE'
      ? 'Prepare, NEVER commit, a preview for an exact planId. operations is an array of {type:"append"|"update",itemId?:number,changes:{deliveryDate,supplier,goodsName,model:{dimensions:[{label,value,unit?}]},unit,plannedQty,transporter,headPlateNumber,tailPlateNumber,phone,note,status?}}. New rows require name, unit, quantity, exact date. No prices or actual receipts. Appends go last. Human confirms using the separate control; do not call another tool to confirm.'
      : 'Prepare an exact weekly plan PDF for human confirmation. signed is true only when explicitly requested. Website AI returns a private download link, never sends to Telegram or another channel. Queued never means generated.',
    schema: {
      type: 'object',
      properties: {
        planId: { type: 'number' },
        ...(kind === 'WEEKLY_PLAN_CHANGE' ? { operations: { type: 'array', description: 'Append/update operations, each with changes.' } } : { signed: { type: 'boolean' } }),
      },
      required: kind === 'WEEKLY_PLAN_CHANGE' ? ['planId', 'operations'] : ['planId'],
    },
    requiredPermissions: kind === 'WEEKLY_PLAN_CHANGE' ? ['material:view', 'material:create'] : ['material:view'],
    permissionMode: 'all',
    effect: 'proposal',
    handler: async (args, context) => {
      try {
        if (!context.session || !context.workflow?.requestId) throw new AiBusinessError('Saved chat context required.')
        const actor = await loadAiChatActor(context.session.id)
        const job = await prepareWeeklyPlanJob(actor, { ...args, kind }, context.workflow)
        return { ok: true, content: '仅创建预览，尚未执行。请用户核对并点击确认。', data: { job: publicAiJob(job, actor) }, jobId: job.id }
      } catch (error) {
        return { ok: false, content: error instanceof Error ? error.message : 'Preview failed.' }
      }
    },
  })),
]
