import ExcelJS from 'exceljs';
import { requireAdmin } from '@/lib/auth';
import { listCatalogData } from '@/lib/data/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return new Response('Não autorizado', { status: 403 });

  const catalog = await listCatalogData();
  const categoryNames = catalog.categories.map((c) => c.name);
  const collectionNames = catalog.collections.map((c) => c.name);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Prog Imports';
  workbook.created = new Date();

  const ref = workbook.addWorksheet('Listas', { state: 'hidden' });
  ref.getColumn(1).values = ['Categorias', ...categoryNames];
  ref.getColumn(2).values = ['Coleções', ...collectionNames];

  const sheet = workbook.addWorksheet('Produtos');
  const headers = ['Nome', 'Marca', 'Categoria', 'Coleção', 'Estoque', 'Preço (R$)', 'Preço promocional (opcional)', 'Descrição'];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2E4CC' } };

  sheet.addRow([
    'MacBook Air 13" M3 8GB/256GB',
    'Apple',
    categoryNames[0] ?? 'MacBooks',
    '',
    12,
    9499.0,
    8999.0,
    'Notebook ultrafino com chip M3, tela Liquid Retina de 13 polegadas e até 18h de bateria.',
  ]);
  sheet.addRow([
    'iPhone 15 Pro 256GB',
    'Apple',
    categoryNames[1] ?? categoryNames[0] ?? 'iPhones',
    '',
    8,
    8999.0,
    '',
    'Câmera profissional em titânio, chip A17 Pro e conector USB-C.',
  ]);

  sheet.columns = [
    { width: 34 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 10 },
    { width: 14 },
    { width: 20 },
    { width: 48 },
  ];

  const categoryRange = categoryNames.length > 0 ? `Listas!$A$2:$A$${categoryNames.length + 1}` : undefined;
  const collectionRange = collectionNames.length > 0 ? `Listas!$B$2:$B$${collectionNames.length + 1}` : undefined;

  for (let row = 2; row <= 200; row++) {
    if (categoryRange) {
      sheet.getCell(`C${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [categoryRange],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Categoria inválida',
        error: 'Escolha uma categoria da lista.',
      };
    }
    if (collectionRange) {
      sheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [collectionRange],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Coleção inválida',
        error: 'Escolha uma coleção da lista ou deixe em branco.',
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modelo-produtos-prog-imports.xlsx"',
    },
  });
}
