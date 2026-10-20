import React, { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Mail, Phone, Search } from 'lucide-react';
import {
  appendPublicUtmParameters,
  PUBLIC_CURRICULUM,
  PUBLIC_FAQ_ITEMS,
  type PublicAuthor,
  type PublicContact,
  type PublicSiteConfig,
  type PublicUtmParams,
} from '../public-site/content';

export { PUBLIC_FAQ_ITEMS } from '../public-site/content';

interface PublicSeoContentProps {
  author?: PublicAuthor;
  config?: PublicSiteConfig;
  utmParams?: PublicUtmParams;
}

export function PublicContactLinks({
  contact,
  utmParams = {},
}: {
  contact?: PublicContact;
  utmParams?: PublicUtmParams;
}) {
  if (!contact?.email && !contact?.phone && !contact?.creatorUrl) return null;

  const creatorHref = contact.creatorUrl
    ? appendPublicUtmParameters(contact.creatorUrl, utmParams)
    : undefined;
  const phoneHref = contact.phone?.replace(/(?!^\+)\D/g, '');

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium">
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          className="inline-flex items-center gap-1.5 text-stone-600 transition hover:text-[#114B43] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43]"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="break-all">{contact.email}</span>
        </a>
      )}
      {contact.phone && (
        <a
          href={`tel:${phoneHref}`}
          className="inline-flex items-center gap-1.5 text-stone-600 transition hover:text-[#114B43] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43]"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="break-all">{contact.phone}</span>
        </a>
      )}
      {creatorHref && (
        <a
          href={creatorHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-stone-600 transition hover:text-[#114B43] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43]"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="break-all">{contact.creatorLabel || 'Creator site'}</span>
        </a>
      )}
    </div>
  );
}

export function PublicSeoContent({ author, config = {}, utmParams = {} }: PublicSeoContentProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCurriculum = useMemo(() => {
    if (!normalizedQuery) return PUBLIC_CURRICULUM;
    return PUBLIC_CURRICULUM
      .map(({ subject, concepts }) => ({
        subject,
        concepts: concepts.filter((concept) => {
          const searchable = [
            subject,
            concept.title,
            concept.description,
            ...concept.prerequisites,
          ].join(' ').toLowerCase();
          return searchable.includes(normalizedQuery);
        }),
      }))
      .filter(({ concepts }) => concepts.length > 0);
  }, [normalizedQuery]);

  const filteredFaq = useMemo(() => {
    if (!normalizedQuery) return PUBLIC_FAQ_ITEMS;
    return PUBLIC_FAQ_ITEMS.filter(({ question, answer }) =>
      `${question} ${answer}`.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  const resultCount = filteredCurriculum.reduce((count, item) => count + item.concepts.length, 0) + filteredFaq.length;

  return (
    <div className="mt-10 space-y-8 border-t border-stone-200/80 pt-8">
      <section id="public-search" aria-labelledby="public-search-heading" className="max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="public-search-heading" className="text-2xl font-serif font-semibold text-stone-900">
              Search LearnX
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Search public curriculum topics and frequently asked questions.
            </p>
          </div>
          {config.lastUpdated && (
            <p className="text-xs font-medium text-stone-500">Last updated: {config.lastUpdated}</p>
          )}
        </div>
        <label htmlFor="public-site-search" className="sr-only">Search curriculum and FAQs</label>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <input
            id="public-site-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “fractions”, “account”, or “prerequisite”"
            className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-10 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-[#114B43] focus:ring-2 focus:ring-[#114B43]/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-xs font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43]"
              aria-label="Clear public search"
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-stone-500" role="status" aria-live="polite">
          {normalizedQuery ? `${resultCount} result${resultCount === 1 ? '' : 's'} for “${query.trim()}”.` : 'Search is limited to public learning content.'}
        </p>
      </section>

      {normalizedQuery && resultCount === 0 && (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6" role="status">
          <h2 className="font-serif text-lg font-semibold text-stone-900">No public matches yet</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
            Try a broader topic such as “math”, “lesson”, “progress”, or “account”, or clear the search to browse everything.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-4 rounded-lg bg-[#114B43] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0f453c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43]"
          >
            Browse all public content
          </button>
        </section>
      )}

      <section id="curriculum" aria-labelledby="curriculum-heading">
        <h2 id="curriculum-heading" className="text-2xl font-serif font-semibold text-stone-900">
          Explore the curriculum
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Browse the topics and their prerequisites, then use the subject selector in the interactive knowledge graph to explore a learning path.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {filteredCurriculum.map(({ subject, concepts }) => (
            <details key={subject} className="group min-w-0 rounded-xl border border-stone-200 bg-white p-4" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-serif text-lg font-semibold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43]">
                <span>{subject}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ol className="mt-3 space-y-4">
                {concepts.map((concept) => (
                  <li key={concept.id}>
                    <h3 className="break-words text-sm font-semibold text-stone-900">{concept.title}</h3>
                    <p className="mt-1 break-words text-sm leading-6 text-stone-600">{concept.description}</p>
                    <p className="mt-1 break-words text-xs leading-5 text-stone-500">
                      Prerequisites: {concept.prerequisites.length ? concept.prerequisites.join('; ') : 'None — foundational topic.'}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </section>

      <section id="faq" className="max-w-3xl" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-serif font-semibold text-stone-900">
          Frequently asked questions
        </h2>
        <div className="mt-4 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {filteredFaq.map((item) => (
            <details key={item.question} className="group p-4 first:rounded-t-xl last:rounded-b-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43]">
                <span>{item.question}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-2 text-sm leading-6 text-stone-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {(author || config.phrase) && (
        <aside
          aria-labelledby={author ? 'public-author-heading' : undefined}
          aria-label={author ? undefined : 'Public attribution'}
          className="max-w-3xl rounded-xl border border-stone-200 bg-stone-50 p-4"
        >
          {author && <h2 id="public-author-heading" className="break-words font-serif text-lg font-semibold text-stone-900">About {author.name}</h2>}
          {author && <p id="public-author-bio" className="mt-2 whitespace-pre-line text-sm leading-6 text-stone-600">{author.bio}</p>}
          {config.phrase && <p className={`${author ? 'mt-3 border-t border-stone-200 pt-3' : ''} text-sm leading-6 text-stone-600`}>{config.phrase}</p>}
        </aside>
      )}
    </div>
  );
}
