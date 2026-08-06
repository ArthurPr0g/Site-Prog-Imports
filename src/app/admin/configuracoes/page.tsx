import { listCatalogData } from '@/lib/data/admin';
import { getSiteSettings, getSignaturePreviewUrl } from '@/lib/data/content';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CatalogGroup } from '@/components/admin/CatalogGroup';
import { CoverImageCatalogGroup } from '@/components/admin/CoverImageCatalogGroup';
import { SystemSettings } from '@/components/admin/SystemSettings';

export default async function AdminConfiguracoesPage() {
  const [{ categories, brands }, settings] = await Promise.all([listCatalogData(), getSiteSettings()]);
  const assinaturaUrl = await getSignaturePreviewUrl(settings.signaturePath);

  return (
    <div>
      <AdminPageHeader
        title="Configurações"
        subtitle="Parâmetros do sistema e organização do catálogo"
      />
      <div className="flex flex-col gap-3.5">
        <SystemSettings
          usdRate={settings.usdRate}
          usdRateSpread={settings.usdRateSpread}
          defaultDeliveryTime={settings.defaultDeliveryTime}
          contractorName={settings.contractorName}
          contractorDoc={settings.contractorDoc}
          contractorRole={settings.contractorRole}
          contractForum={settings.contractForum}
          assinaturaUrl={assinaturaUrl}
          remetente={{
            senderName: settings.senderName,
            senderDoc: settings.senderDoc,
            senderPhone: settings.senderPhone,
            senderCep: settings.senderCep,
            senderAddressLine: settings.senderAddressLine,
            senderAddressNumber: settings.senderAddressNumber,
            senderComplement: settings.senderComplement,
            senderDistrict: settings.senderDistrict,
            senderCity: settings.senderCity,
            senderState: settings.senderState,
          }}
        />
        <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2">
          <CoverImageCatalogGroup title="Categorias" items={categories} placeholder="Nova categoria…" />
          <CatalogGroup title="Marcas" table="brands" items={brands} placeholder="Nova marca…" />
        </div>
      </div>
    </div>
  );
}
