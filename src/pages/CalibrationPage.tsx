import { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, ArrowLeft, CheckCircle, Target, RefreshCw, Crosshair, ArrowRight, CircleX } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';
import { useEyeTracking } from '../context/EyeTrackingContext';
import { useCalibration } from '../context/CalibrationContext';
import { profileApi } from '../api/profileApi';
import PageScale from '../components/PageScale';
import type { FaceMeshResults, FaceMeshType, CameraType } from '../lib/types';

declare global {
  interface Window {
    FaceMesh: new (config: { locateFile: (file: string) => string }) => FaceMeshType;
    Camera: new (
      video: HTMLVideoElement,
      options: { onFrame: () => Promise<void>; width: number; height: number },
    ) => CameraType;
  }
}

const CAL_POINTS = [
  { x: 50, y: 50, isMouth: true },
  { x: 50, y: 0, isMouth: false },
  { x: 100, y: 50, isMouth: false },
  { x: 50, y: 100, isMouth: false },
  { x: 0, y: 50, isMouth: false },
];

type Step = 'intro' | 'countdown' | 'calibrating' | 'success';

export default function CalibrationPage() {
  const { t } = useI18n();
  const { isLoggedIn } = useAuth();
  const { setEnabled: setEyeTrackingEnabled } = useEyeTracking();
  const { setCalibration } = useCalibration();

  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('intro');
  const [pointIndex, setPointIndex] = useState(0);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [completedPoints, setCompletedPoints] = useState<number[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [introCountdown, setIntroCountdown] = useState(3);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const faceMeshRef = useRef<FaceMeshType | null>(null);
  const cameraRef = useRef<CameraType | null>(null);

  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const pointIndexRef = useRef(pointIndex);
  useEffect(() => {
    pointIndexRef.current = pointIndex;
  }, [pointIndex]);

  const latestFaceCenterRef = useRef({ x: 0.5, y: 0.5 });
  const latestRawRef = useRef({ x: 0.5, y: 0.5 });
  const mouthGapRawRef = useRef(0);
  const latestFaceSizeRef = useRef({ width: 0 });

  const boundsRef = useRef({
    center: { x: 0, y: 0 },
    top: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    bottom: { x: 0, y: 0 },
    left: { x: 0, y: 0 },
    refWidth: 0,
    refFacePos: { x: 0, y: 0 },
  });
  const prefRef = useRef({ mouthDragThreshold: 0.03, speed: 1 });
  const mouthSamplesRef = useRef<number[]>([]); // lưu threshold đo được ở từng điểm calib  const prefRef = useRef({ mouthDragThreshold: 0.03, speed: 1 });

  const getSafeTranslation = (key: string, fallbackText: string): string => {
    if (!key) return fallbackText;
    try {
      const val = t(key);
      if (!val || val === key || val.includes(key)) return fallbackText;
      return val;
    } catch {
      return fallbackText;
    }
  };

  const getInstructionText = (): string => {
    if (completedPoints.includes(pointIndex)) return getSafeTranslation('calibration.captured', 'Đã ghi nhận vị trí!');
    const edgeKeys = [
      'calibration.holdMouth',
      'calibration.holdTop',
      'calibration.holdRight',
      'calibration.holdBottom',
      'calibration.holdLeft',
    ];
    const defaultTexts = [
      'Há miệng nhẹ để xác nhận vị trí',
      'Hướng đầu về mép trên màn hình',
      'Hướng đầu về mép phải màn hình',
      'Hướng đầu về mép dưới màn hình',
      'Hướng đầu về mép trái màn hình',
    ];
    return getSafeTranslation(edgeKeys[pointIndex], defaultTexts[pointIndex]);
  };

  useEffect(() => {
    const shouldHideMouse = step === 'countdown' || step === 'calibrating';
    if (shouldHideMouse) document.body.classList.add('hide-global-mouse-tracking');
    else document.body.classList.remove('hide-global-mouse-tracking');
    return () => document.body.classList.remove('hide-global-mouse-tracking');
  }, [step]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (stepRef.current === 'countdown' || stepRef.current === 'calibrating') {
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (e) {
        console.error('[AI-Tracker-Log] Error closing camera instance:', e);
      }
      cameraRef.current = null;
    }
    if (faceMeshRef.current) {
      const instance = faceMeshRef.current;
      faceMeshRef.current = null;
      try {
        instance.close();
      } catch {
        console.error('[AI-Tracker-Log] Error closing FaceMesh instance');
      }
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCalibration = async () => {
    try {
      const { FaceMesh, Camera } = window;
      if (!FaceMesh || !Camera) {
        alert('Chưa tải xong thư viện AI. Vui lòng đợi vài giây và thử lại.');
        return;
      }

      const videoElement = videoRef.current;
      if (!videoElement) {
        console.error('[AI-Tracker-Log] Error: Video element not found.');
        return;
      }

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.8,
        minTrackingConfidence: 0.8,
      });

      faceMesh.onResults((results: FaceMeshResults) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 640;
        canvas.height = 480;

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Flip the image from camera horizontally for a mirror effect
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const landmarks = results.multiFaceLandmarks[0];
          const noseTip = landmarks[4];
          const topLip = landmarks[13];
          const bottomLip = landmarks[14];

          // Caculate depth
          const forehead = landmarks[10]; // Đỉnh trán
          const chin = landmarks[152]; // Điểm dưới cằm
          const leftCheek = landmarks[116]; // Má trái ngoài cùng
          const rightCheek = landmarks[345]; // Má phải ngoài cùng

          const currentW = Math.sqrt(Math.pow(leftCheek.x - rightCheek.x, 2) + Math.pow(leftCheek.y - rightCheek.y, 2));

          // --- 1. TÍNH TÂM MẶT THỜI GIAN THỰC ---
          const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
          const faceCenterY = (forehead.y + chin.y) / 2;
          latestFaceCenterRef.current = { x: faceCenterX, y: faceCenterY };

          // --- 2. TÍNH ĐỘ RỘNG / ĐỘ CAO KHUÔN MẶT ĐỂ CHUẨN HÓA KHOẢNG CÁCH ---
          const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
          const faceHeight = Math.abs(chin.y - forehead.y);

          // --- 3. TÍNH GÓC QUAY ĐẦU THUẦN TÚY (RELATIVE ROTATION) ---
          const rotX = (noseTip.x - faceCenterX) / (faceWidth || 1);
          const rotY = (noseTip.y - faceCenterY) / (faceHeight || 1);

          // --- 4. GÁN TỌA ĐỘ TƯƠNG ĐỐI VÀO LATEST RAW REF ---
          latestRawRef.current = { x: rotX, y: rotY };
          mouthGapRawRef.current = Math.sqrt(Math.pow(topLip.x - bottomLip.x, 2) + Math.pow(topLip.y - bottomLip.y, 2));
          latestFaceSizeRef.current = { width: currentW };

          if (stepRef.current === 'calibrating') {
            const pi = pointIndexRef.current;
            ctx.fillStyle = '#2dd4bf'; // lip landmarks
            [topLip, bottomLip].forEach(pt => {
              ctx.beginPath();
              ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 6, 0, 2 * Math.PI);
              ctx.fill();
            });
            if (pi !== 0) {
              ctx.fillStyle = '#ff7700'; // nose landmark
              ctx.beginPath();
              ctx.arc(noseTip.x * canvas.width, noseTip.y * canvas.height, 8, 0, 2 * Math.PI);
              ctx.fill();
            }
            ctx.fillStyle = '#06b6d4'; // face boundary landmarks
            [forehead, chin, leftCheek, rightCheek].forEach(pt => {
              ctx.beginPath();
              ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 5, 0, 2 * Math.PI);
              ctx.fill();
            });
          }
        }
        ctx.restore();
      });

      const cameraInstance = new Camera(videoElement, {
        onFrame: async () => {
          if (videoElement.readyState >= 2 && faceMeshRef.current === faceMesh) {
            try {
              await faceMesh.send({ image: videoElement });
            } catch {
              console.warn(
                '[AI-Tracker-Log] Warning: FaceMesh send() failed. Possibly due to camera not ready or frame skipped.',
              );
            }
          }
        },
        width: 640,
        height: 480,
      });

      await cameraInstance.start();

      faceMeshRef.current = faceMesh;
      cameraRef.current = cameraInstance;

      setEyeTrackingEnabled(true);
      setIntroCountdown(3);
      setStep('countdown');
    } catch (err) {
      console.error('[AI-Tracker-Log] Failed to open Camera:', err);
      alert('Ứng dụng cần quyền truy cập Camera để có thể tiếp tục nhận diện khuôn mặt!');
    }
  };

  const saveCalibration = useCallback(async () => {
    const finalData = {
      bounds: boundsRef.current,
      preferences: prefRef.current,
    };

    if (!isLoggedIn) {
      return;
    }
    try {
      // 1. Gọi API lưu lên server và lấy kết quả trả về
      const updatedData = await profileApi.updateCalibration(finalData);

      // 2. NẠP DỮ LIỆU VÀO CONTEXT NGAY LẬP TỨC
      setCalibration(updatedData);

      console.log('[AI-Tracker-Log] Successfully update to database.');
    } catch (err) {
      console.error('[AI-Tracker-Log] Error connecting to API Server:', err);
    }
  }, [isLoggedIn, setCalibration]); // ---> Nhớ thêm setCalibration vào mảng dependency

  const cancelCalibration = () => {
    stopCamera();
    setStep('intro');
  };

  // Countdown number before starting calibration
  useEffect(() => {
    if (step !== 'countdown') return;
    const timer = window.setInterval(() => {
      setIntroCountdown(prev => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setStep('calibrating');
          setPointIndex(0);
          setDwellProgress(0);
          setCompletedPoints([]);
          setIsCapturing(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  // Loading circle
  useEffect(() => {
    if (step !== 'calibrating' || isCapturing) return;

    let startTime: number | null = null;
    let animationFrameId: number;
    const duration = 3000;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setDwellProgress(progress);

      if (progress < 100) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setIsCapturing(true);

        const currentX = latestRawRef.current.x;
        const currentY = latestRawRef.current.y;
        const currentMouth = mouthGapRawRef.current;

        mouthSamplesRef.current.push(currentMouth);
        if (pointIndex === 0) {
          boundsRef.current.center = { x: currentX, y: currentY };
          boundsRef.current.refWidth = latestFaceSizeRef.current.width;
          boundsRef.current.refFacePos = { x: latestFaceCenterRef.current.x, y: latestFaceCenterRef.current.y };
        }
        if (pointIndex === 1) {
          boundsRef.current.top = { x: currentX, y: currentY };
        }
        if (pointIndex === 2) {
          boundsRef.current.right = { x: currentX, y: currentY };
        }
        if (pointIndex === 3) {
          boundsRef.current.bottom = { x: currentX, y: currentY };
        }
        if (pointIndex === 4) {
          boundsRef.current.left = { x: currentX, y: currentY };
        }

        if (mouthSamplesRef.current.length > 0) {
          prefRef.current.mouthDragThreshold = Math.min(...mouthSamplesRef.current);
        }

        window.setTimeout(() => {
          setCompletedPoints(prev => {
            const nextList = !prev.includes(pointIndex) ? [...prev, pointIndex] : prev;
            return nextList;
          });

          if (pointIndex < CAL_POINTS.length - 1) {
            const nextIdx = pointIndex + 1;
            setPointIndex(nextIdx);
            setDwellProgress(0);
            setIsCapturing(false);
          } else {
            window.setTimeout(() => {
              void saveCalibration();
              stopCamera();
              setStep('success');
            }, 1000);
          }
        }, 500);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [step, pointIndex, isCapturing, saveCalibration, stopCamera]);

  const captured = completedPoints.includes(pointIndex);

  return (
    <PageScale scale={0.75} className="calibration-page">
      <style>{`
        .hide-global-mouse-tracking [class*="mouse"],
        .hide-global-mouse-tracking [id*="mouse"],
        .hide-global-mouse-tracking .mouse-pointer,
        .hide-global-mouse-tracking div[style*="position: fixed"] {
          pointer-events: none !important; display: none !important; opacity: 0 !important; visibility: hidden !important;
        }
      `}</style>

      {/* ĐẶT THỂ VIDEO TOÀN CỤC Ở ĐÂY ĐỂ TRÁNH BỊ UNMOUNT KHI CHUYỂN STEP */}
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />

      {/* STEP 1: INTRO */}
      {step === 'intro' && (
        <>
          <header className="login-header container">
            <Link to="/home" className="login-back group">
              <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
              <span>{getSafeTranslation('nav.back', 'Quay lại')}</span>
            </Link>
            <Link to="/" className="login-logo-link">
              <img src="/logo/TD_App_Logo.png" alt="Logo" className="login-logo" />
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button type="button" className="calibration-primary-btn group" onClick={startCalibration}>
                  <Crosshair size={32} strokeWidth={3} className="btn-icon calibration-crosshair-icon" />
                  {t('calibration.begin')}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/lessons')}
                  className="calibration-primary-btn group"
                  style={{ background: '#E53A36' }}
                >
                  <CircleX size={32} strokeWidth={3} className="btn-icon" />
                  {t('calibration.cancel')}
                </button>
              </div>
            </section>
          </main>
        </>
      )}

      {/* STEP 2: COUNTDOWN */}
      {step === 'countdown' && (
        <div
          className="calibration-active"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '80vh',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '60vmin',
              height: '60vmin',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '6px solid #ff7700',
            }}
          >
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
            >
              <span style={{ fontSize: '10rem', fontWeight: '900', color: '#fff' }}>{introCountdown}</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CALIBRATING */}
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
            <button type="button" className="calibration-cancel-btn" onClick={cancelCalibration}>
              Hủy
            </button>
          </div>

          <p className="calibration-instruction">{getInstructionText()}</p>

          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '60vmin',
              height: '60vmin',
            }}
          >
            <svg
              viewBox="0 0 100 100"
              style={{ position: 'absolute', width: '108%', height: '108%', pointerEvents: 'none', zIndex: 11 }}
            >
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="#ff7700"
                strokeWidth="2"
                strokeDasharray={2 * Math.PI * 46}
                strokeDashoffset={2 * Math.PI * 46 * (1 - dwellProgress / 100)}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'none' }}
              />
            </svg>

            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '4px solid #2d3748',
                backgroundColor: '#1a202c',
              }}
            >
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>

          {CAL_POINTS.map((point, index) => {
            if (point.isMouth) return null;

            if (completedPoints.includes(index)) {
              return (
                <div
                  key={`done-${index}`}
                  className="calibration-point calibration-point--done"
                  style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div className="calibration-point-done-dot">
                    <CheckCircle size={20} strokeWidth={3} />
                  </div>
                </div>
              );
            }

            if (!captured && index === pointIndex) {
              return (
                <div
                  key={`active-${index}`}
                  className="calibration-point calibration-point--active"
                  style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div className="calibration-point-pulse" style={{ backgroundColor: 'rgba(255, 119, 0, 0.3)' }} />
                  <div
                    className="calibration-point-core"
                    style={{ backgroundColor: '#ff7700', width: '5vmin', height: '5vmin' }}
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* STEP 4: SUCCESS */}
      {step === 'success' && (
        <>
          <header className="login-header container calibration-success-header">
            <div className="calibration-header-spacer" />
            <Link to="/" className="login-logo-link">
              <img src="/logo/TD_App_Logo.png" alt="Logo" className="login-logo" />
            </Link>
          </header>

          <main className="calibration-main container">
            <section className="calibration-card calibration-card--success">
              <div className="calibration-success-icon">
                <CheckCircle size={96} strokeWidth={2} />
              </div>
              <div className="calibration-intro">
                <h1>{getSafeTranslation('calibration.completeTitle', 'Cân chỉnh thành công!')}</h1>
                <p>
                  {getSafeTranslation(
                    'calibration.completeBody',
                    'Hệ thống đã đồng bộ hóa chính xác ánh mắt và các landmark cơ mặt của bạn.',
                  )}
                </p>
              </div>

              <div className="calibration-actions">
                <button type="button" className="calibration-secondary-btn group" onClick={startCalibration}>
                  <RefreshCw size={28} strokeWidth={3} className="btn-icon calibration-refresh-icon" />
                  {getSafeTranslation('calibration.recalibrate', 'Cân chỉnh lại')}
                </button>
                <Link to="/lessons" className="calibration-primary-btn group calibration-primary-btn--compact">
                  {getSafeTranslation('calibration.startCoding', 'Bắt đầu học')}
                  <ArrowRight size={28} strokeWidth={3} className="btn-icon" />
                </Link>
              </div>
            </section>
          </main>
        </>
      )}
    </PageScale>
  );
}
