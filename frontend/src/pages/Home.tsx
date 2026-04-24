import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <header className="mb-16 text-center">
        <h1 className="font-mono text-5xl font-semibold tracking-tight text-text-primary mb-3">
          SimMatch
        </h1>
        <p className="text-text-secondary text-lg font-mono">
          Fuzzy matching for STIM
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <Link
          to="/match/name"
          className="group block bg-surface border border-border rounded-xl p-8 hover:border-accent transition-colors duration-200"
        >
          <div className="mb-4 text-3xl">&#9632;</div>
          <h2 className="font-mono text-xl font-semibold text-text-primary mb-2 group-hover:text-accent transition-colors">
            Name Match
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Match artists, composers, and people across two files using fuzzy
            string similarity.
          </p>
          <div className="mt-6 text-accent font-mono text-sm font-medium">
            Start matching &rarr;
          </div>
        </Link>

        <Link
          to="/match/company"
          className="group block bg-surface border border-border rounded-xl p-8 hover:border-accent transition-colors duration-200"
        >
          <div className="mb-4 text-3xl">&#9650;</div>
          <h2 className="font-mono text-xl font-semibold text-text-primary mb-2 group-hover:text-accent transition-colors">
            Company Match
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Match organisations by company name or exact organisation number
            lookup.
          </p>
          <div className="mt-6 text-accent font-mono text-sm font-medium">
            Start matching &rarr;
          </div>
        </Link>
      </div>

      <footer className="mt-20 text-text-secondary text-xs font-mono">
        <Link to="/analytics" className="hover:text-accent transition-colors">
          analytics &rarr;
        </Link>
      </footer>
    </div>
  );
}
