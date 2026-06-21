import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';

type ActionKind =
  | 'moving'
  | 'click'
  | 'drag'
  | 'drop'
  | 'scrollUp'
  | 'scrollDown'
  | 'scrollUpPanel'
  | 'scrollDownPanel';

const ACTION_LABEL_KEYS: Record<ActionKind, string> = {
  moving: 'faceControl.moving',
  click: 'faceControl.click',
  drag: 'faceControl.drag',
  drop: 'faceControl.drop',
  scrollUp: 'faceControl.scrollUp',
  scrollDown: 'faceControl.scrollDown',
  scrollUpPanel: 'faceControl.scrollUpPanel',
  scrollDownPanel: 'faceControl.scrollDownPanel',
};

// Định nghĩa các interface tường minh để dập tắt hoàn toàn lỗi ESLint "no-explicit-any"
interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
}

interface FaceMeshResults {
  multiFaceLandmarks?: NormalizedLandmark[][];
  image: HTMLVideoElement | HTMLCanvasElement;
}

interface FaceMeshOptions {
  maxNumFaces?: number;
  refineLandmarks?: boolean;
  minDetectionConfidence?: number;
}

interface CameraOptions {
  onFrame: () => Promise<void>;
  width: number;
  height: number;
}

interface FaceMeshInstance {
  setOptions(options: FaceMeshOptions): void;
  onResults(callback: (results: FaceMeshResults) => void): void;
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
    Camera: new (video: HTMLVideoElement, options: CameraOptions) => CameraInstance;
  }
}

