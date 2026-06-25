import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, RefreshCw, LogIn, ScanFace, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';

import PageScale from '../components/PageScale';
// import { authApi } from '../api/authApi';

import { isAxiosError } from 'axios';

export default function FaceLoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const { isLoggedIn } = useAuth();

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  // Điều hướng người dùng đã đăng nhập đi nơi khác
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/lessons');
    }
  }, [isLoggedIn, navigate]);

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
    setErrorMsg('');
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
      setErrorMsg('Vui lòng cấp quyền camera để đăng nhập bằng khuôn mặt!');
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
      // Xóa lỗi cũ nếu có khi người dùng thử chụp lại
      setErrorMsg('');
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  // Logic Đăng nhập tương tự LoginPage
  const handleFaceLogin = async () => {
    if (!capturedImage) return;

    setIsLoggingIn(true);
    setErrorMsg('');

    try {
      // TODO: Cần có endpoint /auth/face-login phía Backend và thêm hàm faceLogin vào authApi.ts
      // const response = await authApi.faceLogin({ imageBase64: capturedImage });

      /* GIẢ LẬP GỌI API (Bỏ comment khi có API thật)
      const { accessToken, user } = response;
      if (accessToken && user) {
        login(accessToken, user as unknown as UserProfileResponse);

        try {
          const calibrationData = await profileApi.getCalibration();
          setCalibration(calibrationData);
          navigate('/lessons');
        } catch {
          navigate('/calibration');
        }
      }
      */

      // Tạm thời ném lỗi để kiểm thử UI khi API chưa hoàn thiện
      console.log('Base64 gửi đi:', capturedImage.substring(0, 30) + '...');
      throw new Error('Tính năng Đăng nhập khuôn mặt (API) đang được phát triển.');
    } catch (error) {
      console.error('Lỗi khi đăng nhập bằng khuôn mặt:', error);

      if (isAxiosError(error)) {
        const backendMessage = error.response?.data?.error?.message;
        setErrorMsg(backendMessage || 'Không nhận diện được khuôn mặt. Vui lòng thử lại.');
      } else if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Đã có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <PageScale scale={0.75} className="calibration-page">
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />

      <header className="login-header container">
        <button
          onClick={() => navigate('/login')}
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
            <h1>{getSafeTranslation('faceLogin.title', 'Đăng nhập Face ID')}</h1>
            <p>
              {getSafeTranslation(
                'faceLogin.subtitle',
                'Nhìn thẳng vào camera để hệ thống nhận diện và đăng nhập vào tài khoản của bạn.',
              )}
            </p>
          </div>

          {errorMsg && (
            <div
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(229, 58, 54, 0.1)',
                border: '1px solid #E53A36',
                color: '#E53A36',
                textAlign: 'center',
                fontWeight: '600',
              }}
            >
              {errorMsg}
            </div>
          )}

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
                style={{ width: '100%', opacity: isCameraReady ? 1 : 0.5, fontSize: '1.4rem', maxHeight: '64px' }}
              >
                <Camera size={48} strokeWidth={3} className="btn-icon" />
                {getSafeTranslation('faceLogin.capture', 'Chụp khuôn mặt')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="calibration-secondary-btn group"
                  onClick={handleRetake}
                  disabled={isLoggingIn}
                  style={{ flex: 1 }}
                >
                  <RefreshCw size={28} strokeWidth={3} className="btn-icon calibration-refresh-icon" />
                  {getSafeTranslation('faceLogin.retake', 'Chụp lại')}
                </button>
                <button
                  type="button"
                  className="calibration-primary-btn group"
                  onClick={handleFaceLogin}
                  disabled={isLoggingIn}
                  style={{ flex: 1, background: '#74A258', borderColor: '#FFF9DC' }}
                >
                  {isLoggingIn ? (
                    <Loader2 size={28} className="animate-spin" />
                  ) : (
                    <LogIn size={28} strokeWidth={3} className="btn-icon" />
                  )}
                  {isLoggingIn ? 'Đang xử lý...' : getSafeTranslation('faceLogin.login', 'Đăng nhập')}
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    </PageScale>
  );
}
