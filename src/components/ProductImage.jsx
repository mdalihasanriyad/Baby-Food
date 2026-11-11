import { imgUrl } from '../utils/img.js';

// Real photo when the product has one; otherwise a labeled placeholder (never a fake product photo).
export default function ProductImage({ product, name, width = 400, eager = false, className = '' }) {
  const img = product.images?.[0];
  if (!img) {
    return (
      <div className={`flex items-center justify-center bg-sky-100 p-3 text-center font-bold text-sky-700/70 ${className}`} role="img" aria-label={name}>
        {product.name.en}
      </div>
    );
  }
  const cloud = img.url.includes('res.cloudinary.com');
  return (
    <img
      src={imgUrl(img.url, width)}
      srcSet={cloud ? `${imgUrl(img.url, width)} 1x, ${imgUrl(img.url, width * 2)} 2x` : undefined}
      alt={img.alt || name}
      width={width} height={width}
      loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined}
      className={`object-cover ${className}`}
    />
  );
}
