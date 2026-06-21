import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

interface PlaceholderPageProps {
  title: string;
  message: string;
}

export default function PlaceholderPage({ title, message }: PlaceholderPageProps) {
  const { t } = useI18n();

  return (
    <main className="placeholder-wrap">
      <section className="placeholder-card">
        <p className="placeholder-kicker">{t('common.inProgress') || 'In progress'}</p>

        <h1>{title}</h1>
        <p>{message}</p>

        <Link to="/" className="btn btn-primary">
          {t('nav.backToHome') || 'Back to Home'}
        </Link>
      </section>
    </main>
  );
}
