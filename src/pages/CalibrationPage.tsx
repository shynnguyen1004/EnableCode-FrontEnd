import { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, ArrowLeft, CheckCircle, Target, RefreshCw, Crosshair, ArrowRight, CircleX } from 'lucide-react';
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';
import { useEyeTracking } from '../context/EyeTrackingContext';
import { useCalibration } from '../context/CalibrationContext';
import { profileApi } from '../api/profileApi';
import PageScale from '../components/PageScale';

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
  const { calibration, setCalibration } = useCalibration();

  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('intro');
  const [pointIndex, setPointIndex] = useState(0);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [completedPoints, setCompletedPoints] = useState<number[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [introCountdown, setIntroCountdown] = useState(3);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);

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
  // Khoảng cách trán-cằm ĐO LIÊN TỤC mỗi frame, nhưng CHỈ cập nhật khi miệng đang gần như ngậm
  // (mouthGap dưới ngưỡng nhỏ) -> giữ giá trị "trạng thái nghỉ" gần nhất trước khi user há miệng ở
  // điểm calib pointIndex 0. Dùng để so sánh với lúc há miệng, suy ra hệ số bù cá nhân hóa.
  const chinForeheadHeightBaselineRef = useRef(0);
  const chinForeheadHeightRawRef = useRef(0);
  const faceWidthAtCaptureRef = useRef(1); // faceWidth thô mỗi frame, dùng quy đổi đơn vị khi tính hệ số bù

  const boundsRef = useRef({
    center: { x: 0, y: 0 },
    top: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    bottom: { x: 0, y: 0 },
    left: { x: 0, y: 0 },
  });
  const prefRef = useRef({ mouthDragThreshold: 0.03, speed: 1, mouthCompensationRatio: 0.3 });
  const mouthSamplesRef = useRef<number[]>([]); // lưu threshold đo được ở từng điểm calib

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
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (faceLandmarkerRef.current) {
      const instance = faceLandmarkerRef.current;
      faceLandmarkerRef.current = null;
      try {
        void instance.close();
      } catch {
        console.error('[AI-Tracker-Log] Error closing FaceLandmarker instance');
      }
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCalibration = async () => {
    // Đồng bộ speed + mouthCompensationRatio hiện có từ DB, tránh ghi đè về mặc định khi lưu lại
    prefRef.current = {
      mouthDragThreshold: 0.03,
      speed: calibration?.preferences.speed ?? 0.7,
      mouthCompensationRatio: calibration?.preferences.mouthCompensationRatio ?? 0.3,
    };
    mouthSamplesRef.current = []; // reset mẫu đo threshold cho lần calibrate mới
    chinForeheadHeightBaselineRef.current = 0;
    chinForeheadHeightRawRef.current = 0;
    boundsRef.current = {
      center: { x: 0, y: 0 },
      top: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
      bottom: { x: 0, y: 0 },
      left: { x: 0, y: 0 },
    };

    // --- BƯỚC 1: TẮT CHUỘT ẢO ĐỂ TRẢ LẠI QUYỀN CAMERA TRƯỚC KHI BẮT ĐẦU ---
    setEyeTrackingEnabled(false);
    await new Promise(resolve => setTimeout(resolve, 300)); // Chờ nhả phần cứng

    try {
      const videoElement = videoRef.current;
      if (!videoElement) {
        console.error('[AI-Tracker-Log] Error: Video element not found.');
        return;
      }

      // Cấu hình FaceLandmarker giống hệt Mouse.tsx để hành vi đồng nhất
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.85,
        minFacePresenceConfidence: 0.85,
        minTrackingConfidence: 0.85,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 640 } },
        audio: false,
      });

      videoElement.srcObject = stream;
      await videoElement.play();

      faceLandmarkerRef.current = faceLandmarker;
      streamRef.current = stream;

      const processResult = (landmarks: NormalizedLandmark[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 640;
        canvas.height = 480;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, -canvas.width, 0, canvas.width, canvas.height);

        const noseTip = landmarks[4];
        const topLip = landmarks[13];
        const bottomLip = landmarks[14];
        const forehead = landmarks[10]; // Trán — điểm neo ổn định hình học
        const chin = landmarks[152]; // Cằm — dùng để đo hệ số bù mouth-compensation cá nhân hóa
        const leftCheek = landmarks[116]; // Má trái
        const rightCheek = landmarks[345]; // Má phải

        // Góc quay đầu tương đối, chuẩn hóa theo faceWidth/faceHeight — công thức khớp Mouse.tsx
        const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
        const upperFaceHeight = Math.abs((leftCheek.y + rightCheek.y) / 2 - forehead.y) || 1;
        const faceWidth = Math.abs(rightCheek.x - leftCheek.x) || 1;
        const faceHeight = upperFaceHeight * 2.5;
        const faceCenterY = forehead.y + upperFaceHeight * 1.25;

        const rotX = (noseTip.x - faceCenterX) / faceWidth;
        const rotY = (noseTip.y - faceCenterY) / faceHeight;
        latestRawRef.current = { x: rotX, y: rotY };

        // Chuẩn hóa theo faceWidth để khớp đơn vị với rawMouthGap lúc chạy thật ở Mouse.tsx
        mouthGapRawRef.current =
          Math.sqrt(Math.pow(topLip.x - bottomLip.x, 2) + Math.pow(topLip.y - bottomLip.y, 2)) / faceWidth;

        // Đo khoảng trán-cằm THÔ (đơn vị landmark, chưa chia faceWidth — khớp đơn vị rawChinForeheadHeight
        // trong Mouse.tsx) mỗi frame. Chỉ cập nhật baseline khi miệng đang gần ngậm (< 30% mouthDragThreshold
        // mặc định) để baseline luôn phản ánh đúng "trạng thái nghỉ", không bị lẫn lúc miệng đang há dở.
        chinForeheadHeightRawRef.current = Math.abs(chin.y - forehead.y) || 1;
        faceWidthAtCaptureRef.current = faceWidth;
        const MOUTH_NEAR_CLOSED_THRESHOLD = 0.01; // ngưỡng nhỏ, thấp hơn nhiều so với mouthDragThreshold mặc định 0.03
        if (mouthGapRawRef.current < MOUTH_NEAR_CLOSED_THRESHOLD) {
          chinForeheadHeightBaselineRef.current = chinForeheadHeightRawRef.current;
        }

        if (stepRef.current === 'calibrating') {
          const pi = pointIndexRef.current;
          const drawPoint = (pt: NormalizedLandmark, color: string, radius: number) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc((1 - pt.x) * -canvas.width, pt.y * canvas.height, radius, 0, 2 * Math.PI);
            ctx.fill();
          };
          // Màu landmark đồng bộ với Mouse.tsx: vàng=mũi, xanh dương=môi, xanh lá=má/trán
          [topLip, bottomLip].forEach(pt => drawPoint(pt, '#00aeff', 6));
          if (pi !== 0) drawPoint(noseTip, '#f2ff00', 8);
          [forehead, chin].forEach(pt => drawPoint(pt, '#ff00ea', 5));
          [leftCheek, rightCheek].forEach(pt => drawPoint(pt, '#66ff00', 5));
        }
        ctx.restore();
      };

      const renderLoop = () => {
        if (!faceLandmarkerRef.current) return;
        rafIdRef.current = requestAnimationFrame(renderLoop);
        if (videoElement.readyState < 2 || videoElement.currentTime === lastVideoTimeRef.current) return;
        lastVideoTimeRef.current = videoElement.currentTime;

        const results = faceLandmarkerRef.current.detectForVideo(videoElement, performance.now());
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          processResult(results.faceLandmarks[0]);
        }
      };
      rafIdRef.current = requestAnimationFrame(renderLoop);

      // ĐÃ XÓA LỆNH setEyeTrackingEnabled(true) Ở ĐÂY ĐỂ TRÁNH XUNG ĐỘT

      // Chỉ vào countdown SAU KHI camera + model đã thật sự sẵn sàng — tránh trường hợp countdown
      // chạy xong trước khi camera kịp bật (hoặc camera bật xong mà countdown đã kết thúc từ trước).
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
      const updatedData = await profileApi.updateCalibration(finalData);
      setCalibration(updatedData);
      console.log('[AI-Tracker-Log] Successfully update to database.');
    } catch (err) {
      console.error('[AI-Tracker-Log] Error connecting to API Server:', err);
    }
  }, [isLoggedIn, setCalibration]);

  const cancelCalibration = () => {
    stopCamera();
    setStep('intro');
    // --- BƯỚC 2: BẬT LẠI CHUỘT ẢO NẾU NGƯỜI DÙNG BẤM HỦY ---
    setEyeTrackingEnabled(true);
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

        // CHỈ lấy mouth-gap sample ở điểm calib có isMouth=true (pointIndex 0 — nơi người dùng THỰC SỰ há
        // miệng). Trước đây push ở MỌI điểm, kể cả 4 điểm quay đầu (isMouth=false, miệng vẫn đóng bình
        // thường) — do lấy Math.min() ở dưới, ngưỡng cuối cùng gần như luôn rơi vào giá trị đo lúc ĐÓNG
        // miệng ở 1 trong 4 điểm đó, nhỏ hơn nhiều so với lúc há miệng thật. Hệ quả: dễ trigger drag (chỉ
        // cần há hờ) nhưng cực khó trigger drop (ngưỡng drop = 50% ngưỡng này, còn nhỏ hơn nữa).
        if (CAL_POINTS[pointIndex]?.isMouth) {
          mouthSamplesRef.current.push(currentMouth);

          // Đo hệ số bù mouth-compensation CÁ NHÂN HÓA — thay cho hằng số hard-code, vì tỷ lệ dịch chuyển
          // cằm (xương) so với môi dưới (mô mềm) khác nhau giữa từng người. Công thức: phần trán-cằm đã
          // phình ra do há miệng (so với baseline lúc ngậm) chia cho chính mouth gap gây ra phần phình đó
          // -> ra đúng tỷ lệ 1 đơn vị mouth gap tương ứng bao nhiêu đơn vị phình trán-cằm của riêng user này.
          const chinForeheadHeightWhileOpen = chinForeheadHeightRawRef.current;
          const chinForeheadHeightAtRest = chinForeheadHeightBaselineRef.current;
          const heightIncreaseFromMouthOpen = chinForeheadHeightWhileOpen - chinForeheadHeightAtRest;
          // currentMouth đã normalize theo faceWidth -> quy đổi ngược về đơn vị landmark thô để khớp
          // đơn vị với heightIncreaseFromMouthOpen (đang tính trên chin.y/forehead.y thô).
          const currentMouthGapRawUnits = currentMouth * faceWidthAtCaptureRef.current;

          if (chinForeheadHeightAtRest > 0 && currentMouthGapRawUnits > 0.001) {
            const measuredRatio = heightIncreaseFromMouthOpen / currentMouthGapRawUnits;
            // Clamp về khoảng vật lý hợp lý [0, 1] — cằm không thể phình nhiều hơn hoặc ngược hướng mouth gap.
            prefRef.current.mouthCompensationRatio = Math.max(0, Math.min(1, measuredRatio));
          }
        }
        if (pointIndex === 0) {
          boundsRef.current.center = { x: currentX, y: currentY };
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
          const sorted = [...mouthSamplesRef.current].sort((a, b) => a - b);
          const trimmed = sorted.length > 2 ? sorted.slice(1) : sorted; // bỏ min nếu có đủ >= 3 mẫu
          prefRef.current.mouthDragThreshold = Math.min(...trimmed);
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

              // --- BƯỚC 3: BẬT LẠI CHUỘT ẢO SAU KHI CALIBRATION THÀNH CÔNG ---
              setEyeTrackingEnabled(true);
              setStep('success');
            }, 1000);
          }
        }, 500);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [step, pointIndex, isCapturing, saveCalibration, stopCamera, setEyeTrackingEnabled]);

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
