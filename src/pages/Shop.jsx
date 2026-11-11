import { useLang } from '../context/LanguageContext.jsx';
import { usePageMeta } from '../hooks/usePageMeta.js';
import ProductListing from '../components/ProductListing.jsx';

export default function Shop() {
  const { t } = useLang();
  usePageMeta(`${t('shop.title')} | ${t('brand')}`, t('hero.body'));
  return <ProductListing title={t('shop.title')} crumbs={[{ label: t('bc.home'), to: '/' }, { label: t('shop.title') }]} showCategoryFilter />;
}
