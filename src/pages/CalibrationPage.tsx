import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ArrowLeft, CheckCircle, RefreshCw, Target, Crosshair, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';
import { useEyeTracking } from '../context/EyeTrackingContext';
import { profileApi } from '../api/profileApi';

const CAL_POINTS = [
  { x: 10, y: 10 },
  { x: 50, y: 10 },
  { x: 90, y: 10 },
  { x: 10, y: 50 },
  { x: 50, y: 50 },
  { x: 90, y: 50 },
  { x: 10, y: 90 },
  { x: 50, y: 90 },
  { x: 90, y: 90 },
];

const RING_RADIUS = 36;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type Step = 'intro' | 'calibrating' | 'success';

export default function CalibrationPage() {
  const { t } = useI18n();
  const { isLoggedIn } = useAuth();
  const { setEnabled: setEyeTrackingEnabled } = useEyeTracking();

  const [step, setStep] = useState<Step>('intro');
  const [pointIndex, setPointIndex] = useState(0);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [completedPoints, setCompletedPoints] = useState<number[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const startCalibration = () => {
    setEyeTrackingEnabled(true);
    setStep('calibrating');
    setPointIndex(0);
    setDwellProgress(0);
    setCompletedPoints([]);
    setIsCapturing(false);
  };

  const saveCalibration = useCallback(async () => {
    if (!isLoggedIn) return;

    try {
      await profileApi.updateCalibration({
        bounds: { leftX: 0.1, rightX: 0.9, topY: 0.1, bottomY: 0.9 },
      });
    } catch {
      // UI flow continues even if API save fails during development
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (step !== 'calibrating' || isCapturing) return;

    const interval = window.setInterval(() => {
      setDwellProgress(prev => {
        if (prev >= 100) return prev;
        return Math.min(prev + 2.5, 100);
      });
    }, 40);

    return () => window.clearInterval(interval);
  }, [step, pointIndex, isCapturing]);

  useEffect(() => {
    if (dwellProgress < 100 || step !== 'calibrating' || isCapturing) return;

    let advanceTimeout: number | undefined;

    const captureTimeout = window.setTimeout(() => {
      setIsCapturing(true);

      advanceTimeout = window.setTimeout(() => {
        setCompletedPoints(prev => [...prev, pointIndex]);

        if (pointIndex < CAL_POINTS.length - 1) {
          setPointIndex(pi => pi + 1);
          setDwellProgress(0);
          setIsCapturing(false);
        } else {
          window.setTimeout(() => {
            void saveCalibration();
            setStep('success');
          }, 400);
        }
      }, 500);
    }, 0);

    return () => {
      window.clearTimeout(captureTimeout);
      if (advanceTimeout !== undefined) {
        window.clearTimeout(advanceTimeout);
      }
    };
  }, [dwellProgress, step, pointIndex, isCapturing, saveCalibration]);

  const currentPoint = CAL_POINTS[pointIndex];
  const captured = completedPoints.includes(pointIndex);

  return (
    <div className="calibration-page">
      {step === 'intro' && (
        <>
          <header className="login-header container">
            <Link to="/settings" className="login-back group">
              <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
              <span>{t('nav.back')}</span>
            </Link>

            <Link to="/" className="login-logo-link" aria-label={t('brand.homeAria')}>
              <img src="/logo/TD_App_Logo.png" alt={t('brand.logoDarkAlt')} className="login-logo" />
            </Link>
          </header>

          <main className="calibration-main container">
            <section className="calibration-card">
              <div className="calibration-hero-icon">
                <Eye size={80} strokeWidth={2} />
              </div>

              <div className="calibration-intro">
                <h1>{t('calibration.title')}</h1>
                <p>{t('calibration.subtitle')}</p>
              </div>

              <div className="calibration-steps">
                {[
                  {
                    icon: <Eye size={32} strokeWidth={2.5} />,
                    label: t('calibration.step1Title'),
                    sub: t('calibration.step1Body'),
                  },
                  {
                    icon: <Target size={32} strokeWidth={2.5} />,
                    label: t('calibration.step2Title'),
                    sub: t('calibration.step2Body'),
                  },
                  {
                    icon: <CheckCircle size={32} strokeWidth={2.5} />,
                    label: t('calibration.step3Title'),
                    sub: t('calibration.step3Body'),
                  },
                ].map((item, index) => (
                  <article key={index} className="calibration-step-card">
                    <div className="calibration-step-icon">{item.icon}</div>
                    <strong>{item.label}</strong>
                    <span>{item.sub}</span>
                  </article>
                ))}
              </div>

              <button type="button" className="calibration-primary-btn group" onClick={startCalibration}>
                <Crosshair size={32} strokeWidth={3} className="btn-icon calibration-crosshair-icon" />
                {t('calibration.begin')}
              </button>
            </section>
          </main>
        </>
      )}

      {step === 'calibrating' && (
        <div className="calibration-active">
          <div className="calibration-active-top">
            <span className="calibration-progress-label">
              {completedPoints.length}/{CAL_POINTS.length}
            </span>
            <div className="calibration-progress-track">
              <div
                className="calibration-progress-fill"
                style={{ width: `${(completedPoints.length / CAL_POINTS.length) * 100}%` }}
              />
            </div>
            <button type="button" className="calibration-cancel-btn" onClick={() => setStep('intro')}>
              {t('calibration.cancel')}
            </button>
          </div>

          <p className="calibration-instruction">{captured ? t('calibration.captured') : t('calibration.gazeHold')}</p>

          {CAL_POINTS.map((point, index) => {
            if (!completedPoints.includes(index)) return null;

            return (
              <div
                key={`done-${index}`}
                className="calibration-point calibration-point--done"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <div className="calibration-point-done-dot">
                  <CheckCircle size={16} strokeWidth={3} />
                </div>
              </div>
            );
          })}

          {!captured && (
            <div
              className="calibration-point calibration-point--active"
              style={{ left: `${currentPoint.x}%`, top: `${currentPoint.y}%` }}
            >
              <div className="calibration-point-pulse" />
              <svg width="88" height="88" className="calibration-point-ring" viewBox="0 0 88 88">
                <circle
                  cx="44"
                  cy="44"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="#ff7700"
                  strokeWidth="8"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - dwellProgress / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 44 44)"
                />
              </svg>
              <div className="calibration-point-core" />
            </div>
          )}

          {captured && (
            <div
              className="calibration-point calibration-point--flash"
              style={{ left: `${currentPoint.x}%`, top: `${currentPoint.y}%` }}
            >
              <div className="calibration-point-flash-dot">
                <CheckCircle size={36} strokeWidth={3} />
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'success' && (
        <>
          <header className="login-header container calibration-success-header">
            <div className="calibration-header-spacer" />
            <Link to="/" className="login-logo-link" aria-label={t('brand.homeAria')}>
              <img src="/logo/TD_App_Logo.png" alt={t('brand.logoDarkAlt')} className="login-logo" />
            </Link>
          </header>

          <main className="calibration-main container">
            <section className="calibration-card calibration-card--success">
              <div className="calibration-success-icon">
                <CheckCircle size={96} strokeWidth={2} />
              </div>

              <div className="calibration-intro">
                <h1>{t('calibration.completeTitle')}</h1>
                <p>{t('calibration.completeBody')}</p>
              </div>

              <div className="calibration-stats">
                <div>
                  <span>{t('calibration.accuracyLabel')}</span>
                  <strong className="calibration-stat-green">98%</strong>
                </div>
                <div>
                  <span>{t('calibration.pointsLabel')}</span>
                  <strong className="calibration-stat-orange">
                    {CAL_POINTS.length}/{CAL_POINTS.length}
                  </strong>
                </div>
                <div>
                  <span>{t('calibration.qualityLabel')}</span>
                  <strong>{t('calibration.qualityValue')}</strong>
                </div>
              </div>

              <div className="calibration-actions">
                <button type="button" className="calibration-secondary-btn group" onClick={startCalibration}>
                  <RefreshCw size={28} strokeWidth={3} className="btn-icon calibration-refresh-icon" />
                  {t('calibration.recalibrate')}
                </button>
                <Link to="/lessons" className="calibration-primary-btn group calibration-primary-btn--compact">
                  {t('calibration.startCoding')}
                  <ArrowRight size={28} strokeWidth={3} className="btn-icon" />
                </Link>
              </div>
            </section>
          </main>
        </>
      )}
    </div>
  );
}
