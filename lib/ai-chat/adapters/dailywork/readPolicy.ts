import type { ApiCatalogEntry } from './apiCatalog'

// AI access is opt-in. A generated GET/read label does not prove that a route
// has no write side effects or that its response is suitable for a model.
// Review the route, its called helpers, permission checks, and response fields
// before adding a new key here.
const approvedReadKeys = new Set([
  'get:/api/documents/received-ledger',
  'get:/api/documents/submissions',
  'get:/api/documents/submissions/:id',
  'get:/api/documents/templates',
  'get:/api/documents/templates/:id',
  'get:/api/finance/entries',
  'get:/api/finance/insights',
  'get:/api/finance/ledger/cases',
  'get:/api/finance/ledger/cases/:id',
  'get:/api/finance/ledger/insights',
  'get:/api/inspection-entries',
  'get:/api/inspection-entries/:id',
  'get:/api/inspection-entries/user-options',
  'get:/api/inspections',
  'get:/api/inspections/check-options',
  'get:/api/leader-logs',
  'get:/api/leader-logs/leaders',
  'get:/api/leader-logs/options',
  'get:/api/progress/:slug/phases',
  'get:/api/progress/quantities',
  'get:/api/progress/quantities/bound-items',
  'get:/api/progress/quantities/detail',
  'get:/api/progress/summary',
  'get:/api/projects',
  'get:/api/reports',
  'get:/api/reports/:date',
  'get:/api/reports/weekly-rollups',
  'get:/api/reports/weekly-rollups/:period',
  'get:/api/resources/fuel-sources/daily',
  'get:/api/resources/machines',
  'get:/api/resources/machines/logs',
  'get:/api/resources/machines/logs/group',
  'get:/api/resources/machines/logs/summary',
  'get:/api/roads',
  'get:/api/roads/:id/cross-sections',
  'get:/api/submissions',
  'get:/api/team-supervisors',
  'get:/api/value/boq-completion',
  'get:/api/value/boq-completion/:boqItemId',
  'get:/api/value/boq-items',
  'get:/api/value/boq-items/search',
  'get:/api/value/boq-letters',
  'get:/api/value/boq-measurements',
  'get:/api/value/boq-projects',
  'get:/api/value/measurement-details',
  'get:/api/value/phase-item-bindings',
  'get:/api/value/phase-items/:id',
  'get:/api/value/prices',
  'get:/api/value/variation-measurements',
  'get:/api/value/variation-raw-records',
  'get:/api/weekly-plans',
  'get:/api/weekly-plans/:id',
  'get:/api/weekly-plans/recent-price',
])

// The generated catalog cannot infer permission checks hidden in helper
// functions. Keep these AI-side checks aligned with the route handlers.
const permissionOverrides: Record<string, string[]> = {
  'get:/api/documents/received-ledger': ['file:view', 'file:manage'],
  'get:/api/leader-logs': ['report:view', 'report:edit'],
  'get:/api/leader-logs/leaders': ['report:view', 'report:edit'],
  'get:/api/progress/quantities': ['progress:view'],
  'get:/api/progress/quantities/detail': ['progress:view'],
  'get:/api/projects': ['member:view', 'member:update', 'member:edit', 'member:create', 'member:manage'],
  'get:/api/roads/:id/cross-sections': ['progress:view', 'road:manage', 'value:view'],
  'get:/api/team-supervisors': ['member:view', 'member:update', 'member:edit', 'member:create', 'member:manage'],
}

export const getAiChatRequiredPermissions = (entry: ApiCatalogEntry) =>
  permissionOverrides[entry.key] ?? entry.permissions

export const isAiChatReadableEntry = (entry: ApiCatalogEntry) =>
  entry.method === 'GET' &&
  entry.mode === 'read' &&
  approvedReadKeys.has(entry.key) &&
  getAiChatRequiredPermissions(entry).length > 0

export const getApprovedAiChatReadKeys = () => Array.from(approvedReadKeys)
