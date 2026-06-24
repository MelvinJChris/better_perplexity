'use client';

import { useState, type FormEvent } from 'react';

interface QueryFormProps {
  onSubmit: (query: string) => void;
  variant?: 'hero' | 'bar';
  initialValue?: string;
  pending?: boolean;
  autoFocus?: boolean;
}

export function QueryForm({
  onSubmit,
  variant = 'hero',
  initialValue = '',
  pending = false,
  autoFocus = false,
}: QueryFormProps) {
  const [value, setValue] = useState(initialValue);
  const hero = variant === 'hero';

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <label htmlFor="query" className="sr-only">
        Research question
      </label>
      <input
        id="query"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        placeholder="Ask a research question..."
        className={`min-w-0 flex-1 rounded-card border border-hairline bg-surface text-ink shadow-card placeholder:text-muted/70 focus-visible:border-accent ${
          hero ? 'px-4 py-3.5 text-base' : 'px-3.5 py-2.5 text-sm'
        }`}
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className={`shrink-0 rounded-card bg-accent font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
          hero ? 'px-5 py-3.5 text-base' : 'px-4 py-2.5 text-sm'
        }`}
      >
        Ask
      </button>
    </form>
  );
}
