export const VALUE_BILL_STRUCTURE_PHASE_NAMES = ['边沟', '现浇边沟', '过道涵']

export const isValueBillStructurePhase = (phaseName: string) =>
  VALUE_BILL_STRUCTURE_PHASE_NAMES.includes(phaseName)

export const getValueBillStructureComponent = (phaseName: string) =>
  phaseName === '现浇边沟' ? '边沟' : phaseName
