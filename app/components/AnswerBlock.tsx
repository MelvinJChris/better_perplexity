import Markdown from 'react-markdown';

// Streamed markdown answer. Inline numbered [n] citations render as text and map
// to the numbered source cards; styled citation chips with source hover-highlight
// land with the trust UI (#14/#16). Block styling lives in .answer-prose.

export function AnswerBlock({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <div className="answer-prose text-[15px] leading-relaxed text-ink">
      <Markdown>{text}</Markdown>
      {streaming ? (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-accent align-middle"
        />
      ) : null}
    </div>
  );
}
