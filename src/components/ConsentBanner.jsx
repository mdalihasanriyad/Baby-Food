import { useLang } from '../context/LanguageContext.jsx';
import { usePixel } from '../context/PixelContext.jsx';

// Shown only when a Meta Pixel is configured. Nothing is sent to Meta until "Accept" is chosen.
export default function ConsentBanner() {
  const { t } = useLang();
  const px = usePixel();
  if (!px.showBanner) return null;
  return (
    <div role="dialog" aria-label={t('consent.title')} className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-200 bg-white p-4 shadow-[0_-8px_24px_-12px_rgba(20,95,148,.4)]">
      <div className="container-x flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm"><p className="font-semibold">{t('consent.title')}</p><p className="text-ink-soft">{t('consent.body')}</p></div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={px.decline}>{t('consent.decline')}</button>
          <button className="btn-primary" onClick={px.accept}>{t('consent.accept')}</button>
        </div>
      </div>
    </div>
  );
}
