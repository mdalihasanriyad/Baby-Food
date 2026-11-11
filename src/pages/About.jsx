import { useLang } from '../context/LanguageContext.jsx';

export default function About() {
  const { t } = useLang();
  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">{t('about.title')}</h1>
      <p className="mt-4 text-ink-soft">{t('about.body')}</p>
    </div>
  );
}
