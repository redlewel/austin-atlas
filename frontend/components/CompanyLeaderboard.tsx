"use client";

import {
  formatMedianTc,
  LEVELS_FYI_ATTRIBUTION,
  rankedCompaniesForPanel,
  type TechCompany,
} from "@/lib/tech-pins";

type Props = {
  selectedId: string | null;
  onSelect: (company: TechCompany) => void;
};

export default function CompanyLeaderboard({ selectedId, onSelect }: Props) {
  const companies = rankedCompaniesForPanel();

  return (
    <aside
      className="pointer-events-auto absolute top-5 right-5 z-20 flex max-h-[min(70vh,32rem)] w-[min(100%-2.5rem,17.5rem)] flex-col overflow-hidden rounded-lg bg-black/55 text-white shadow-lg backdrop-blur-md"
      aria-label="Companies by prestige"
    >
      <header className="border-b border-white/10 px-3 py-2.5">
        <p className="text-sm font-medium tracking-tight">Companies</p>
        <p className="text-[11px] leading-snug text-white/65">
          Ranked by Levels.fyi SWE median TC
        </p>
      </header>

      <ul className="flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5">
        {companies.map((company, index) => {
          const active = selectedId === company.id;
          return (
            <li key={company.id}>
              <button
                type="button"
                onClick={() => onSelect(company)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors ${
                  active
                    ? "bg-white/20"
                    : "hover:bg-white/10"
                }`}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold text-black/80"
                  style={{ backgroundColor: company.color }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {company.name}
                  </span>
                  <span className="block truncate text-[11px] text-white/55">
                    {company.address}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums text-white/85">
                  {formatMedianTc(company.medianTc)}
                  {company.salaryScope === "us" ? (
                    <span className="block text-[10px] text-white/45">US</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="border-t border-white/10 px-3 py-2 text-[10px] leading-snug text-white/45">
        {LEVELS_FYI_ATTRIBUTION}
      </footer>
    </aside>
  );
}
