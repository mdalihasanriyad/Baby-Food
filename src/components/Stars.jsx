export default function Stars({ value = 0, size = 16 }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex" role="img" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={n <= full ? 'text-amber-500' : 'text-sky-200'} fill="currentColor">
          <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
        </svg>
      ))}
    </span>
  );
}
