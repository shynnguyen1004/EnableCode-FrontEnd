import React, { useEffect, useRef, useState } from 'react';

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

const Mouse: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  const [mouseAction, setMouseAction] = useState<string>('Đang di chuyển');
  const [fps, setFps] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  const mouseActionRef = useRef('Đang di chuyển');
  const isDraggingRef = useRef(false);

  const currentPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const smoothedRaw = useRef({ x: 0.5, y: 0.5 });
  const wasMouthOpenRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  const lastHoveredEl = useRef<Element | null>(null);

  // Hàm hỗ trợ tìm kiếm Panel/Container có thể cuộn gần nhất dưới con trỏ chuột
  const getScrollableParent = (el: Element | null): Element | null => {
    if (!el) return null;
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
    const canScroll = el.scrollHeight > el.clientHeight;

    if (isScrollable && canScroll) {
      return el;
    }
    return getScrollableParent(el.parentElement);
  };

  useEffect(() => {
    mouseActionRef.current = mouseAction;
  }, [mouseAction]);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext('2d');
    if (!canvasCtx) return;

    const { FaceMesh, Camera } = window;
    if (!FaceMesh || !Camera) return;

    let active = true;

    const faceMesh = new FaceMesh({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });

    faceMesh.onResults((results: any) => {
      if (!active) return;

      const now = performance.now();
      if (now - lastFrameTimeRef.current < 40) return;

      const currentFps = Math.round(1000 / (now - lastFrameTimeRef.current));
      lastFrameTimeRef.current = now;
      if (Math.random() > 0.8) setFps(currentFps);

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.scale(-1, 1);
      canvasCtx.drawImage(results.image, -canvasElement.width, 0, canvasElement.width, canvasElement.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        canvasCtx.fillStyle = 'rgba(45, 212, 191, 0.7)';
        landmarks.forEach((pt: any) => {
          canvasCtx.beginPath();
          canvasCtx.arc((1 - pt.x) * -canvasElement.width, pt.y * canvasElement.height, 0.8, 0, 2 * Math.PI);
          canvasCtx.fill();
        });
        canvasCtx.restore();

        const SENSITIVITY = { X: 0.3, Y: 0.25 };
        const MOUTH_OPEN_LIMIT = 0.025;
        const MOUTH_CLOSE_LIMIT = 0.018;
        const SCROLL_STEP = 30; // Giảm một chút để cuộn panel mượt hơn
        const EDGE_THRESHOLD = 60;

        const nose = landmarks[1];
        smoothedRaw.current.x += (nose.x - smoothedRaw.current.x) * 0.2;
        smoothedRaw.current.y += (nose.y - smoothedRaw.current.y) * 0.2;

        const tx = ((1 - smoothedRaw.current.x - (0.5 - SENSITIVITY.X / 2)) / SENSITIVITY.X) * window.innerWidth;
        const ty = ((smoothedRaw.current.y - (0.5 - SENSITIVITY.Y / 2)) / SENSITIVITY.Y) * window.innerHeight;

        currentPos.current = {
          x: Math.max(0, Math.min(window.innerWidth, tx)),
          y: Math.max(0, Math.min(window.innerHeight, ty)),
        };

        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0)`;
        }

        const elAtPoint = document.elementFromPoint(currentPos.current.x, currentPos.current.y);

        // --- XỬ LÝ HOVER EFFECT CHO CHUỘT ẢO ---
        if (elAtPoint !== lastHoveredEl.current) {
          if (lastHoveredEl.current) {
            // Xóa class hover giả lập khỏi phần tử cũ
            lastHoveredEl.current.classList.remove('virtual-hover');
            ['mouseleave', 'mouseout'].forEach(evt =>
              lastHoveredEl.current?.dispatchEvent(
                new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }),
              ),
            );
          }
          if (elAtPoint) {
            // Thêm class hover giả lập vào phần tử mới giúp kích hoạt CSS style
            elAtPoint.classList.add('virtual-hover');
            ['mouseenter', 'mouseover', 'mousemove'].forEach(evt =>
              elAtPoint.dispatchEvent(
                new MouseEvent(evt, {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX: currentPos.current.x,
                  clientY: currentPos.current.y,
                }),
              ),
            );
          }
          lastHoveredEl.current = elAtPoint;
        } else if (elAtPoint) {
          elAtPoint.dispatchEvent(
            new MouseEvent('mousemove', {
              bubbles: true,
              view: window,
              clientX: currentPos.current.x,
              clientY: currentPos.current.y,
            }),
          );
        }

        // --- TINH GỌN THAO TÁC HÁ MIỆNG (CLICK HOẶC KÉO THẢ) ---
        const mouthGap = Math.abs(landmarks[13].y - landmarks[14].y);

        if (mouthGap > MOUTH_OPEN_LIMIT) {
          if (!wasMouthOpenRef.current) {
            wasMouthOpenRef.current = true;

            // Kiểm tra xem ID hoặc thuộc tính phần tử có hỗ trợ kéo thả hay không
            const isDraggableElement =
              elAtPoint &&
              (elAtPoint.getAttribute('draggable') === 'true' ||
                elAtPoint.id.toLowerCase().includes('drag') ||
                elAtPoint.closest('[draggable="true"]') ||
                elAtPoint.closest('[id*="drag"]'));

            if (isDraggableElement) {
              // Bật trạng thái Kéo thả ngay lập tức
              isDraggingRef.current = true;
              setIsDragging(true);
              setMouseAction('Kéo vật thể (Drag)');
              elAtPoint.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true }));
            } else {
              // Thực hiện Click ngay lập tức
              setMouseAction('💥 CLICK!');
              if (elAtPoint && elAtPoint instanceof HTMLElement && typeof elAtPoint.click === 'function') {
                elAtPoint.click();
              }
              setTimeout(() => {
                if (!isDraggingRef.current) setMouseAction('Đang di chuyển');
              }, 500);
            }
          }
        } else if (mouthGap < MOUTH_CLOSE_LIMIT) {
          if (wasMouthOpenRef.current) {
            wasMouthOpenRef.current = false;

            if (isDraggingRef.current) {
              // Nếu đang kéo thì thực hiện Thả (Drop) khi ngậm miệng
              isDraggingRef.current = false;
              setIsDragging(false);
              setMouseAction('Thả vật thể (Drop)');
              if (elAtPoint) {
                elAtPoint.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
                elAtPoint.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
              }
              setTimeout(() => setMouseAction('Đang di chuyển'), 500);
            }
          }
        }

        // --- XỬ LÝ SCROLL THEO TỪNG PANEL RIÊNG BIỆT ---
        const activeScrollTarget = getScrollableParent(elAtPoint) || document.documentElement;

        if (currentPos.current.y < EDGE_THRESHOLD) {
          activeScrollTarget.scrollBy({ top: -SCROLL_STEP, behavior: 'auto' });
          setMouseAction('🔼 Cuộn lên');
        } else if (currentPos.current.y > window.innerHeight - EDGE_THRESHOLD) {
          activeScrollTarget.scrollBy({ top: SCROLL_STEP, behavior: 'auto' });
          setMouseAction('🔽 Cuộn xuống');
        } else if (mouseActionRef.current.includes('Cuộn')) {
          setMouseAction('Đang di chuyển');
        }
      } else {
        canvasCtx.restore();
      }
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        if (active) await faceMesh.send({ image: videoElement });
      },
      width: 320,
      height: 240,
    });

    void camera.start();

    return () => {
      active = false;
      camera.stop();
      void faceMesh.close();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {/* Inject CSS giả lập hiệu ứng hover đồng bộ với class .virtual-hover */}
      <style>{`
        .virtual-hover {
          cursor: pointer !important;
          opacity: 0.85 !important;
          filter: brightness(1.15) !important;
          transition: all 0.15s ease !important;
        }
        /* Hỗ trợ hiển thị outline nhẹ để biết chuột ảo đang target vào đâu */
        button.virtual-hover, a.virtual-hover, [draggable="true"].virtual-hover {
          outline: 2px dashed #2dd4bf !important;
          outline-offset: 2px;
        }
      `}</style>

      <div
        ref={cursorRef}
        style={{
          position: 'absolute',
          width: '26px',
          height: '26px',
          border: '3px solid #2dd4bf',
          borderRadius: '50%',
          boxShadow: isDragging ? '0 0 25px #a855f7' : '0 0 15px rgba(45, 212, 191, 0.4)',
          backgroundColor: isDragging ? '#a855f733' : 'rgba(45, 212, 191, 0.1)',
          transition: 'transform 0.04s linear',
          willChange: 'transform',
          left: '-13px',
          top: '-13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#2dd4bf' }} />
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '260px',
          height: '180px',
          background: '#020617',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          border: '2px solid #1e293b',
          pointerEvents: 'auto',
        }}
      >
        <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
        <canvas
          ref={canvasRef}
          width="260"
          height="180"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(15, 23, 42, 0.8)',
            color: '#10b981',
            padding: '5px 10px',
            fontSize: '12px',
            borderRadius: '6px',
            fontWeight: 700,
            fontFamily: 'monospace',
            borderLeft: '4px solid #10b981',
            backdropFilter: 'blur(4px)',
          }}
        >
          FPS: {fps}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            background: 'rgba(15, 23, 42, 0.8)',
            color: '#f8fafc',
            padding: '5px 10px',
            fontSize: '12px',
            borderRadius: '6px',
            fontWeight: 700,
            borderRight: `4px solid ${mouseAction.includes('CLICK') ? '#f43f5e' : '#38bdf8'}`,
            backdropFilter: 'blur(4px)',
          }}
        >
          {mouseAction}
        </div>
      </div>
    </div>
  );
};

export default Mouse;
