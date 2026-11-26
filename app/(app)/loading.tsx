import LoadingOverlay from '@/components/LoadingOverlay';

// Ditampilkan Next.js otomatis saat pindah halaman (Ringkasan, Jadwal, Rencana, Pengaturan) selama data dimuat
export default function Loading() {
  return <LoadingOverlay />;
}
