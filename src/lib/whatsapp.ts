import { WHATSAPP_NUMBER } from './constants';

export function buildWhatsAppLink(message: string, number: string = WHATSAPP_NUMBER): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
