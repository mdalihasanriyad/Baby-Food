// Cash on Delivery: nothing to collect online, the order starts "unpaid" until the courier collects cash.
export default {
  id: 'cod',
  label: { bn: 'ক্যাশ অন ডেলিভারি', en: 'Cash on delivery' },
  // Real gateways receive { user, order } here and may return a redirect URL; COD has nothing to do online.
  async initiate(_context) {
    return { paymentStatus: 'unpaid' };
  },
};
