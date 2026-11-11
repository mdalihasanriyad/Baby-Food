import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { Logo } from './Icons.jsx';
import { usePixel } from '../context/PixelContext.jsx';

export default function Footer() {
  const { t } = useLang();
  const px = usePixel();
  return (
    <footer className="mt-16 border-t border-sky-100 bg-sky-50">
      <div className="container-x grid gap-8 py-10 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 font-bold text-sky-700"><Logo /> {t('brand')}</div>
          <p className="mt-3 text-sm text-ink-soft">babyfoodgallery.com</p>
        </div>
        <div>
          <h2 className="font-semibold">{t('footer.links')}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link className="text-ink-soft hover:text-sky-700" to="/shop">{t('nav.shop')}</Link></li>
            <li><Link className="text-ink-soft hover:text-sky-700" to="/baby-food">{t('group.baby')}</Link></li>
            <li><Link className="text-ink-soft hover:text-sky-700" to="/adult-food">{t('group.adult')}</Link></li>
            <li><Link className="text-ink-soft hover:text-sky-700" to="/about">{t('nav.about')}</Link></li>
            <li><Link className="text-ink-soft hover:text-sky-700" to="/contact">{t('nav.contact')}</Link></li>
            {px.enabled && <li><button className="min-h-[44px] text-left text-ink-soft hover:text-sky-700" onClick={px.openPreferences}>{t('consent.manage')}</button></li>}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">{t('contact.info')}</h2>
          <p className="mt-2 text-sm text-ink-soft">{t('contact.placeholderInfo')}</p>
        </div>
      </div>
      <div className="border-t border-sky-100 py-4 text-center text-xs text-ink-soft">
        © {new Date().getFullYear()} {t('brand')}. {t('footer.rights')}
      </div>
    </footer>
  );
}
