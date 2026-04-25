import { Link } from "react-router-dom";

const modes = [
  {
    to: "/match/id",
    icon: "#",
    title: "ID Match",
    desc: "Exact match on org numbers, ISRCs, customer IDs, or any identifier column.",
  },
  {
    to: "/match/name",
    icon: "A",
    title: "Name Match",
    desc: "Fuzzy match on names — artists, people, or companies.",
  },
  {
    to: "/match/city",
    icon: "A+",
    title: "Name + City Match",
    desc: "Fuzzy name match boosted by city — more accurate for company lists with location data.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <header className="mb-16 text-center">
        <h1 className="font-mono text-5xl font-semibold tracking-tight text-text-primary mb-3">
          SimMatch
        </h1>
        <p className="text-text-secondary text-lg font-mono">
          Fuzzy matching for structured data
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl">
        {modes.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="group block bg-surface border border-border rounded-xl p-7 hover:border-accent transition-colors duration-200"
          >
            <div className="mb-4 font-mono text-2xl font-bold text-accent">{m.icon}</div>
            <h2 className="font-mono text-lg font-semibold text-text-primary mb-2 group-hover:text-accent transition-colors">
              {m.title}
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed">{m.desc}</p>
            <div className="mt-5 text-accent font-mono text-sm font-medium">
              Start &rarr;
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
