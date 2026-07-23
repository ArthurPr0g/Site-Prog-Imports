import { Sparkles, HardDrive, MemoryStick, RefreshCcw, Wrench, Cpu, Fan, Battery, Monitor, ShieldCheck, Settings2, type LucideIcon } from 'lucide-react';

// Icone escolhido automaticamente a partir do nome do servico -- o admin nao
// escolhe manualmente, entao um servico novo ja nasce com um icone coerente.
const RULES: { keywords: string[]; icon: LucideIcon }[] = [
  { keywords: ['limpeza', 'higieniz', 'poeira'], icon: Sparkles },
  { keywords: ['ssd', 'hd ', 'hd,', 'armazenamento', 'disco'], icon: HardDrive },
  { keywords: ['ram', 'memoria'], icon: MemoryStick },
  { keywords: ['formata', 'sistema operacional', 'windows', 'reinstala'], icon: RefreshCcw },
  { keywords: ['processador', 'cpu', 'placa-mae', 'placa mae'], icon: Cpu },
  { keywords: ['cooler', 'ventoinha', 'refrigera', 'temperatura'], icon: Fan },
  { keywords: ['bateria'], icon: Battery },
  { keywords: ['tela', 'monitor', 'display'], icon: Monitor },
  { keywords: ['garantia', 'protecao', 'seguranca', 'antivirus'], icon: ShieldCheck },
  { keywords: ['manuten', 'reparo', 'conserto', 'diagnostico'], icon: Wrench },
];

export function getServiceIcon(name: string): LucideIcon {
  const normalized = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => normalized.includes(k))) return rule.icon;
  }
  return Settings2;
}
