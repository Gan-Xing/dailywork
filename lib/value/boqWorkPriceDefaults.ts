import type { BoqWorkPlanItemDto, BoqWorkPrice, BoqWorkScope } from './boqWorkPlans'

type PriceSource = Pick<BoqWorkPlanItemDto, 'sourceKind' | 'sourceUnitPrice' | 'lineKey' | 'code' | 'unit'>
const decimal = (value: string) => {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  if (whole.replace(/^0+/, '').length > 20 || fraction.length > 18) return null
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.replace(/0+$/, '')}`
}

/** Only the selected exact signed line is a source of an inherited original rate. */
export function signedWorkPrice(item: PriceSource, revisionId: number): BoqWorkPrice | null {
  if (item.sourceKind !== 'SIGNED_LINE' || item.sourceUnitPrice === null || decimal(item.sourceUnitPrice) === null) return null
  return {
    unitPrice: item.sourceUnitPrice, confirmed: true, basis: 'ORIGINAL',
    evidence: `沿用签字账单版本 #${revisionId}，价号 ${item.code ?? '未编价号'}（${item.lineKey}）的原合同单价 HT ${item.sourceUnitPrice} FCFA${item.unit ? `/${item.unit}` : ''}。`,
  }
}

export function isSignedWorkPrice(item: PriceSource, price: BoqWorkPrice | null): boolean {
  return item.sourceKind === 'SIGNED_LINE' && item.sourceUnitPrice !== null && price?.unitPrice !== null && price?.unitPrice !== undefined
    && price.confirmed && price.basis === 'ORIGINAL' && decimal(item.sourceUnitPrice) !== null
    && decimal(price.unitPrice) === decimal(item.sourceUnitPrice)
}

/** Called only while preparing an edit/save; never creates or revises a plan on GET. */
export function defaultBoqWorkPlanPrice(item: PriceSource, revisionId: number, scopes: BoqWorkScope[], candidate: BoqWorkPrice | null): BoqWorkPrice | null {
  if (scopes.length && !scopes.some((scope) => scope.scopeBasis === 'ORIGINAL')) return candidate
  const inherited = signedWorkPrice(item, revisionId)
  if (!inherited) return candidate
  if (!candidate) return inherited
  if (candidate.confirmed || !['ORIGINAL', 'UNKNOWN'].includes(candidate.basis)) return candidate
  if (candidate.unitPrice === null || decimal(candidate.unitPrice) === decimal(inherited.unitPrice!)) return inherited
  return candidate
}

/** An original plan rate must not silently value a changed/contested scope. */
export function workScopePrice(scope: Pick<BoqWorkScope, 'scopeBasis' | 'price'>, planPrice: BoqWorkPrice | null): BoqWorkPrice | null {
  if (scope.price) return scope.price
  if (scope.scopeBasis !== 'ORIGINAL' && planPrice?.basis === 'ORIGINAL') return null
  return planPrice
}
