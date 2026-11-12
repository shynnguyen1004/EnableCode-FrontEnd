import { useHandTracking } from '../context/HandTrackingContext';
import { useI18n } from '../i18n/I18nProvider';

export default function HandControlToggle() {
  const { isEnabled, toggle } = useHandTracking();
  const { t } = useI18n();

  return (
    <button
      type="button"
      className={`btn btn-ghost face-control-toggle hand-control-toggle${isEnabled ? ' hand-control-toggle--on' : ''}`}
      onClick={toggle}
      aria-pressed={isEnabled}
      aria-label={isEnabled ? t('handTracking.disableAria') : t('handTracking.enableAria')}
      title={t('handTracking.hint')}
    >
      <span className="face-control-toggle-main">
        {t('handTracking.title')} <span className="face-control-dev-label">{t('handTracking.devMode')}</span>
        <span className="face-control-state">{isEnabled ? t('common.on') : t('common.off')}</span>
      </span>
      <span className="face-control-toggle-hint">{t('handTracking.hint')}</span>
    </button>
  );
}
