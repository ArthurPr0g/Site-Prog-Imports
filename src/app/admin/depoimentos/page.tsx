import { listTestimonials } from '@/lib/data/content';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { TestimonialsPanel } from '@/components/admin/TestimonialsPanel';

export default async function AdminTestimonialsPage() {
  const testimonials = await listTestimonials();

  return (
    <div>
      <AdminPageHeader title="Depoimentos" subtitle="Avaliações exibidas na home" />
      <TestimonialsPanel testimonials={testimonials} />
    </div>
  );
}
