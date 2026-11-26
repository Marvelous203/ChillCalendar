import { connection } from 'next/server';
import { Suspense } from 'react';
import { RoomPageClient } from '@/components/RoomPageClient';
import { RoomSkeleton } from '@/components/Skeletons';

async function DynamicMarker() {
  await connection();
  return null;
}

export default function RoomPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <DynamicMarker />
      <RoomPageClient />
    </Suspense>
  );
}
