import React, { useEffect, useRef, useState } from 'react';

// ==========================================
// INTERFACES & GLOBAL INSTANCES
// ==========================================
interface FaceMeshInstance {
  setOptions(options: any): void;
  onResults(callback: (results: any) => void): void;
  send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
  close(): Promise<void>;
}

interface CameraInstance {
  start(): Promise<void>;
  stop(): void;
}

declare global {
  interface Window {
    FaceMesh: new (config?: { locateFile: (file: string) => string }) => FaceMeshInstance;
    Camera: new (video: HTMLVideoElement, options: any) => CameraInstance;
  }
}

let globalFaceMesh: FaceMeshInstance | null = null;
let globalCamera: CameraInstance | null = null;
let globalResultsCallback: ((results: any) => void) | null = null;

const Mouse: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<string>("Khởi tạo...");
  const [mouseAction, setMouseAction] = useState<string>("Đang di chuyển");
  const [fps, setFps] = useState<number>(0);

  const currentPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const smoothedRaw = useRef({ x: 0.5, y: 0.5 });
  const wasMouthOpenRef = useRef<boolean>(false);
  const mouthOpenTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  const lastHoveredEl = useRef<Element | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext('2d');
    if (!canvasCtx) return;

    const { FaceMesh, Camera } = window;
    if (!FaceMesh || !Camera) {
      setStatus("❌ Thiếu CDN MediaPipe");
      return;
    }

    globalResultsCallback = (results: any) => {
      const now = performance.now();
      
      // TARGET ~25 FPS (40ms interval)
      if (now - lastFrameTimeRef.current < 40) return;
      
      const currentFps = Math.round(1000 / (now - lastFrameTimeRef.current));
      lastFrameTimeRef.current = now;
      if (Math.random() > 0.8) setFps(currentFps);

      // 1. VẼ CAMERA (Mirror)
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.scale(-1, 1);
      canvasCtx.drawImage(results.image, -canvasElement.width, 0, canvasElement.width, canvasElement.height);
      
      // 2. VẼ LANDMARKS (Full Mesh)
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        
        // Vẽ toàn bộ các điểm dot nhỏ
        canvasCtx.fillStyle = "rgba(45, 212, 191, 0.7)"; // Màu xanh ngọc neon
        landmarks.forEach((pt: any) => {
          canvasCtx.beginPath();
          // Lật ngược tọa độ X vì đang ở chế độ mirror
          canvasCtx.arc((1 - pt.x) * -canvasElement.width, pt.y * canvasElement.height, 0.8, 0, 2 * Math.PI);
          canvasCtx.fill();
        });
        canvasCtx.restore();

        // --- CẤU HÌNH LOGIC ---
        const SENSITIVITY = { X: 0.3, Y: 0.25 }; 
        const MOUTH_OPEN_LIMIT = 0.025;
        const MOUTH_CLOSE_LIMIT = 0.018;
        const SCROLL_STEP = 50; // Tốc đố scroll
        const EDGE_THRESHOLD = 60; // Ngưỡng kích hoạt scroll khi chuột gần mép

        // 3. TÍNH TOÁN VỊ TRÍ CHUỘT
        const nose = landmarks[1];
        smoothedRaw.current.x += (nose.x - smoothedRaw.current.x) * 0.2;
        smoothedRaw.current.y += (nose.y - smoothedRaw.current.y) * 0.2;

        let tx = ((1 - smoothedRaw.current.x) - (0.5 - SENSITIVITY.X / 2)) / SENSITIVITY.X * window.innerWidth;
        let ty = (smoothedRaw.current.y - (0.5 - SENSITIVITY.Y / 2)) / SENSITIVITY.Y * window.innerHeight;
        
        currentPos.current = { 
            x: Math.max(0, Math.min(window.innerWidth, tx)), 
            y: Math.max(0, Math.min(window.innerHeight, ty)) 
        };

        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0)`;
        }

        // 4. XỬ LÝ HOVER (Nâng cấp sự kiện)
        const elAtPoint = document.elementFromPoint(currentPos.current.x, currentPos.current.y);
        
        if (elAtPoint !== lastHoveredEl.current) {
            // Rời khỏi phần tử cũ
            if (lastHoveredEl.current) {
                const outEvents = ['mouseleave', 'mouseout'];
                outEvents.forEach(evt => lastHoveredEl.current?.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true })));
            }
            // Đi vào phần tử mới
            if (elAtPoint) {
                const inEvents = ['mouseenter', 'mouseover', 'mousemove'];
                inEvents.forEach(evt => elAtPoint.dispatchEvent(new MouseEvent(evt, { 
                    bubbles: true, 
                    cancelable: true,
                    clientX: currentPos.current.x,
                    clientY: currentPos.current.y
                })));
            }
            lastHoveredEl.current = elAtPoint;
        } else if (elAtPoint) {
            // Duy trì di chuyển trên phần tử hiện tại để kích hoạt hover động
            elAtPoint.dispatchEvent(new MouseEvent('mousemove', { 
                bubbles: true, 
                clientX: currentPos.current.x, 
                clientY: currentPos.current.y 
            }));
        }

        // 5. CLICK & DRAG
        const mouthGap = Math.abs(landmarks[13].y - landmarks[14].y);
        const currentTime = Date.now();

        if (mouthGap > MOUTH_OPEN_LIMIT) {
          if (!wasMouthOpenRef.current) {
            mouthOpenTimeRef.current = currentTime;
            wasMouthOpenRef.current = true;
          } else if (currentTime - mouthOpenTimeRef.current > 450 && !isDraggingRef.current) {
            isDraggingRef.current = true;
            setMouseAction("Kéo vật thể (Drag)");
          }
        } else if (mouthGap < MOUTH_CLOSE_LIMIT && wasMouthOpenRef.current) {
          const duration = currentTime - mouthOpenTimeRef.current;
          wasMouthOpenRef.current = false;

          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            setMouseAction("Thả vật thể (Drop)");
            setTimeout(() => setMouseAction("Đang di chuyển"), 500);
          } else if (duration > 50 && duration < 350) {
            setMouseAction("💥 CLICK!");
            if (elAtPoint && elAtPoint instanceof HTMLElement && typeof elAtPoint.click === 'function') {
                elAtPoint.click();
            }
            setTimeout(() => setMouseAction("Đang di chuyển"), 500);
          }
        }

        // 6. SCROLLING (Sử dụng vận tốc cố định mới)
        if (currentPos.current.y < EDGE_THRESHOLD) {
          window.scrollBy(0, -SCROLL_STEP);
          setMouseAction("🔼 Cuộn lên");
        } else if (currentPos.current.y > window.innerHeight - EDGE_THRESHOLD) {
          window.scrollBy(0, SCROLL_STEP);
          setMouseAction("🔽 Cuộn xuống");
        } else if (mouseAction.includes("Cuộn")) {
          setMouseAction("Đang di chuyển");
        }
      } else {
        canvasCtx.restore();
      }
    };

    if (!globalFaceMesh) {
      globalFaceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });
      globalFaceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
      globalFaceMesh.onResults((res) => globalResultsCallback?.(res));
    }

    if (!globalCamera) {
      globalCamera = new Camera(videoElement, {
        onFrame: async () => {
          if (globalFaceMesh) await globalFaceMesh.send({ image: videoElement });
        },
        width: 320, height: 240
      });
      globalCamera.start().then(() => setStatus("AI Sẵn sàng"));
    }

    return () => { globalResultsCallback = null; };
  }, [mouseAction]);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      
      {/* CON TRỎ CHUỘT AI */}
      <div ref={cursorRef} style={{
        position: 'absolute', width: '26px', height: '26px',
        border: '3px solid #2dd4bf', borderRadius: '50%',
        boxShadow: isDraggingRef.current ? '0 0 25px #a855f7' : '0 0 15px rgba(45, 212, 191, 0.4)',
        backgroundColor: isDraggingRef.current ? '#a855f733' : 'rgba(45, 212, 191, 0.1)',
        transition: 'transform 0.04s linear', willChange: 'transform',
        left: '-13px', top: '-13px', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
         <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#2dd4bf' }} />
      </div>

      {/* WIDGET CAMERA */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        width: '260px', height: '180px',
        background: '#020617', borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)', border: '2px solid #1e293b',
        pointerEvents: 'auto'
      }}>
        <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
        <canvas ref={canvasRef} width="260" height="180" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* FPS & ACTION DISPLAY (Đồng bộ kích thước) */}
        <div style={{
          position: 'absolute', top: '10px', left: '10px',
          background: 'rgba(15, 23, 42, 0.8)', color: '#10b981', padding: '5px 10px',
          fontSize: '12px', borderRadius: '6px', fontWeight: 700,
          fontFamily: 'monospace', borderLeft: '4px solid #10b981', backdropFilter: 'blur(4px)'
        }}>
          FPS: {fps}
        </div>

        <div style={{
          position: 'absolute', bottom: '10px', right: '10px',
          background: 'rgba(15, 23, 42, 0.8)', color: '#f8fafc', padding: '5px 10px',
          fontSize: '12px', borderRadius: '6px', fontWeight: 700,
          borderRight: `4px solid ${mouseAction.includes('CLICK') ? '#f43f5e' : '#38bdf8'}`,
          backdropFilter: 'blur(4px)'
        }}>
          {mouseAction}
        </div>
      </div>
    </div>
  );
};

export default Mouse;