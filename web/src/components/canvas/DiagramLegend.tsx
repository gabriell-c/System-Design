interface DiagramLegendProps {
  variant?: 'overlay' | 'inline';
  className?: string;
}

export default function DiagramLegend({ variant = 'overlay', className = '' }: DiagramLegendProps) {
  const shell =
    variant === 'overlay'
      ? 'bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-lg shadow-xl p-3 text-xs'
      : 'bg-[#0d1219] border border-white/10 rounded-lg p-3 text-xs';

  return (
    <div className={`${shell} ${className}`.trim()}>
      <p className="font-semibold text-zinc-300 mb-2">Legenda</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-6 h-0.5 bg-slate-400 rounded" />
          <span className="text-zinc-400">Sync (HTTP/gRPC)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 border-t-2 border-dashed border-violet-400" />
          <span className="text-zinc-400">Async (Kafka/AMQP)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-0.5 bg-emerald-500 rounded" />
          <span className="text-zinc-400">Data flow</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-0.5 bg-pink-400 rounded" />
          <span className="text-zinc-400">Critical path ★</span>
        </div>

        <div className="mt-2 pt-2 border-t border-zinc-800">
          <p className="text-zinc-500 mb-1">Fluxos numerados</p>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
              1
            </span>
            <span className="text-zinc-400">Ordem de execução</span>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-zinc-800">
          <p className="text-zinc-500 mb-1">Zonas</p>
          <div className="grid grid-cols-2 gap-1">
            <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">Region</span>
            <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">VPC</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AZ</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Public</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Private</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Security</span>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-zinc-800">
          <p className="text-zinc-500 mb-1">Indicadores</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-zinc-400">Gargalo crítico</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-zinc-400">Aviso</span>
          </div>
        </div>
      </div>
    </div>
  );
}
