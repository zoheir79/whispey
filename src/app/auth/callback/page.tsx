// src/app/auth/callback/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Inner component that uses useSearchParams
function CallbackComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect');

    if (!token || !redirect) {
      setError('Missing token or redirect URL');
      return;
    }

    // With our JWT system, we can simply set the token in a cookie and redirect
    // The middleware will handle validation on subsequent requests
    document.cookie = `auth-token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict`;
    router.replace(redirect);
    
  }, [searchParams, router]);

  if (error) {
    return <div style={{ padding: '2rem', color: 'red' }}>Authentication Error: {error}</div>;
  }

  return <div style={{ padding: '2rem' }}>Redirecting, please wait...</div>;
}

// Default export with Suspense boundary
export default function CallbackPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading...</div>}>
      <CallbackComponent />
    </Suspense>
  );
}