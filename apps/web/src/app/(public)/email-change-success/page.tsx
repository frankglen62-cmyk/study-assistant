'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Mail } from 'lucide-react';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const newEmail = searchParams.get('email');

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-8 shadow-2xl shadow-black/30">
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>

            <h1 className="text-2xl font-bold text-white">Email Changed Successfully</h1>
            <p className="mt-2 text-sm text-neutral-400">
              Your sign-in email has been updated.
            </p>
          </div>

          {newEmail ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
                  <Mail className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">New sign-in email</p>
                  <p className="mt-1 text-sm text-neutral-400">{newEmail}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    Use this email address to sign in from now on.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition-all hover:bg-neutral-200"
            >
              Sign in with new email
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-600">
          Study Assistant · Admin-managed private retrieval
        </p>
      </div>
    </div>
  );
}

export default function EmailChangeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
          <p className="text-neutral-400">Loading...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
