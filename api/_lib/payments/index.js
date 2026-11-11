// Payment provider registry. Only COD exists today (no fake bKash/Nagad/card code).
//
// A real gateway is added by writing a provider with the same shape and registering it here:
//   { id, label, initiate({ user, order }) -> { paymentStatus, redirectUrl? } }
// plus a webhook route that VERIFIES the callback with the provider's official API/signature before
// marking an order paid. Secrets go in server-only environment variables. Also extend PAYMENT_METHODS in models/constants.js.
import cod from './cod.js';

const providers = { [cod.id]: cod };
export const getProvider = (id) => providers[id] ?? null;
export const listProviders = () => Object.values(providers).map(({ id, label }) => ({ id, label }));
