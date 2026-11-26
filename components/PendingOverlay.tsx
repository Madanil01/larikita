'use client';
import { createPortal } from 'react-dom';
import { useFormStatus } from 'react-dom';
import LoadingOverlay from './LoadingOverlay';

/**
 * Taruh DI DALAM <form action={serverAction}>: tampilkan overlay selama form diproses.
 * Dirender ke <body> lewat portal supaya tidak ikut opacity/stacking context kartu induknya.
 */
export default function PendingOverlay({ label = 'Menyimpan…' }: { label?: string }) {
  const { pending } = useFormStatus();
  if (!pending || typeof document === 'undefined') return null;
  return createPortal(<LoadingOverlay label={label} />, document.body);
}
