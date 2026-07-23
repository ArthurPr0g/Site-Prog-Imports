'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

const BOX_SLOTS: { x: number; y: number }[] = [
  { x: 14.5, y: 10.5 },
  { x: 18.5, y: 10.5 },
  { x: 22.5, y: 10.5 },
  { x: 16.5, y: 14.5 },
  { x: 20.5, y: 14.5 },
];
const BOX_SIZE = 3.4;

export function CartIcon({ count, className }: { count: number; className?: string }) {
  const [bump, setBump] = useState(false);
  const prevCountRef = useRef(count);

  useEffect(() => {
    if (count > prevCountRef.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 500);
      prevCountRef.current = count;
      return () => clearTimeout(t);
    }
    prevCountRef.current = count;
  }, [count]);

  const filled = Math.min(count, BOX_SLOTS.length);

  return (
    <svg
      viewBox="0 0 36 30"
      className={clsx('overflow-visible', bump && 'animate-cart-bump', className)}
      style={{ transformOrigin: '5px 22px' }}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {BOX_SLOTS.map((slot, i) => (
        <rect
          key={i}
          x={slot.x}
          y={slot.y}
          width={BOX_SIZE}
          height={BOX_SIZE}
          rx={0.8}
          fill="#F28705"
          stroke="none"
          className={i < filled ? 'animate-cart-box-pop' : ''}
          style={{ transformOrigin: `${slot.x + BOX_SIZE / 2}px ${slot.y + BOX_SIZE / 2}px`, opacity: i < filled ? 1 : 0 }}
        />
      ))}
      <path d="M3,3 L7,3 L9.5,8.5 L31,8.5 L27,19.5 L13,19.5 L9.5,12" />
      <circle cx="15" cy="25" r="2.2" />
      <circle cx="25" cy="25" r="2.2" />
    </svg>
  );
}
