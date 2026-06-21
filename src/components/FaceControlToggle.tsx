import { useEyeTracking } from '../context/EyeTrackingContext';
import { useI18n } from '../i18n/I18nProvider';

export default function FaceControlToggle() {
  const { isEnabled, toggle, shortcutLabel } = useEyeTracking();
  const { t } = useI18n();

  const toggleHint = `${t('faceControl.press')} ${shortcutLabel} ${t('faceControl.toToggle')}`;

  return (
    <button
      type="button"
      className={`btn btn-ghost face-control-toggle${isEnabled ? ' face-control-toggle--on' : ''}`}
      onClick={toggle}
      aria-pressed={isEnabled}
      aria-label={isEnabled ? t('faceControl.disableAria') : t('faceControl.enableAria')}
      title={toggleHint}
    >
      <span className="face-control-toggle-main">
        {t('faceControl.title')} <span className="face-control-dev-label">{t('faceControl.devMode')}</span>
        <span className="face-control-state">{isEnabled ? t('common.on') : t('common.off')}</span>
      </span>
      <span className="face-control-toggle-hint">{toggleHint}</span>
    </button>
  );
}
