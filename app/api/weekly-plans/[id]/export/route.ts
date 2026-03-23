import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/server/authSession';
import { prisma } from '@/lib/prisma';
import { formatSupervisorLabel } from '@/lib/members/utils';
import {
  combinePlateNumbers,
  formatMaterialModel,
  formatPlanDateRange,
} from '@/app/resources/weekly-plans/materialsConfig';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }

  const { id } = await params;
  const planId = Number(id);

  const plan = await prisma.weeklyDeliveryPlan.findUnique({
    where: { id: planId },
    include: {
      project: { select: { name: true } },
      projects: {
        include: { project: { select: { name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { projectId: 'asc' }],
      },
      approverUser: {
        select: {
          name: true,
          username: true,
          chineseProfile: { select: { frenchName: true } },
        },
      },
      editorUser: {
        select: {
          name: true,
          username: true,
          chineseProfile: { select: { frenchName: true } },
        },
      },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!plan) return NextResponse.json({ message: '计划不存在' }, { status: 404 });

  const exportItems = plan.items.filter((item) => item.status !== 'cancelled');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dailywork';
  const sheet = workbook.addWorksheet('周计划');

  const colCount = 10;

  // ——— Title rows ———
  const mergeAndStyle = (row: number, value: string, fontSize: number, bold = true) => {
    sheet.mergeCells(row, 1, row, colCount);
    const cell = sheet.getCell(row, 1);
    cell.value = value;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.font = { bold, size: fontSize };
    sheet.getRow(row).height = fontSize + 10;
  };

  mergeAndStyle(1, 'Projet de Construction de Route Bondoukou', 13);
  mergeAndStyle(2, `DETAIL DU PLANNING DE LIVRAISON HEBDOMADAIRE ${plan.title}`, 12);
  const projectNames = (plan.projects.length ? plan.projects : [{ project: plan.project }]).map((entry) => entry.project.name)
  mergeAndStyle(3, `${projectNames.join(' / ')}大宗物资周计划明细表（${formatPlanDateRange(plan.weekStartDate, plan.weekEndDate) || plan.title}）`, 12);

  // ——— Header row ———
  const baseHeaders = [
    'Nombre', 'Nom/Le temps', 'Fournisseur', 'Nom', 'Modèle',
    'Unité', 'Quantité', 'Transporteur', 'Contact', 'Téléphone',
  ];
  const headers = [...baseHeaders];

  const headerRow = sheet.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  headerRow.height = 30;

  // ——— Data rows ———
  exportItems.forEach((item: {
    deliveryDate: string | null
    supplier: string | null
    goodsName: string | null
    model: unknown
    status: string | null
    unit: string | null
    plannedQty: unknown
    transporter: string | null
    headPlateNumber: string | null
    tailPlateNumber: string | null
    phone: string | null
  }, idx: number) => {
    const formattedModel = formatMaterialModel(item.goodsName, item.model);

    const rowData: (string | number | null)[] = [
      idx + 1,
      item.deliveryDate ?? '',
      item.supplier ?? '',
      item.goodsName ?? '',
      formattedModel ?? '',
      item.unit ?? '',
      item.plannedQty != null ? Number(item.plannedQty) : '',
      item.transporter ?? '',
      combinePlateNumbers(item.headPlateNumber, item.tailPlateNumber),
      item.phone ?? '',
    ];

    const row = sheet.addRow(rowData);
    row.height = 18;
    row.eachCell((cell: { alignment: unknown; border: unknown }) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
  });

  const approverLabel =
    plan.approverName ??
    formatSupervisorLabel({
      name: plan.approverUser?.name ?? null,
      frenchName: plan.approverUser?.chineseProfile?.frenchName ?? null,
      username: plan.approverUser?.username ?? null,
    }) ??
    '';
  const editorLabel =
    plan.editorName ??
    formatSupervisorLabel({
      name: plan.editorUser?.name ?? null,
      frenchName: plan.editorUser?.chineseProfile?.frenchName ?? null,
      username: plan.editorUser?.username ?? null,
    }) ??
    '';

  // ——— Signature row ———
  const sigRowNum = 4 + exportItems.length + 1;
  const half = Math.floor(colCount / 2);
  sheet.mergeCells(sigRowNum, 1, sigRowNum, half);
  sheet.getCell(sigRowNum, 1).value = `审批人: ${approverLabel}`;
  sheet.getCell(sigRowNum, 1).alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.mergeCells(sigRowNum, half + 1, sigRowNum, colCount);
  sheet.getCell(sigRowNum, half + 1).value = `编制人: ${editorLabel}`;
  sheet.getCell(sigRowNum, half + 1).alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.getRow(sigRowNum).height = 24;

  // ——— Column widths ———
  const widths = [8, 16, 14, 14, 18, 8, 10, 14, 16, 14];
  headers.forEach((_, i) => {
    sheet.getColumn(i + 1).width = widths[i] ?? 12;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `weekly-plan-${plan.title}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
