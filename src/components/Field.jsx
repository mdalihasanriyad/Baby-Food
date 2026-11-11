export default function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
