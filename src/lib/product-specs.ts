// 24GB e 48GB existem nas configurações de memória unificada da Apple, que não
// seguem a escala de potências de dois dos notebooks com Windows.
export const RAM_OPTIONS = ['4GB', '8GB', '16GB', '24GB', '32GB', '48GB', '64GB'];

export const STORAGE_OPTIONS = ['128GB', '256GB', '512GB', '1TB', '2TB', '4TB'];

export const SCREEN_TYPE_OPTIONS = ['VA', 'IPS', 'OLED', 'Mini-LED', 'TN', 'Retina'];

const INTEL_TIERS = ['i3', 'i5', 'i7', 'i9'];
const INTEL_GENERATIONS = ['10ª', '11ª', '12ª', '13ª', '14ª'];
const INTEL_CORE_ULTRA = [
  'Intel Core Ultra 5 (Série 1)',
  'Intel Core Ultra 7 (Série 1)',
  'Intel Core Ultra 9 (Série 1)',
  'Intel Core Ultra 5 (Série 2)',
  'Intel Core Ultra 7 (Série 2)',
  'Intel Core Ultra 9 (Série 2)',
];

const AMD_TIERS = ['Ryzen 3', 'Ryzen 5', 'Ryzen 7', 'Ryzen 9'];
const AMD_SERIES = ['3000', '4000', '5000', '6000', '7000', '8000', '9000'];

// Sem os chips da Apple na lista, quem cadastrava um MacBook escolhia um Intel
// qualquer — e o processador errado ia parar no nome do produto, na ficha e no
// filtro da vitrine. Os M vêm primeiro porque MacBook e iPad são o que a loja
// mais cadastra da marca; os A servem aos iPad de entrada.
const APPLE_M = ['M1', 'M2', 'M3', 'M4', 'M5'].flatMap((geracao) => [
  `Apple ${geracao}`,
  `Apple ${geracao} Pro`,
  `Apple ${geracao} Max`,
]);
const APPLE_A = ['Apple A14 Bionic', 'Apple A15 Bionic', 'Apple A16 Bionic', 'Apple A17 Pro', 'Apple A18', 'Apple A18 Pro', 'Apple A19', 'Apple A19 Pro'];

// Notebook com Windows sobre ARM: o Galaxy Book Edge do catálogo é Snapdragon.
const SNAPDRAGON = ['Snapdragon X Plus', 'Snapdragon X Elite'];

// Série Z da AMD: chip de handheld, não de notebook. Entrou por causa do
// ROG Xbox Ally X, e é o mesmo caso dos chips da Apple — sem ele na lista,
// quem cadastra escolhe um Ryzen qualquer e o processador errado vai para a
// ficha e para o filtro.
const AMD_HANDHELD = ['AMD Ryzen Z1', 'AMD Ryzen Z1 Extreme', 'AMD Ryzen AI Z2', 'AMD Ryzen AI Z2 Extreme'];

export const CPU_SUGGESTIONS: string[] = [
  ...APPLE_M,
  ...APPLE_A,
  ...INTEL_GENERATIONS.flatMap((gen) => INTEL_TIERS.map((tier) => `Intel Core ${tier} (${gen} Geração)`)),
  ...INTEL_CORE_ULTRA,
  ...AMD_SERIES.flatMap((series) => AMD_TIERS.map((tier) => `AMD ${tier} (Série ${series})`)),
  ...AMD_HANDHELD,
  ...SNAPDRAGON,
];

export const CONDITION_OPTIONS = ['Novo', 'Seminovo', 'Open Box'];

export const COLOR_SUGGESTIONS = [
  'Preto',
  'Branco',
  'Prata',
  // Quase todo notebook gamer cinza do catálogo (Eclipse Gray da ASUS, Steel
  // Gray da Acer) não é "Cinza Espacial", que é nome de acabamento da Apple.
  'Cinza',
  'Grafite',
  'Cinza Espacial',
  'Dourado',
  'Azul',
  'Verde',
  'Roxo',
  'Vermelho',
  'Rosa',
  'Titânio Natural',
  'Titânio Azul',
  'Titânio Branco',
  'Titânio Preto',
  'Preto Espacial',
  'Laranja Cósmico',
  'Azul Profundo',
];

// Specs técnicas mostradas no cadastro do produto variam por categoria — um
// iPhone não tem GPU/RAM configurável do jeito que um notebook tem, por
// exemplo. "Estado" e o restante do cadastro (nome, preço...) continuam
// universais; só esses campos de especificação são filtrados por categoria.
export type SpecFieldKey = 'gpu' | 'cpu' | 'ram' | 'storage' | 'screenType' | 'color';

const CATEGORY_SPEC_FIELDS: Record<string, SpecFieldKey[]> = {
  MacBook: ['cpu', 'ram', 'storage', 'screenType', 'color'],
  iPhone: ['storage', 'color'],
  'iPad / Tablet': ['storage', 'cpu', 'color'],
  'Notebook Gamer': ['gpu', 'cpu', 'ram', 'storage', 'screenType', 'color'],
  'Notebook Trabalho': ['gpu', 'cpu', 'ram', 'storage', 'screenType', 'color'],
  'Notebook Estudos': ['cpu', 'ram', 'storage', 'screenType', 'color'],
  'Notebooks para IA': ['gpu', 'cpu', 'ram', 'storage', 'screenType', 'color'],
  Monitores: ['screenType', 'color'],
  Periféricos: ['color'],
  'Peças e upgrades': ['gpu', 'cpu', 'ram', 'storage'],
};

const DEFAULT_SPEC_FIELDS: SpecFieldKey[] = ['gpu', 'cpu', 'ram', 'storage', 'screenType', 'color'];

export function specFieldsForCategory(category: string): SpecFieldKey[] {
  return CATEGORY_SPEC_FIELDS[category] ?? DEFAULT_SPEC_FIELDS;
}

export function sortByCanonicalOrder(values: string[], canonical: string[]) {
  const known = canonical.filter((c) => values.includes(c));
  const extra = values.filter((v) => !canonical.includes(v)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return [...known, ...extra];
}

export const VARIANT_DIM_LABELS: Record<'gpu' | 'cpu' | 'ram' | 'storage' | 'screenType', string> = {
  ram: 'Memória RAM',
  storage: 'Armazenamento',
  gpu: 'Placa de vídeo',
  cpu: 'Processador',
  screenType: 'Tipo de tela',
};

export const VARIANT_DIM_ORDER: Array<'gpu' | 'cpu' | 'ram' | 'storage' | 'screenType'> = [
  'ram',
  'storage',
  'gpu',
  'cpu',
  'screenType',
];

export const VARIANT_DIM_CANONICAL: Record<'gpu' | 'cpu' | 'ram' | 'storage' | 'screenType', string[]> = {
  ram: RAM_OPTIONS,
  storage: STORAGE_OPTIONS,
  gpu: [],
  cpu: CPU_SUGGESTIONS,
  screenType: SCREEN_TYPE_OPTIONS,
};

// Nome final de uma variação = nome base do produto de origem + as specs
// relevantes pra categoria dele (mesma lista usada pra mostrar/ocultar
// campos no cadastro), então um iPhone complementa com Armazenamento/Cor e
// um notebook com GPU/CPU/RAM/Armazenamento/Tela/Cor.
export function composeVariantName(
  baseName: string,
  category: string,
  specs: { gpu: string; cpu: string; ram: string; storage: string; screenType: string; color: string }
) {
  const fields = specFieldsForCategory(category);
  const parts = fields.map((f) => specs[f]).filter(Boolean);
  return parts.length ? `${baseName} — ${parts.join(' · ')}` : baseName;
}
