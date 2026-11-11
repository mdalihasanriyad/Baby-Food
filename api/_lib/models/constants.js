export const ROLES = ['customer', 'admin'];
export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['unpaid', 'collected']; // COD: unpaid until cash is collected
export const PAYMENT_METHODS = ['cod'];
export const DELIVERY_ZONES = ['inside_dhaka', 'outside_dhaka'];
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

// Valid forward transitions. Enforced by the order service in Phase 7/8.
export const ORDER_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

// Statuses from which a CUSTOMER may cancel on their own. Later stages need the shop's help (admin).
export const CUSTOMER_CANCELLABLE = ['pending', 'confirmed'];

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BD_PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;
const isWhole = (v) => v == null || Number.isInteger(v); // null/undefined = "not set" (required-ness is checked elsewhere)
export const wholeTaka = { validator: isWhole, message: '{PATH} must be a whole number of taka' };
