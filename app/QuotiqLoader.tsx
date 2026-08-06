'use client';

import dynamic from 'next/dynamic';

const QuotiqClient = dynamic(() => import('./QuotiqClient'), {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7fb', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <strong style={{ display: 'block', fontSize: 28 }}>Quotiq</strong>
        <span style={{ color: '#64748b' }}>Opening your workspace…</span>
      </div>
    </main>
  ),
});

export default function QuotiqLoader() {
  return <QuotiqClient />;
}
