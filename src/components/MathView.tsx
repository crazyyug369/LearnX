import React, { useMemo } from 'react';
import katex from 'katex';

interface MathViewProps {
  text?: string;
  math?: string;
  display?: boolean;
  formatMarkdown?: boolean;
  className?: string;
  as?: 'span' | 'div' | 'p' | 'label' | 'strong' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'li';
}

/**
 * Escapes HTML characters in raw text.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats basic markdown within safe prose (math tokens are already extracted).
 */
function formatMarkdownProse(prose: string): string {
  if (!prose) return '';

  const rawLines = prose.split(/\r?\n/);
  const formattedLines: string[] = [];

  for (const rawLine of rawLines) {
    let line = escapeHtml(rawLine);

    // 1. Check for bullet list item: * or - followed by space
    const bulletMatch = line.match(/^(\s*)(?:[\*\-]|•)\s+(.+)$/);
    if (bulletMatch) {
      line = `<div class="flex items-start gap-2 my-1 ml-0.5 text-stone-850 dark:text-stone-150"><span class="text-[#114B43] dark:text-emerald-400 font-bold shrink-0 mt-0.5 leading-none">•</span><div class="flex-1">${bulletMatch[2]}</div></div>`;
    } else {
      const numMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (numMatch) {
        line = `<div class="flex items-start gap-2 my-1 ml-0.5 text-stone-850 dark:text-stone-150"><span class="text-stone-600 dark:text-stone-400 font-semibold shrink-0 text-xs mt-0.5">${numMatch[2]}.</span><div class="flex-1">${numMatch[3]}</div></div>`;
      } else {
        const h3Match = line.match(/^###\s+(.+)$/);
        if (h3Match) {
          line = `<h4 class="font-serif font-semibold text-sm text-stone-900 dark:text-stone-100 mt-2.5 mb-1">${h3Match[1]}</h4>`;
        } else {
          const h2Match = line.match(/^##\s+(.+)$/);
          if (h2Match) {
            line = `<h3 class="font-serif font-bold text-base text-stone-900 dark:text-stone-100 mt-3 mb-1.5">${h2Match[1]}</h3>`;
          }
        }
      }
    }

    // 2. Inline code: `code`
    line = line.replace(
      /`([^`\n]+?)`/g,
      '<code class="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-mono text-xs border border-stone-200/60 dark:border-stone-700/60">$1</code>'
    );

    // 3. Bold: **text**
    line = line.replace(
      /\*\*([^\*\n]+?)\*\*/g,
      '<strong class="font-semibold text-stone-900 dark:text-stone-100">$1</strong>'
    );

    // 4. Double underscore bold: __text__ (only for actual words, never touching «KTX...»)
    line = line.replace(
      /(^|[^\w«»])__([^\s_][^_\n]*?[^\s_])__([^\w«»]|$)/g,
      '$1<strong class="font-semibold text-stone-900 dark:text-stone-100">$2</strong>$3'
    );

    // 5. Italic: *text* (when not already bold or bullet)
    line = line.replace(
      /(^|[^\*<>\/«»])\*([^\*\n\s][^\*\n]*?[^\*\n\s])\*([^\*<>\/«»]|$)/g,
      '$1<em class="italic text-stone-800 dark:text-stone-200">$2</em>$3'
    );

    formattedLines.push(line);
  }

  // Join lines: prevent excess <br /> between block elements
  let result = '';
  for (let i = 0; i < formattedLines.length; i++) {
    const cur = formattedLines[i];
    if (i === 0) {
      result = cur;
    } else {
      const prev = formattedLines[i - 1];
      const isPrevBlock = prev.startsWith('<div') || prev.startsWith('<h');
      const isCurBlock = cur.startsWith('<div') || cur.startsWith('<h');
      if (isPrevBlock || isCurBlock) {
        result += cur;
      } else {
        result += '<br />' + cur;
      }
    }
  }

  return result;
}

/**
 * Comprehensive parser that extracts LaTeX formulas, renders them via KaTeX,
 * and formats any surrounding markdown prose.
 */
function renderLatexAndMarkdown(content: string, forceDisplay: boolean = false, enableMarkdown: boolean = true): string {
  if (!content) return '';

  // If forceDisplay or the entire string is already a pure math expression
  if (forceDisplay) {
    const cleaned = content.replace(/^\${1,2}|\${1,2}$/g, '').trim();
    try {
      return katex.renderToString(cleaned, {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return escapeHtml(content);
    }
  }

  // Pre-process ```math ... ``` and ```latex ... ``` code blocks into $$ ... $$
  let processed = content.replace(/```(?:math|latex|katex)?\s*\n?([\s\S]*?)\n?```/gi, (_match, mathCode) => {
    return `\n\n$$${mathCode.trim()}$$\n\n`;
  });

  // Array to hold rendered KaTeX HTML strings
  const tokens: string[] = [];

  const pushToken = (renderedHtml: string): string => {
    const tokenIndex = tokens.length;
    tokens.push(renderedHtml);
    return `«KTX${tokenIndex}»`;
  };

  // 1. Match block math ($$...$$, \[...\], \begin{...}...\end{...})
  // We use non-greedy matching across newlines
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_match, mathCode) => {
    const trimmed = mathCode.trim();
    try {
      const rendered = katex.renderToString(trimmed, {
        displayMode: true,
        throwOnError: false,
      });
      return pushToken(
        `<span class="katex-display-wrapper block my-2.5 text-center overflow-x-auto py-1 px-2 rounded-lg bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50">${rendered}</span>`
      );
    } catch {
      return pushToken(`<span class="font-mono text-xs text-rose-500">${escapeHtml(trimmed)}</span>`);
    }
  });

  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_match, mathCode) => {
    const trimmed = mathCode.trim();
    try {
      const rendered = katex.renderToString(trimmed, {
        displayMode: true,
        throwOnError: false,
      });
      return pushToken(
        `<span class="katex-display-wrapper block my-2.5 text-center overflow-x-auto py-1 px-2 rounded-lg bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50">${rendered}</span>`
      );
    } catch {
      return pushToken(`<span class="font-mono text-xs text-rose-500">${escapeHtml(trimmed)}</span>`);
    }
  });

  processed = processed.replace(
    /\\begin\{(?:align\*?|equation\*?|gather\*?|matrix|pmatrix|bmatrix|cases)\}[\s\S]+?\\end\{(?:align\*?|equation\*?|gather\*?|matrix|pmatrix|bmatrix|cases)\}/g,
    (mathCode) => {
      try {
        const rendered = katex.renderToString(mathCode.trim(), {
          displayMode: true,
          throwOnError: false,
        });
        return pushToken(
          `<span class="katex-display-wrapper block my-2.5 text-center overflow-x-auto py-1 px-2 rounded-lg bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200/50 dark:border-stone-800/50">${rendered}</span>`
        );
      } catch {
        return pushToken(`<span class="font-mono text-xs text-rose-500">${escapeHtml(mathCode)}</span>`);
      }
    }
  );

  // 2. Match inline math: \(...\)
  processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_match, mathCode) => {
    const trimmed = mathCode.trim();
    try {
      const rendered = katex.renderToString(trimmed, {
        displayMode: false,
        throwOnError: false,
      });
      return pushToken(`<span class="katex-inline-wrapper inline-block mx-0.5">${rendered}</span>`);
    } catch {
      return pushToken(`<span class="font-mono text-xs">${escapeHtml(trimmed)}</span>`);
    }
  });

  // 3. Match inline math: $...$
  // Lookbehind for non-backslash, not immediately followed by whitespace, content without $, not immediately preceded by whitespace
  processed = processed.replace(/(^|[^\\])\$([^\$\n\r]+?)\$/g, (_match, prefix, mathCode) => {
    const trimmed = mathCode.trim();
    // Guard against currency amounts like "$5 and $10" where there are spaces and purely numbers
    if (/^\d+(\.\d{2})?$/.test(trimmed) && trimmed.length > 5) {
      return `${prefix}$${trimmed}$`;
    }
    try {
      const rendered = katex.renderToString(trimmed, {
        displayMode: false,
        throwOnError: false,
      });
      return `${prefix}${pushToken(`<span class="katex-inline-wrapper inline-block mx-0.5">${rendered}</span>`)}`;
    } catch {
      return `${prefix}${pushToken(`<span class="font-mono text-xs">${escapeHtml(trimmed)}</span>`)}`;
    }
  });

  // 4. Fallback for raw standalone unbracketed LaTeX commands like \frac{...}{...}, \sqrt{...}
  processed = processed.replace(
    /(?:^|\s)(\\frac\{[^{}]+\}\{[^{}]+\}|\\sqrt\{[^{}]+\}|\\Delta\b|\\theta\b|\\mu\b|\\pi\b|\\pm\b|\\le\b|\\ge\b|\\neq\b)(?=\s|[.,;:!?]|$)/g,
    (match, command) => {
      try {
        const rendered = katex.renderToString(command.trim(), {
          displayMode: false,
          throwOnError: false,
        });
        return ` ${pushToken(`<span class="katex-inline-wrapper inline-block mx-0.5">${rendered}</span>`)} `;
      } catch {
        return match;
      }
    }
  );

  // 5. Format remaining text with markdown (or simple HTML escape)
  let result = enableMarkdown ? formatMarkdownProse(processed) : escapeHtml(processed);

  // 6. Restore KaTeX tokens with exact string replacement
  for (let i = 0; i < tokens.length; i++) {
    result = result.split(`«KTX${i}»`).join(tokens[i]);
  }

  // Defensive catch-all for any unexpanded markers
  result = result.replace(/«KTX(\d+)»/g, (_match, id) => {
    const idx = parseInt(id, 10);
    return tokens[idx] !== undefined ? tokens[idx] : '';
  });

  // Backward compatibility safety net for any legacy or mangled ___KATEX_SLOT_ placeholders
  result = result.replace(/_{0,3}KATEX_SLOT_(\d+)_{0,3}/gi, (_match, id) => {
    const idx = parseInt(id, 10);
    return tokens[idx] !== undefined ? tokens[idx] : '';
  });

  return result;
}

export const MathView: React.FC<MathViewProps> = ({
  text,
  math,
  display = false,
  formatMarkdown = true,
  className = '',
  as: Component = 'span',
}) => {
  const content = math || text || '';

  const html = useMemo(() => {
    return renderLatexAndMarkdown(content, display, formatMarkdown);
  }, [content, display, formatMarkdown]);

  return (
    <Component
      className={`katex-rendered ${Component === 'span' ? 'inline' : 'block'} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MathView;
