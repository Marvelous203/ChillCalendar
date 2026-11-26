import { connection } from 'next/server';
import { Suspense } from 'react';
import { RoomPageClient } from '@/components/RoomPageClient';

async function DynamicMarker() {
  await connection();
  return null;
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-card p-8 text-center text-sm text-[var(--muted)]">
          Đang tải phòng...
        </div>
      }
    >
      <DynamicMarker />
      <RoomPageClient />
    </Suspense>
  );
}
