import type { ProjectNfr } from '@/lib/types';

interface TitleBlockProps {
  title: string;
  author?: string;
  version?: string;
  date?: string;
  provider?: string;
  classification?: string;
  nfr?: ProjectNfr | null;
  /** overlay = canvas UI; inline = dentro de export/composição */
  variant?: 'overlay' | 'inline';
  className?: string;
}

export default function TitleBlock({
  title,
  author = 'Arquiteto',
  version = '1.0',
  date = new Date().toLocaleDateString('pt-BR'),
  provider,
  classification = 'Confidencial — uso interno',
  nfr,
  variant = 'overlay',
  className = '',
}: TitleBlockProps) {
  const shell =
    variant === 'overlay'
      ? 'bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-lg shadow-xl p-3 text-xs'
      : 'bg-[#0d1219] border border-white/10 rounded-lg p-3 text-xs';

  return (
    <div className={`${shell} ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-100 truncate">{title}</p>
          <p className="text-zinc-400 mt-0.5">
            {author} · v{version} · {date}
          </p>
          {provider && <p className="text-zinc-500 mt-0.5">Provider: {provider}</p>}
          {classification && (
            <p className="text-zinc-500 mt-1 text-[10px] uppercase tracking-wide">{classification}</p>
          )}
        </div>
        {nfr && (
          <div className="flex flex-col gap-1 text-right shrink-0">
            {nfr.availability_pct != null && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {nfr.availability_pct}%
              </span>
            )}
            {nfr.latency_p99_ms != null && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                p99 {nfr.latency_p99_ms}ms
              </span>
            )}
            {nfr.users_per_day != null && (
              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                ~{nfr.users_per_day}/dia
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
