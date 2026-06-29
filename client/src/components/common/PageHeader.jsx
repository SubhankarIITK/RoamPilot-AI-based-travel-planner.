export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-balance text-2xl font-extrabold tracking-[-0.025em] text-slate-900 lg:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
