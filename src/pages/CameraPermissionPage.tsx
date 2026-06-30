import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, ShieldCheck, Video } from 'lucide-react';
import PageScale from '../components/PageScale';
import { useI18n } from '../i18n/I18nProvider';
import {
  hasCameraPermissionCookie,
  requestCameraPermission,
  setCameraPermissionCookie,
  type CameraPermissionResult,
} from '../lib/cameraPermissionCookie';

export default function CameraPermissionPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'requesting'>('idle');
  const [error, setError] = useState<CameraPermissionResult | null>(null);

  useEffect(() => {
    if (hasCameraPermissionCookie()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleRequestPermission = async () => {
    setStatus('requesting');
    setError(null);

    const result = await requestCameraPermission();

    if (result === 'granted') {
      setCameraPermissionCookie();
      navigate('/', { replace: true });
      return;
    }

    setError(result);
    setStatus('idle');
  };

  return (
    <PageScale scale={0.75} className="calibration-page">
      <main className="calibration-main container">
        <section className="calibration-card">
          <div className="calibration-hero-icon" style={{ background: 'var(--accent-green)' }}>
            <Camera size={80} strokeWidth={2} />
          </div>

          <div className="calibration-intro">
            <h1>{t('cameraPermission.title')}</h1>
            <p>{t('cameraPermission.subtitle')}</p>
          </div>

          <div className="calibration-steps">
            {[
              {
                icon: <Video size={32} strokeWidth={2.5} />,
                label: t('cameraPermission.step1Title'),
                sub: t('cameraPermission.step1Body'),
              },
              {
                icon: <ShieldCheck size={32} strokeWidth={2.5} />,
                label: t('cameraPermission.step2Title'),
                sub: t('cameraPermission.step2Body'),
              },
              {
                icon: <Camera size={32} strokeWidth={2.5} />,
                label: t('cameraPermission.step3Title'),
                sub: t('cameraPermission.step3Body'),
              },
            ].map((item, index) => (
              <article key={index} className="calibration-step-card">
                <div className="calibration-step-icon">{item.icon}</div>
                <strong>{item.label}</strong>
                <span>{item.sub}</span>
              </article>
            ))}
          </div>

          {error && (
            <p className="camera-permission-error" role="alert">
              {error === 'denied' ? t('cameraPermission.denied') : t('cameraPermission.unsupported')}
            </p>
          )}

          <button
            type="button"
            className="calibration-primary-btn group"
            onClick={() => void handleRequestPermission()}
            disabled={status === 'requesting'}
            style={{ opacity: status === 'requesting' ? 0.7 : 1 }}
          >
            {status === 'requesting' ? (
              <>
                <Loader2 size={32} strokeWidth={3} className="btn-icon animate-spin" />
                {t('cameraPermission.requesting')}
              </>
            ) : (
              <>
                <Camera size={32} strokeWidth={3} className="btn-icon" />
                {error ? t('cameraPermission.retry') : t('cameraPermission.requestButton')}
              </>
            )}
          </button>

          <p className="camera-permission-note">{t('cameraPermission.privacyNote')}</p>
        </section>
      </main>
    </PageScale>
  );
}
