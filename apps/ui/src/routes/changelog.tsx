import { createFileRoute } from '@tanstack/react-router';
import { sortedChangelog } from '~/lib/changelog';

export const Route = createFileRoute('/changelog')({ component: ChangelogPage });

function ChangelogPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-[#F6F6F6]">
      <h1 className="text-2xl font-semibold">Changelog</h1>
      <p className="mt-1 text-sm text-[#989898]">What changed in Soonwhy, newest first.</p>
      <div className="mt-8 space-y-8">
        {sortedChangelog().map((entry) => (
          <article key={entry.date + entry.title}>
            <time dateTime={entry.date} className="text-xs text-[#989898]">{entry.date}</time>
            <h2 className="mt-1 text-lg font-medium">{entry.title}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#CFCFD1]">
              {entry.highlights.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
