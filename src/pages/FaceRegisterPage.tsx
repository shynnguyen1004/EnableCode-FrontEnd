import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, RefreshCw, CheckCircle, ScanFace, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';
import PageScale from '../components/PageScale';
// import { profileApi } from '../api/profileApi';

export default function FaceRegisterPage() {
  const { t } = useI18n();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sửa Lỗi 1: Thêm số 0 làm giá trị khởi tạo cho useRef
  const animationFrameRef = useRef<number>(0);

  const getSafeTranslation = (key: string, fallbackText: string): string => {
    try {
      const val = t(key);
      if (!val || val === key || val.includes(key)) return fallbackText;
      return val;
    } catch {
      return fallbackText;
    }
  };

  // Sửa Lỗi 2: Dùng function thường (hoisting) để tránh lỗi 'accessed before declared'
  function drawToCanvas() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 640;
        canvas.height = 480;

        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        const size = Math.min(video.videoWidth, video.videoHeight);
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;

        ctx.drawImage(video, startX, startY, size, size, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }
    animationFrameRef.current = requestAnimationFrame(drawToCanvas);
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraReady(true);
      animationFrameRef.current = requestAnimationFrame(drawToCanvas);
    } catch (error) {
      console.error('Không thể truy cập camera:', error);
      alert('Vui lòng cấp quyền camera để thiết lập đăng nhập bằng khuôn mặt!');
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraReady(false);
  };

  // Sửa Lỗi 3: Bỏ setState đồng bộ (synchronous) khởi tạo khỏi useEffect
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageUrl);
    }
  };

  // Chuyển việc xóa ảnh (setCapturedImage(null)) sang sự kiện chủ động từ người dùng
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleSaveFace = async () => {
    if (!capturedImage) return;

    setIsSaving(true);
    try {
      // await profileApi.registerFace({ imageBase64: capturedImage });
      console.log('Đã lưu ảnh khuôn mặt thành công!', capturedImage.substring(0, 50) + '...');
      navigate('/settings');
    } catch (error) {
      console.error('Lỗi khi lưu khuôn mặt:', error);
      alert('Có lỗi xảy ra khi lưu khuôn mặt. Vui lòng thử lại!');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoggedIn) {
    navigate('/login');
    return null;
  }

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
                'Hãy nhìn thẳng vào camera và đảm bảo khuôn mặt nằm gọn trong khung hình.',
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
                }}
              >
                <Loader2 size={48} className="animate-spin" style={{ marginBottom: '1rem' }} />
                <span style={{ fontWeight: 800 }}>Đang mở Camera...</span>
              </div>
            )}
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                style={{ width: '100%', opacity: isCameraReady ? 1 : 0.5, fontSize: '1.4rem', maxHeight: '64x' }}
              >
                <Camera size={48} strokeWidth={3} className="btn-icon" />
                {getSafeTranslation('faceRegister.capture', 'Chụp khuôn mặt')}
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
                  {isSaving ? 'Đang lưu...' : getSafeTranslation('faceRegister.save', 'Xác nhận')}
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    </PageScale>
  );
}
