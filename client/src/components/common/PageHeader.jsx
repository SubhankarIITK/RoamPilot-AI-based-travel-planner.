export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-balance break-words text-2xl font-extrabold tracking-[-0.025em] text-slate-900 lg:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
    </div>
  );
}
