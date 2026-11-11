// Cards and grids show one image per product. Pure function, unit-tested.
export const slim = (items) => items.map((p) => ({ ...p, images: (p.images ?? []).slice(0, 1) }));
