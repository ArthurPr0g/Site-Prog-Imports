import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

// Placeholder das páginas do ERP criadas no M0 (navegação) e ainda não
// implementadas. Existe para a estrutura do menu ficar navegável desde já,
// deixando explícito o que a página vai fazer e em qual módulo ela entra —
// uma página em branco deixaria dúvida entre "não implementado" e "quebrado".
export function ModuloPendente({
  titulo,
  subtitulo,
  modulo,
  entrega,
  depende,
}: {
  titulo: string;
  subtitulo: string;
  modulo: string;
  entrega: string[];
  depende?: string;
}) {
  return (
    <div>
      <AdminPageHeader title={titulo} subtitle={subtitulo} />
      <div className="max-w-[640px] rounded-[18px] border border-border bg-card p-7">
        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">{modulo}</div>
        <div className="mb-4 text-sm font-extrabold">Ainda não implementado</div>
        <div className="mb-2 text-[13px] font-bold text-fg-secondary">O que esta página vai ter:</div>
        <ul className="mb-4 space-y-1.5">
          {entrega.map((item) => (
            <li key={item} className="flex gap-2 text-[13px] text-fg-tertiary">
              <span className="text-accent">•</span>
              {item}
            </li>
          ))}
        </ul>
        {depende && (
          <div className="border-t border-divider pt-3.5 text-[12.5px] text-fg-faded">
            Depende de: <span className="font-bold text-fg-tertiary">{depende}</span>
          </div>
        )}
      </div>
    </div>
  );
}
