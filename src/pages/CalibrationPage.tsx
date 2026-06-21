import { useCallback, useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ArrowLeft, CheckCircle, RefreshCw, Crosshair, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';
import { useEyeTracking } from '../context/EyeTrackingContext';
import { calibrationApi } from '../api/calibrationApi';
import PageScale from '../components/PageScale';
import type {
  FaceMeshResults,
  FaceMeshType,
  CameraType,
  CalibrationBounds,
  CalibrationPreferences,
  UpdateCalibrationRequest,
} from '../lib/types';

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

  const latestRawRef = useRef({ x: 0.5, y: 0.5 });
  const mouthGapRawRef = useRef(0);

  // Cập nhật Type và khởi tạo giá trị theo đúng cấu trúc Interface của team
  const boundsRef = useRef<CalibrationBounds>({
    leftX: 0,
    rightX: 0,
    topY: 0,
    bottomY: 0,
  });

  const prefRef = useRef<CalibrationPreferences>({
    mouthDragThreshold: 0,
    trackingSensitivity: 0,
    visualFeedback: true,
  });

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
    if (completedPoints.includes(pointIndex)) return getSafeTranslation('calibration.captured', 'Position captured!');
    if (pointIndex === 0) return getSafeTranslation('calibration.mouthOpen', 'Slightly open your mouth');
    const edgeKeys = ['calibration.holdTop', 'calibration.holdRight', 'calibration.holdBottom', 'calibration.holdLeft'];
    const defaultTexts = [
      'Move your head to the top side of your screen',
      'Move your head to the right side of your screen',
      'Move your head to the bottom side of your screen',
      'Move your head to the left side of your screen',
    ];
    return getSafeTranslation(edgeKeys[pointIndex - 1], defaultTexts[pointIndex - 1]);
  };

  useEffect(() => {
    const shouldHideMouse = step === 'countdown' || step === 'calibrating';
    if (shouldHideMouse) document.body.classList.add('hide-global-mouse-tracking');
    else document.body.classList.remove('hide-global-mouse-tracking');
    return () => document.body.classList.remove('hide-global-mouse-tracking');
  }, [step]);

  // FIX LỖI CRASH TO_LOWER_CASE TỪ CONTEXT BÊN NGOÀI
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (stepRef.current === 'countdown' || stepRef.current === 'calibrating') {
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true); // Đăng ký ở Capture phase để chặn sớm nhất
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (e) {
        console.error('[AI-Tracker-Log] Lỗi đóng camera instance:', e);
      }
      cameraRef.current = null;
    }
    if (faceMeshRef.current) {
      const instance = faceMeshRef.current;
      faceMeshRef.current = null;
      try {
        instance.close();
        console.log('[AI-Tracker-Log] -> Đã giải phóng hoàn toàn bộ nhớ FaceMesh WASM.');
      } catch (e) {
        console.error('[AI-Tracker-Log] Lỗi đóng FaceMesh:', e);
      }
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCalibration = async () => {
    console.log('[AI-Tracker-Log] 🎬 Kích hoạt nút Bắt đầu Cân chỉnh.');
    try {
      const { FaceMesh, Camera } = window;
      if (!FaceMesh || !Camera) {
        console.warn('[AI-Tracker-Log] Thư viện MediaPipe chưa sẵn sàng trên đối tượng window.');
        alert('Chưa tải xong thư viện AI. Vui lòng đợi vài giây và thử lại.');
        return;
      }

      const videoElement = videoRef.current;
      if (!videoElement) {
        console.error('[AI-Tracker-Log] Không tìm thấy phần tử HTML videoRef.');
        return;
      }

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
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

        // Lật ảnh đối xứng gương (Mirror Effect) chuẩn xác
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const landmarks = results.multiFaceLandmarks[0];
          const noseTip = landmarks[1];
          const topLip = landmarks[13];
          const bottomLip = landmarks[14];

          // Cập nhật tọa độ thực từ camera vào Ref liên tục
          latestRawRef.current = { x: noseTip.x, y: noseTip.y };
          mouthGapRawRef.current = Math.sqrt(Math.pow(topLip.x - bottomLip.x, 2) + Math.pow(topLip.y - bottomLip.y, 2));

          // Vẽ điểm hỗ trợ trực quan hóa lên khung tròn
          if (stepRef.current === 'calibrating') {
            const pi = pointIndexRef.current;
            if (pi === 0) {
              ctx.fillStyle = '#2dd4bf'; // Điểm môi màu Xanh ngọc khi test há miệng
              [topLip, bottomLip].forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 6, 0, 2 * Math.PI);
                ctx.fill();
              });
            } else {
              ctx.fillStyle = '#ff7700'; // Điểm mũi màu Cam định vị ánh mắt
              ctx.beginPath();
              ctx.arc(noseTip.x * canvas.width, noseTip.y * canvas.height, 8, 0, 2 * Math.PI);
              ctx.fill();
            }
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
              console.warn('[AI-Tracker-Log] Đã chặn an toàn một frame gửi muộn khi FaceMesh đang giải phóng.');
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
      console.error('[AI-Tracker-Log] Thất bại khi mở Camera:', err);
      alert('Ứng dụng cần quyền truy cập Camera để có thể tiếp tục nhận diện khuôn mặt!');
    }
  };

  // Hàm lưu dữ liệu cân chỉnh và đồng bộ lên Database qua API
  const saveCalibration = useCallback(async () => {
    const finalData: UpdateCalibrationRequest = {
      bounds: boundsRef.current,
      preferences: prefRef.current,
    };

    console.log(JSON.stringify(finalData, null, 2));

    if (!isLoggedIn) {
      console.warn('[AI-Tracker-Log] Khách chưa đăng nhập hệ thống, dữ liệu chỉ lưu log local.');
      return;
    }
    try {
      console.log('[AI-Tracker-Log] Đang đẩy gói tin cấu hình lên API Server...');
      // Gọi API gửi request PUT để update dữ liệu cân chỉnh vào Database
      await calibrationApi.updateCalibration(finalData);
      console.log('[AI-Tracker-Log] 🎉 Máy chủ phản hồi thành công! Đã cập nhật DB.');
    } catch (err) {
      console.error('[AI-Tracker-Log] Lỗi kết nối API Server:', err);
    }
  }, [isLoggedIn]);

  const cancelCalibration = () => {
    console.log('[AI-Tracker-Log] Đã nhấn phím HỦY quy trình cân chỉnh.');
    stopCamera();
    setStep('intro');
  };

  // QUY TRÌNH ĐẾM NGƯỢC COUNTDOWN
  useEffect(() => {
    if (step !== 'countdown') return;
    console.log(`[AI-Tracker-Log] Đang ở màn hình chờ chuẩn bị. Giây đếm ngược: ${introCountdown}`);
    const timer = window.setInterval(() => {
      setIntroCountdown(prev => {
        if (prev <= 1) {
          window.clearInterval(timer);
          console.log("[AI-Tracker-Log] Đếm ngược kết thúc -> Chuyển sang bước quét điểm: 'calibrating'");
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

  // VÒNG LẶP TIẾN TRÌNH 2 GIÂY MƯỢT MÀ TỪ 0 ĐẾN 100%
  useEffect(() => {
    if (step !== 'calibrating' || isCapturing) return;

    console.log(`[AI-Tracker-Log] 📍 Khởi động đo đếm giữ điểm ổn định cho Point [Index: ${pointIndex}]`);
    let startTime: number | null = null;
    let animationFrameId: number;
    const duration = 2000;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);

      setDwellProgress(progress);

      if (progress < 100) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        console.log(`[AI-Tracker-Log] ✨ Point ${pointIndex} đạt đủ 100% (Giữ đủ 2 giây). Đang khóa dữ liệu...`);
        setIsCapturing(true);

        const currentX = latestRawRef.current.x;
        const currentY = latestRawRef.current.y;
        const currentMouth = mouthGapRawRef.current;

        if (pointIndex === 0) {
          prefRef.current.mouthDragThreshold = currentMouth * 0.8;
          console.log(`[AI-Tracker-Log] -> Đã chốt mouthThreshold hình thể: ${prefRef.current.mouthDragThreshold}`);
        }
        if (pointIndex === 1) {
          boundsRef.current.topY = currentY;
          console.log(`[AI-Tracker-Log] -> Đã chốt TopY biên trên: ${boundsRef.current.topY}`);
        }
        if (pointIndex === 2) {
          boundsRef.current.rightX = currentX;
          console.log(`[AI-Tracker-Log] -> Đã chốt RightX biên phải: ${boundsRef.current.rightX}`);
        }
        if (pointIndex === 3) {
          boundsRef.current.bottomY = currentY;
          console.log(`[AI-Tracker-Log] -> Đã chốt BottomY biên dưới: ${boundsRef.current.bottomY}`);
        }
        if (pointIndex === 4) {
          boundsRef.current.leftX = currentX;
          console.log(`[AI-Tracker-Log] -> Đã chốt LeftX biên trái: ${boundsRef.current.leftX}`);
        }

        window.setTimeout(() => {
          setCompletedPoints(prev => {
            const nextList = !prev.includes(pointIndex) ? [...prev, pointIndex] : prev;
            console.log(`[AI-Tracker-Log] Tập hợp các điểm đã xong: [${nextList.join(', ')}]`);
            return nextList;
          });

          if (pointIndex < CAL_POINTS.length - 1) {
            const nextIdx = pointIndex + 1;
            console.log(`[AI-Tracker-Log] Chuyển tiếp sang điểm tiếp theo: Index ${nextIdx}`);
            setPointIndex(nextIdx);
            setDwellProgress(0);
            setIsCapturing(false);
          } else {
            console.log('[AI-Tracker-Log] 🏁 Đã hoàn thành thu thập toàn bộ các mốc tọa độ.');
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

      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />

      {/* STEP 1: INTRO */}
      {step === 'intro' && (
        <>
          <header className="login-header container">
            <Link to="/settings" className="login-back group">
              <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
              <span>{getSafeTranslation('nav.back', 'Quay lại')}</span>
            </Link>
          </header>

          <main className="calibration-main container">
            <section className="calibration-card">
              <div className="calibration-hero-icon">
                <Eye size={80} strokeWidth={2} />
              </div>
              <div className="calibration-intro">
                <h1>{getSafeTranslation('calibration.title', 'Cân chỉnh Eye-Tracking')}</h1>
                <p>Thực hiện các bước sau để thiết lập giới hạn khuôn mặt</p>
              </div>
              <button type="button" className="calibration-primary-btn group" onClick={startCalibration}>
                <Crosshair size={32} strokeWidth={3} className="btn-icon calibration-crosshair-icon" /> Bắt đầu
              </button>
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
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1a202c', marginBottom: '1rem' }}>
            Sẵn sàng...
          </h1>
          <div
            style={{
              position: 'relative',
              width: '280px',
              height: '280px',
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

          <p className="calibration-instruction" style={{ color: '#e65c00', fontWeight: 'bold', fontSize: '1.5rem' }}>
            {getInstructionText()}
          </p>

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
              width: '50vmin',
              height: '50vmin',
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
                strokeWidth="3"
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
                    <CheckCircle size={40} strokeWidth={3} />
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
