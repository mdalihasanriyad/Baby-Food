// Delivers smaller, modern-format images for Cloudinary URLs; other URLs are returned unchanged.
export function imgUrl(url, width = 400) {
  if (!url) return '';
  return url.includes('res.cloudinary.com') && url.includes('/upload/')
    ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`)
    : url;
}
