import React from 'react';
import { ArrowLeft, GraduationCap, Search } from 'lucide-react';

export const NotFoundView: React.FC = () => {
  return (
    <main className="w-full px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="not-found-heading">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-stone-200/80 bg-white/90 p-6 shadow-md sm:p-10">
        <div className="mx-auto flex w-fit items-center gap-2 text-sm font-semibold text-stone-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#114B43] text-white">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          LearnX
        </div>

        <div className="mt-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-500" aria-hidden="true">
            <Search className="h-7 w-7" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#114B43]">404 · Detour</p>
          <h1 id="not-found-heading" className="mt-2 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            Page not found
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-stone-600">
            This path is outside the current LearnX learning map. Return to the public curriculum or use the links below to keep exploring.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#114B43] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0f453c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43] focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Return to homepage</span>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
};
