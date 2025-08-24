import { Suspense } from 'react';
import AuthPage from "@/components/AuthPage";

export default function SignInPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <AuthPage />
        </Suspense>
    );
}

