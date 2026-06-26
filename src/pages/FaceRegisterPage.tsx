import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, RefreshCw, CheckCircle, ScanFace, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import PageScale from '../components/PageScale';
import { authApi } from '../api/authApi';
import type { FaceMeshResults, FaceMeshType, CameraType } from '../lib/types';

// Khai báo kiểu dữ liệu Window đồng bộ theo chuẩn hệ thống
declare global {
  interface Window {
    FaceMesh: new (config: { locateFile: (file: string) => string }) => FaceMeshType;
    Camera: new (
      video: HTMLVideoElement,
      options: { onFrame: () => Promise<void>; width: number; height: number },
    ) => CameraType;
  }
}

export default function FaceRegisterPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const faceMeshRef = useRef<FaceMeshType | null>(null);
  const cameraRef = useRef<CameraType | null>(null);
  const mouthOpenStartRef = useRef<number | null>(null);

  const getSafeTranslation = (key: string, fallbackText: string): string => {
    try {
      const val = t(key);
      if (!val || val === key || val.includes(key)) return fallbackText;
      return val;
    } catch {
      return fallbackText;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initFaceMeshAndCamera = async () => {
      try {
        const { FaceMesh, Camera } = window;
        if (!FaceMesh || !Camera) {
          console.warn('MediaPipe FaceMesh hoặc Camera chưa sẵn sàng trên đối tượng window.');
          return;
        }

        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;
        if (!videoElement || !canvasElement) return;

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
          if (!isMounted) return;

          const canvas = canvasRef.current;
          const video = videoRef.current;
          if (!canvas || !video || video.readyState < 2) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          canvas.width = 640;
          canvas.height = 480;

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);

          // FIX ESLINT: Lấy kích thước chuẩn tuyệt đối từ luồng Video gốc thay vì results.image
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          if (vw > 0 && vh > 0) {
            const size = Math.min(vw, vh);
            const startX = (vw - size) / 2;
            const startY = (vh - size) / 2;

            // Vẽ ảnh sạch, không chứa bất kỳ đường line landmark nào lên giao diện
            ctx.drawImage(results.image, startX, startY, size, size, 0, 0, canvas.width, canvas.height);
          }
          ctx.restore();

          // LOGIC XỬ LÝ HÁ MIỆNG NGẦM (LIVENESS DETECTION)
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            const topLip = landmarks[13]; // Tâm môi trên
            const bottomLip = landmarks[14]; // Tâm môi dưới
            const leftCorner = landmarks[78]; // Khóe môi trái
            const rightCorner = landmarks[308]; // Khóe môi phải

            if (topLip && bottomLip && leftCorner && rightCorner) {
              const mouthHeight = Math.sqrt(Math.pow(topLip.x - bottomLip.x, 2) + Math.pow(topLip.y - bottomLip.y, 2));
              const mouthWidth = Math.sqrt(
                Math.pow(leftCorner.x - rightCorner.x, 2) + Math.pow(leftCorner.y - rightCorner.y, 2),
              );

              const mar = mouthWidth !== 0 ? mouthHeight / mouthWidth : 0;
              const MOUTH_OPEN_THRESHOLD = 0.03;

              if (mar > MOUTH_OPEN_THRESHOLD) {
                if (mouthOpenStartRef.current === null) {
                  mouthOpenStartRef.current = performance.now();
                }

                const elapsed = (performance.now() - mouthOpenStartRef.current) / 1000;
                const remaining = Math.max(0, 1 - elapsed);
                setCountdown(Math.ceil(remaining));

                if (remaining <= 0) {
                  // Đủ 1 giây liên tục -> Chụp tự động thành công!
                  mouthOpenStartRef.current = null;
                  setCountdown(null);

                  const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
                  setCapturedImage(imageUrl);

                  if (cameraRef.current) {
                    try {
                      cameraRef.current.stop();
                    } catch (e) {
                      console.error(e);
                    }
                  }
                }
              } else {
                // Khách hàng khép miệng lại -> Huỷ ngay bộ đếm thời gian
                mouthOpenStartRef.current = null;
                setCountdown(null);
              }
            }
          } else {
            // Không thấy mặt trong khung hình -> Reset
            mouthOpenStartRef.current = null;
            setCountdown(null);
          }
        });

        const cameraInstance = new Camera(videoElement, {
          onFrame: async () => {
            if (videoElement.readyState >= 2 && faceMeshRef.current === faceMesh) {
              try {
                await faceMesh.send({ image: videoElement });
              } catch {
                // Bỏ qua log cảnh báo skip frame để tránh spam console
              }
            }
          },
          width: 640,
          height: 480,
        });

        await cameraInstance.start();

        if (isMounted) {
          faceMeshRef.current = faceMesh;
          cameraRef.current = cameraInstance;
          setIsCameraReady(true);
        } else {
          cameraInstance.stop();
          faceMesh.close();
        }
      } catch (err) {
        console.error('Lỗi khởi động MediaPipe Camera:', err);
      }
    };

    void initFaceMeshAndCamera();

    return () => {
      isMounted = false;
      setIsCameraReady(false);
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.error(e);
        }
        cameraRef.current = null;
      }
      if (faceMeshRef.current) {
        try {
          faceMeshRef.current.close();
        } catch (e) {
          console.error(e);
        }
        faceMeshRef.current = null;
      }
    };
  }, []);

  const handleCapture = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
      mouthOpenStartRef.current = null;
      setCountdown(null);
      const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageUrl);
    }
  };

  const handleRetake = async () => {
    setCapturedImage(null);
    mouthOpenStartRef.current = null;
    setCountdown(null);

    if (cameraRef.current) {
      try {
        await cameraRef.current.start();
      } catch (err) {
        console.error('Không thể kích hoạt lại Camera:', err);
      }
    }
  };

  const handleSaveFace = async () => {
    if (!capturedImage) return;

    setIsSaving(true);
    try {
      await authApi.saveFaceEmbedding(capturedImage);
      navigate('/settings');
    } catch (error) {
      console.error('Lỗi khi lưu khuôn mặt:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageScale scale={0.75} className="calibration-page">
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />

      <header className="login-header container">
        <button
          onClick={() => navigate(-1)}
          className="login-back group"
          style={{ background: 'transparent', border: 'none', color: '#FFF9DC', cursor: 'pointer' }}
        >
          <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
          <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{getSafeTranslation('nav.back', 'Quay lại')}</span>
        </button>
        <Link to="/" className="login-logo-link">
          <img src="/logo/TD_App_Logo.png" alt="Logo" className="login-logo" />
        </Link>
      </header>

      <main className="calibration-main container" style={{ paddingBottom: '4rem' }}>
        <section
          className="calibration-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}
        >
          <div className="calibration-intro" style={{ textAlign: 'center' }}>
            <ScanFace size={52} strokeWidth={2.5} color="#ff7700" style={{ marginBottom: '1rem' }} />
            <h1>{getSafeTranslation('faceRegister.title', 'Thiết lập Face Login')}</h1>
            <p>
              {getSafeTranslation(
                'faceRegister.subtitle',
                'Hãy há miệng to và giữ nguyên trong 3 giây để hệ thống tự động chụp ảnh khuôn mặt.',
              )}
            </p>
          </div>

          <div
            style={{
              position: 'relative',
              width: '50vmin',
              height: '50vmin',
              borderRadius: '50%',
              overflow: 'hidden',
              border: `6px solid ${capturedImage ? '#74A258' : '#ff7700'}`,
              boxShadow: `0 0 30px ${capturedImage ? 'rgba(116, 162, 88, 0.4)' : 'rgba(255, 119, 0, 0.4)'}`,
              backgroundColor: '#1a202c',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {!isCameraReady && !capturedImage && (
              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: '#ff7700',
                  zIndex: 5,
                }}
              >
                <Loader2 size={48} className="animate-spin" style={{ marginBottom: '1rem' }} />
                <span style={{ fontWeight: 800 }}>Đang mở Camera...</span>
              </div>
            )}

            {countdown !== null && !capturedImage && (
              <div
                style={{
                  position: 'absolute',
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: '#ff7700',
                  padding: '10px 22px',
                  borderRadius: '24px',
                  fontWeight: 900,
                  fontSize: '1.4rem',
                  zIndex: 10,
                  boxShadow: '0 0 15px rgba(255, 119, 0, 0.4)',
                  pointerEvents: 'none',
                }}
              >
                Giữ há miệng: {countdown}s
              </div>
            )}

            {capturedImage ? (
              <img src={capturedImage} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginTop: '1rem',
              width: '100%',
              maxWidth: '540px',
              maxHeight: '80px',
            }}
          >
            {!capturedImage ? (
              <button
                type="button"
                className="calibration-primary-btn group"
                onClick={handleCapture}
                disabled={!isCameraReady}
                style={{ width: '100%', opacity: isCameraReady ? 1 : 0.5, fontSize: '1.4rem', maxHeight: '64px' }}
              >
                <Camera size={48} strokeWidth={3} className="btn-icon" />
                {getSafeTranslation('faceRegister.capture', 'Chụp thủ công')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="calibration-secondary-btn group"
                  onClick={handleRetake}
                  disabled={isSaving}
                  style={{ flex: 1 }}
                >
                  <RefreshCw size={28} strokeWidth={3} className="btn-icon calibration-refresh-icon" />
                  {getSafeTranslation('faceRegister.retake', 'Chụp lại')}
                </button>
                <button
                  type="button"
                  className="calibration-primary-btn group"
                  onClick={handleSaveFace}
                  disabled={isSaving}
                  style={{ flex: 1, background: '#74A258', borderColor: '#FFF9DC' }}
                >
                  {isSaving ? (
                    <Loader2 size={28} className="animate-spin" />
                  ) : (
                    <CheckCircle size={28} strokeWidth={3} className="btn-icon" />
                  )}
                  {isSaving ? 'Đang xử lý...' : getSafeTranslation('faceRegister.save', 'Xác nhận')}
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    </PageScale>
  );
}