const Mouse: React.FC = () => {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  const [actionKind, setActionKind] = useState<ActionKind>('moving');
  const [fps, setFps] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  const actionKindRef = useRef<ActionKind>('moving');
  const isDraggingRef = useRef(false);

  const updateAction = (kind: ActionKind) => {
    actionKindRef.current = kind;
    setActionKind(kind);
  };

  const mouseAction = t(ACTION_LABEL_KEYS[actionKind]);

  const currentPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const smoothedRaw = useRef({ x: 0.5, y: 0.5 });
  const wasMouthOpenRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  const lastHoveredEl = useRef<Element | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext('2d');
    if (!canvasCtx) return;

    const { FaceMesh, Camera } = window;
    if (!FaceMesh || !Camera) return;

    let active = true;

    // Chuyển hàm tìm kiếm panel vào TRONG useEffect để sửa triệt để lỗi dependency của ESLint
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

    const faceMesh = new FaceMesh({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });

    faceMesh.onResults((results: FaceMeshResults) => {
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

        // --- CAMERA: CHỈ HIỂN THỊ LANDMARK CẦN THIẾT ---
        // Chỉ vẽ Mũi (1) để track hướng và 2 điểm Môi trong (13, 14) để tính độ há miệng
        const essentialIndices = [1, 13, 14];
        essentialIndices.forEach(idx => {
          const pt = landmarks[idx];
          if (pt) {
            canvasCtx.beginPath();
            // Đốm đỏ cho mũi, đốm xanh ngọc cho môi
            canvasCtx.fillStyle = idx === 1 ? '#f43f5e' : '#2dd4bf';
            canvasCtx.arc((1 - pt.x) * -canvasElement.width, pt.y * canvasElement.height, 3, 0, 2 * Math.PI);
            canvasCtx.fill();
          }
        });
        canvasCtx.restore();

        const SENSITIVITY = { X: 0.3, Y: 0.25 };
        const MOUTH_OPEN_LIMIT = 0.025;
        const MOUTH_CLOSE_LIMIT = 0.018;
        const SCROLL_STEP = 25;
        const VIEWPORT_EDGE_THRESHOLD = 60;

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

        // --- HIỆU ỨNG HOVER ĐƯỢC GIỮ NGUYÊN (FIX FLICKER) ---
        // Tìm element tương tác cha (như button, thẻ a) thay vì chỉ lấy thẻ text con bên trong
        const interactiveTarget =
          elAtPoint?.closest('button, a, [role="button"], input, select, [draggable="true"]') || elAtPoint;

        if (interactiveTarget !== lastHoveredEl.current) {
          if (lastHoveredEl.current) {
            lastHoveredEl.current.classList.remove('virtual-hover');
            ['mouseleave', 'mouseout'].forEach(evt =>
              lastHoveredEl.current?.dispatchEvent(
                new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }),
              ),
            );
          }
          if (interactiveTarget) {
            interactiveTarget.classList.add('virtual-hover');
            ['mouseenter', 'mouseover', 'mousemove'].forEach(evt =>
              interactiveTarget.dispatchEvent(
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
          lastHoveredEl.current = interactiveTarget;
        } else if (interactiveTarget) {
          interactiveTarget.dispatchEvent(
            new MouseEvent('mousemove', {
              bubbles: true,
              view: window,
              clientX: currentPos.current.x,
              clientY: currentPos.current.y,
            }),
          );
        }

        // --- THAO TÁC HÁ MIỆNG / CÀI ĐẶT DRAGGABLE ---
        const mouthGap = Math.abs(landmarks[13].y - landmarks[14].y);

        if (mouthGap > MOUTH_OPEN_LIMIT) {
          if (!wasMouthOpenRef.current) {
            wasMouthOpenRef.current = true;

            const isDraggableElement =
              elAtPoint &&
              (elAtPoint.getAttribute('draggable') === 'true' ||
                elAtPoint.id.toLowerCase().includes('drag') ||
                elAtPoint.closest('[draggable="true"]') ||
                elAtPoint.closest('[id*="drag"]'));

            if (isDraggableElement) {
              isDraggingRef.current = true;
              setIsDragging(true);
              updateAction('drag');
              if (elAtPoint) elAtPoint.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true }));
            } else {
              updateAction('click');
              if (elAtPoint && elAtPoint instanceof HTMLElement && typeof elAtPoint.click === 'function') {
                elAtPoint.click();
              }
              setTimeout(() => {
                if (!isDraggingRef.current) updateAction('moving');
              }, 500);
            }
          }
        } else if (mouthGap < MOUTH_CLOSE_LIMIT) {
          if (wasMouthOpenRef.current) {
            wasMouthOpenRef.current = false;

            if (isDraggingRef.current) {
              isDraggingRef.current = false;
              setIsDragging(false);
              updateAction('drop');
              if (elAtPoint) {
                elAtPoint.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
                elAtPoint.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
              }
              setTimeout(() => updateAction('moving'), 500);
            }
          }
        }

        // --- SCROLL PANEL: TỰ ĐỘNG CUỘN THEO BIÊN BOX ---
        const activeScrollTarget = getScrollableParent(elAtPoint);
        const cursorX = currentPos.current.x;
        const cursorY = currentPos.current.y;

        if (activeScrollTarget && activeScrollTarget !== document.documentElement) {
          const rect = activeScrollTarget.getBoundingClientRect();
          const PANEL_EDGE_PADDING = 40; // Khoảng cách vùng kích hoạt cuộn tính từ biên trong của Panel

          // Đảm bảo chuột đang nằm thực sự trong phạm vi chiều ngang của Box đó
          if (cursorX >= rect.left && cursorX <= rect.right) {
            if (cursorY >= rect.top && cursorY <= rect.top + PANEL_EDGE_PADDING) {
              activeScrollTarget.scrollBy({ top: -SCROLL_STEP, behavior: 'auto' });
              updateAction('scrollUpPanel');
            } else if (cursorY <= rect.bottom && cursorY >= rect.bottom - PANEL_EDGE_PADDING) {
              activeScrollTarget.scrollBy({ top: SCROLL_STEP, behavior: 'auto' });
              updateAction('scrollDownPanel');
            } else if (actionKindRef.current.startsWith('scroll')) {
              updateAction('moving');
            }
          }
        } else {
          // Fallback cuộn toàn trang nếu không đứng trên panel đặc biệt nào
          if (cursorY < VIEWPORT_EDGE_THRESHOLD) {
            window.scrollBy({ top: -SCROLL_STEP, behavior: 'auto' });
            updateAction('scrollUp');
          } else if (cursorY > window.innerHeight - VIEWPORT_EDGE_THRESHOLD) {
            window.scrollBy({ top: SCROLL_STEP, behavior: 'auto' });
            updateAction('scrollDown');
          } else if (actionKindRef.current.startsWith('scroll')) {
            updateAction('moving');
          }
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
      {/* Cấu hình lại CSS giả lập hiệu ứng hover: Đổi sang VIỀN ĐEN và giữ ổn định */}
      <style>{`
        .virtual-hover {
          cursor: pointer !important;
          opacity: 0.9 !important;
          filter: brightness(1.08) !important;
        }
        button.virtual-hover, a.virtual-hover, [role="button"].virtual-hover, [draggable="true"].virtual-hover {
          outline: 2.5px dashed #000000 !important;
          outline-offset: -1px !important;
          box-shadow: 0 0 8px rgba(0,0,0,0.3) !important;
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
            borderRight: `4px solid ${actionKind === 'click' ? '#f43f5e' : '#38bdf8'}`,
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
