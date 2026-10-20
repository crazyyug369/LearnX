import React from 'react';
import { PUBLIC_DESCRIPTION, PUBLIC_TITLE } from './content';

export function PublicIntro({ hasLessonHeading = false }: { hasLessonHeading?: boolean }) {
  // The existing lesson view supplies its own H1 after navigation. It is an
  // application state at /, not a new indexable public document.
  const Heading = hasLessonHeading ? 'h2' : 'h1';

  return (
    <section aria-labelledby="public-page-heading" className="mb-6 max-w-3xl">
      <Heading id="public-page-heading" className="font-serif text-2xl sm:text-3xl font-semibold text-stone-900">
        {PUBLIC_TITLE}
      </Heading>
      <p className="mt-3 text-sm leading-6 text-stone-600">{PUBLIC_DESCRIPTION}</p>
      <nav aria-label="On this page" className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-[#114B43]">
        <a href="#learning-app" className="hover:underline">Interactive learning app</a>
        <a href="#curriculum" className="hover:underline">Curriculum overview</a>
        <a href="#faq" className="hover:underline">Frequently asked questions</a>
      </nav>
    </section>
  );
}
