import { Monitor } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export default function MobileUnsupported() {
  const { t } = useI18n();

  return (
    <div className="mobile-unsupported" role="alert" aria-live="polite">
      <div className="mobile-unsupported-card">
        <div className="mobile-unsupported-icon" aria-hidden="true">
          <Monitor size={72} strokeWidth={2.5} />
        </div>
        <h1>{t('mobile.title')}</h1>
        <p>{t('mobile.message')}</p>
      </div>
    </div>
  );
}
