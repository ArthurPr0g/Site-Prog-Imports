'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { FRETE_GRATIS_MIN, FRETE_PADRAO, WHATSAPP_NUMBER } from '@/lib/constants';
import { formatBRL } from '@/lib/format';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { validateCouponAction } from '@/app/actions/coupon';
import { useToast } from '@/components/ui/Toast';

export type CartLine = {
  id: string;
  sku: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
  imageUrl?: string | null;
};

type CartState = Record<string, CartLine>;

type CartContextValue = {
  items: CartLine[];
  count: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (
    item: { id: string; sku: string; name: string; price: number; image?: string; imageUrl?: string | null },
    openDrawer?: boolean,
    qty?: number
  ) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  coupon: string;
  setCoupon: (v: string) => void;
  couponApplied: boolean;
  couponPct: number;
  couponMessage: string;
  applyCoupon: () => Promise<void>;
  cep: string;
  setCep: (v: string) => void;
  frete: number | null;
  calcFrete: () => void;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  whatsappCheckoutLink: string;
  favorites: Record<string, boolean>;
  toggleFavorite: (id: string) => void;
  favCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'progimports:cart:v1';
const FAV_STORAGE_KEY = 'progimports:favs:v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartState>({});
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponPct, setCouponPct] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [cep, setCep] = useState('');
  const [frete, setFrete] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const toast = useToast();

  // Reads localStorage once after mount — must run in an effect since it's
  // unavailable during SSR and reading it during render would cause a
  // hydration mismatch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
      const rawFav = localStorage.getItem(FAV_STORAGE_KEY);
      if (rawFav) setFavorites(JSON.parse(rawFav));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  const add = useCallback(
    (
      item: { id: string; sku: string; name: string; price: number; image?: string; imageUrl?: string | null },
      openDrawer = false,
      qty = 1
    ) => {
      setItems((prev) => {
        const existing = prev[item.id];
        return {
          ...prev,
          [item.id]: { ...item, qty: (existing?.qty ?? 0) + qty },
        };
      });
      toast(`${item.name} adicionado ao carrinho`);
      if (openDrawer) setIsOpen(true);
    },
    [toast]
  );

  const inc = useCallback((id: string) => {
    setItems((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], qty: prev[id].qty + 1 } } : prev));
  }, []);

  const dec = useCallback((id: string) => {
    setItems((prev) => {
      if (!prev[id]) return prev;
      const qty = Math.max(0, prev[id].qty - 1);
      if (qty === 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...prev[id], qty } };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems({}), []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const applyCoupon = useCallback(async () => {
    const result = await validateCouponAction(coupon);
    setCouponApplied(result.valid);
    setCouponPct(result.pct);
    setCouponMessage(
      result.valid ? `Cupom ${coupon.trim().toUpperCase()} aplicado: ${result.pct}% de desconto!` : 'Cupom inválido.'
    );
  }, [coupon]);

  const calcFrete = useCallback(() => {
    if (cep.replace(/\D/g, '').length < 8) {
      toast('Digite um CEP válido');
      return;
    }
    setFrete(FRETE_PADRAO);
  }, [cep, toast]);

  const itemList = useMemo(() => Object.values(items).filter((i) => i.qty > 0), [items]);
  const count = useMemo(() => itemList.reduce((a, i) => a + i.qty, 0), [itemList]);
  const subtotal = useMemo(() => itemList.reduce((a, i) => a + i.price * i.qty, 0), [itemList]);
  const discount = couponApplied ? subtotal * (couponPct / 100) : 0;
  const shipping = frete === null ? 0 : subtotal - discount >= FRETE_GRATIS_MIN ? 0 : frete;
  const total = subtotal - discount + shipping;
  const favCount = useMemo(() => Object.values(favorites).filter(Boolean).length, [favorites]);

  const whatsappCheckoutLink = useMemo(() => {
    if (itemList.length === 0) return buildWhatsAppLink('Olá! Quero saber mais sobre os produtos da Prog Imports.');
    const lines = itemList.map((i) => `• ${i.qty}x ${i.name} — ${formatBRL(i.price * i.qty)}`).join('\n');
    const msg = `Olá! Quero finalizar minha compra na Prog Imports:\n${lines}\nTotal: ${formatBRL(total)}`;
    return buildWhatsAppLink(msg, WHATSAPP_NUMBER);
  }, [itemList, total]);

  const value: CartContextValue = {
    items: itemList,
    count,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    add,
    inc,
    dec,
    remove,
    clear,
    coupon,
    setCoupon,
    couponApplied,
    couponPct,
    couponMessage,
    applyCoupon,
    cep,
    setCep,
    frete,
    calcFrete,
    subtotal,
    discount,
    shipping,
    total,
    whatsappCheckoutLink,
    favorites,
    toggleFavorite,
    favCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
