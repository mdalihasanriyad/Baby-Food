// Stored form is always the 11-digit local number: 01XXXXXXXXX
export const normalizePhone = (p) => String(p ?? '').replace(/[\s-]/g, '').replace(/^(\+?88)(?=01)/, '');
export const LOCAL_PHONE_RE = /^01[3-9]\d{8}$/;
