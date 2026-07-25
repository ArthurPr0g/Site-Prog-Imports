export const RAM_OPTIONS = ['4GB', '8GB', '16GB', '32GB', '64GB'];

export const STORAGE_OPTIONS = ['256GB', '512GB', '1TB', '2TB', '4TB'];

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

export const CPU_SUGGESTIONS: string[] = [
  ...INTEL_GENERATIONS.flatMap((gen) => INTEL_TIERS.map((tier) => `Intel Core ${tier} (${gen} Geração)`)),
  ...INTEL_CORE_ULTRA,
  ...AMD_SERIES.flatMap((series) => AMD_TIERS.map((tier) => `AMD ${tier} (Série ${series})`)),
];

export const CONDITION_OPTIONS = ['Novo', 'Seminovo', 'Open Box'];

export const COLOR_SUGGESTIONS = [
  'Preto',
  'Branco',
  'Prata',
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
