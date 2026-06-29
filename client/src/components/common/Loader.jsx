export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center py-16 text-slate-500">
      <div className="relative mb-4 h-10 w-10">
        <div className="absolute inset-0 rounded-full border-[3px] border-blue-100" />
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-blue-600" />
      </div>
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}
