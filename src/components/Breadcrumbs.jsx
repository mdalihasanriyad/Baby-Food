import { Link } from 'react-router-dom';

export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.to ? <Link to={c.to} className="hover:text-sky-700 hover:underline">{c.label}</Link> : <span aria-current="page" className="text-ink">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
