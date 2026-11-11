import { useLang } from '../context/LanguageContext.jsx';
import { usePageMeta } from '../hooks/usePageMeta.js';
import ProductListing from '../components/ProductListing.jsx';

// /baby-food and /adult-food: every visible category the admin has put in that group.
export default function GroupPage({ group }) {
  const { t } = useLang();
  const title = t(`group.${group}`);
  usePageMeta(`${title} | ${t('brand')}`, t('hero.body'));
  return <ProductListing title={title} fixed={{ group }} categoryGroup={group} showCategoryFilter crumbs={[{ label: t('bc.home'), to: '/' }, { label: title }]} />;
}
