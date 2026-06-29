import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { FaceMeshResults, CameraType, FaceMeshType } from '../lib/types';
import { useCalibration } from '../context/CalibrationContext';

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

declare global {
  interface Window {
    FaceMesh: new (config: { locateFile: (file: string) => string }) => FaceMeshType;
    Camera: new (
      video: HTMLVideoElement,
      options: { onFrame: () => Promise<void>; width: number; height: number },
    ) => CameraType;
  }
}

const Mouse: React.FC = () => {
  const { t } = useI18n();
  const { calibration } = useCalibration();

  // Giữ ref luôn đồng bộ với dữ liệu calibration mới nhất từ Context mà không trigger re-run useEffect
  const calibRef = useRef(calibration);
  useEffect(() => {
    calibRef.current = calibration;
  }, [calibration]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  const [actionKind, setActionKind] = useState<ActionKind>('moving');
  const [isDragging, setIsDragging] = useState(false);

  const actionKindRef = useRef<ActionKind>('moving');
  const isDraggingRef = useRef(false);
  const draggedElRef = useRef<HTMLElement | SVGElement | null>(null);

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

      lastFrameTimeRef.current = now;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.scale(-1, 1);
      canvasCtx.drawImage(results.image, -canvasElement.width, 0, canvasElement.width, canvasElement.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // --- CAMERA LANDMARKS ---
        const essentialIndices = [1, 13, 14, 10, 152, 234, 454];
        essentialIndices.forEach(idx => {
          const pt = landmarks[idx];
          if (pt) {
            canvasCtx.beginPath();
            canvasCtx.fillStyle = idx === 1 ? '#f2ff00' : [13, 14].includes(idx) ? '#00aeff' : '#66ff00';
            canvasCtx.arc((1 - pt.x) * -canvasElement.width, pt.y * canvasElement.height, 3, 0, 2 * Math.PI);
            canvasCtx.fill();
          }
        });
        canvasCtx.restore();

        // --- ĐỌC CẤU HÌNH DỮ LIỆU CALIBRATION MỚI ---
        const currentCalib = calibRef.current;
        const preferences = currentCalib?.preferences;
        const bounds = currentCalib?.bounds;

        // Đọc tốc độ di chuột mới (thay thế trackingSensitivity cũ bằng speed)
        const speedFactor = preferences?.speed ?? 1;
        // Khởi tạo hệ số bù trừ khoảng cách mặc định (khi chưa lùi/tiến)
        let scaleDepth = 1;

        if (bounds?.refWidth && bounds?.refHeight) {
          // Tính kích thước mặt hiện tại thời gian thực (Runtime) giống y hệt lúc Calibrate
          const currentW = Math.sqrt(
            Math.pow(landmarks[234].x - landmarks[454].x, 2) + Math.pow(landmarks[234].y - landmarks[454].y, 2),
          );
          const currentH = Math.sqrt(
            Math.pow(landmarks[10].y - landmarks[152].y, 2) + Math.pow(landmarks[10].y - landmarks[152].y, 2),
          );

          // Áp dụng công thức tính hệ số chiều sâu trung bình (Bù trừ sai số khi xoay/gật đầu)
          if (currentW > 0 && currentH > 0) {
            scaleDepth = (bounds.refWidth / currentW + bounds.refHeight / currentH) / 2;
          }
        }

        // Đồng bộ ngưỡng há miệng động từ profile user
        let effectiveMouthOpenLimit = preferences?.mouthDragThreshold || 0.03;
        let effectiveMouthCloseLimit = effectiveMouthOpenLimit * 0.2;

        const SCROLL_STEP = 25;
        const VIEWPORT_EDGE_THRESHOLD = 60;

        const nose = landmarks[1];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        const forehead = landmarks[10];
        const chin = landmarks[152];

        // 1. Tính toán tâm và kích thước khuôn mặt thực tế (Runtime)
        const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
        const faceCenterY = (forehead.y + chin.y) / 2;
        const faceWidth = Math.abs(rightCheek.x - leftCheek.x) || 1;
        const faceHeight = Math.abs(chin.y - forehead.y) || 1;

        // 2. Trích xuất tọa độ xoay đầu tương đối
        const currentRotX = (nose.x - faceCenterX) / faceWidth;
        const currentRotY = (nose.y - faceCenterY) / faceHeight;

        // 3. THUẬT TOÁN ĐIỀU KHIỂN HỆ SỐ MƯỢT ĐỘNG (SPEED-ADAPTIVE LOW-PASS FILTER)
        const deltaX = currentRotX - smoothedRaw.current.x;
        const deltaY = currentRotY - smoothedRaw.current.y;
        const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        const MIN_ALPHA = 0.001; // Hệ số cực nhỏ khi đứng yên nhằm hấp thụ hoàn toàn rung nhiễu
        const MAX_ALPHA = 0.2; // Hệ số lớn khi đầu quay nhanh nhằm loại bỏ hoàn toàn độ trễ
        const SPEED_THRESHOLD = 0.1 * speedFactor;

        // Tính toán alpha biến thiên tuyến tính dựa trên tốc độ di chuyển đầu thực tế
        let dynamicAlpha = MIN_ALPHA + (MAX_ALPHA - MIN_ALPHA) * Math.min(1, movementDistance / SPEED_THRESHOLD);

        // --- TÍNH SỚM NGƯỠNG HÁ MIỆNG ĐỂ CO GIÃN NGƯỠNG KHI RA BIÊN ---
        if (
          bounds &&
          bounds.leftX !== undefined &&
          bounds.rightX !== undefined &&
          bounds.topY !== undefined &&
          bounds.bottomY !== undefined &&
          bounds.leftX !== bounds.rightX &&
          bounds.topY !== bounds.bottomY
        ) {
          const checkPctX = (smoothedRaw.current.x - bounds.leftX) / (bounds.rightX - bounds.leftX);
          const faceDeviation = Math.max(0, Math.min(0.5, Math.abs(checkPctX - 0.5)));
          const dynamicMouthFactor = 1 - faceDeviation * 0.6;
          effectiveMouthOpenLimit = effectiveMouthOpenLimit * dynamicMouthFactor;
          effectiveMouthCloseLimit = effectiveMouthOpenLimit * 0.2;
        }

        // --- KHÓA CHỐNG RUNG VÀ GIẢM ĐỘ NHẠY KHI ĐANG THAO TÁC (GIỮ DRAG & DROP ỔN ĐỊNH) ---
        const mouthGap = Math.abs(landmarks[13].y - landmarks[14].y);
        if (mouthGap > effectiveMouthOpenLimit) {
          dynamicAlpha *= 0.2;
        }

        // Áp dụng bộ lọc thích ứng sau khi đã tính toán trạng thái thao tác
        smoothedRaw.current.x += deltaX * dynamicAlpha;
        smoothedRaw.current.y += deltaY * dynamicAlpha;

        let rawX: number;
        let rawY: number;

        // Tính multiplier kết hợp tốc độ và bù trừ khoảng cách
        const moveMultiplier = speedFactor * scaleDepth;

        if (
          bounds &&
          bounds.leftX !== undefined &&
          bounds.rightX !== undefined &&
          bounds.topY !== undefined &&
          bounds.bottomY !== undefined &&
          bounds.leftX !== bounds.rightX &&
          bounds.topY !== bounds.bottomY
        ) {
          // Ánh xạ % vị trí dựa trên dữ liệu tương đối đã loại bỏ hoàn toàn giật nhiễu
          const pctX = (smoothedRaw.current.x - bounds.leftX) / (bounds.rightX - bounds.leftX);
          const pctY = (smoothedRaw.current.y - bounds.topY) / (bounds.bottomY - bounds.topY);

          // Đưa ra tọa độ chuột chính xác
          rawX = (pctX - 0.5) * moveMultiplier;
          rawY = (pctY - 0.5) * moveMultiplier;
        } else {
          // Fallback mặc định khi chưa cân chỉnh (Đảo ngược trục X để đồng bộ hiệu ứng gương camera)
          rawX = -smoothedRaw.current.x * moveMultiplier * 3;
          rawY = smoothedRaw.current.y * moveMultiplier * 3;
        }
        const tx = (rawX + 0.5) * window.innerWidth;
        const ty = (rawY + 0.5) * window.innerHeight;

        currentPos.current = {
          x: Math.max(0, Math.min(window.innerWidth, tx)),
          y: Math.max(0, Math.min(window.innerHeight, ty)),
        };

        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0)`;
        }

        const elAtPoint = document.elementFromPoint(currentPos.current.x, currentPos.current.y);
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

        if (isDraggingRef.current && draggedElRef.current) {
          const mouseMoveEvent = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: currentPos.current.x,
            clientY: currentPos.current.y,
            buttons: 1,
          });
          document.dispatchEvent(mouseMoveEvent);

          const pointerMoveEvent = new PointerEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            clientX: currentPos.current.x,
            clientY: currentPos.current.y,
            buttons: 1,
            pointerId: 1,
            isPrimary: true,
          });
          document.dispatchEvent(pointerMoveEvent);
        }

        // --- XỬ LÝ HÁ MIỆNG (SỬ DỤNG LIMIT MỚI) ---

        if (mouthGap > effectiveMouthOpenLimit) {
          if (!wasMouthOpenRef.current) {
            wasMouthOpenRef.current = true;

            if (elAtPoint && (elAtPoint instanceof HTMLElement || elAtPoint instanceof SVGElement)) {
              const targetDraggable =
                (elAtPoint.closest('.blocklyDraggable') as HTMLElement | SVGElement | null) ||
                (elAtPoint.hasAttribute('draggable')
                  ? elAtPoint
                  : (elAtPoint.closest('[draggable]') as HTMLElement | SVGElement | null));

              if (targetDraggable) {
                draggedElRef.current = targetDraggable;
                isDraggingRef.current = true;
                setIsDragging(true);
                updateAction('drag');

                const mouseDownEvent = new MouseEvent('mousedown', {
                  bubbles: true,
                  cancelable: true,
                  clientX: currentPos.current.x,
                  clientY: currentPos.current.y,
                  buttons: 1,
                });
                targetDraggable.dispatchEvent(mouseDownEvent);

                const pointerDownEvent = new PointerEvent('pointerdown', {
                  bubbles: true,
                  cancelable: true,
                  clientX: currentPos.current.x,
                  clientY: currentPos.current.y,
                  buttons: 1,
                  pointerId: 1,
                  isPrimary: true,
                });
                targetDraggable.dispatchEvent(pointerDownEvent);
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
          }
        } else if (mouthGap < effectiveMouthCloseLimit) {
          if (wasMouthOpenRef.current) {
            wasMouthOpenRef.current = false;

            if (isDraggingRef.current) {
              const mouseUpEvent = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                clientX: currentPos.current.x,
                clientY: currentPos.current.y,
                buttons: 0,
              });
              document.dispatchEvent(mouseUpEvent);

              const pointerUpEvent = new PointerEvent('pointerup', {
                bubbles: true,
                cancelable: true,
                clientX: currentPos.current.x,
                clientY: currentPos.current.y,
                buttons: 0,
                pointerId: 1,
              });
              document.dispatchEvent(pointerUpEvent);

              draggedElRef.current = null;
              isDraggingRef.current = false;
              setIsDragging(false);
              updateAction('drop');
              setTimeout(() => updateAction('moving'), 500);

              smoothedRaw.current.x = currentRotX;
              smoothedRaw.current.y = currentRotY;
            }
          }
        }

        // --- SCROLL PANEL ---
        const activeScrollTarget = getScrollableParent(elAtPoint);
        const cursorX = currentPos.current.x;
        const cursorY = currentPos.current.y;

        if (activeScrollTarget && activeScrollTarget !== document.documentElement) {
          const rect = activeScrollTarget.getBoundingClientRect();
          const PANEL_EDGE_PADDING = 40;

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
        } else if (!elAtPoint?.closest('.workspace-page')) {
          if (cursorY < VIEWPORT_EDGE_THRESHOLD) {
            window.scrollBy({ top: -SCROLL_STEP, behavior: 'auto' });
            updateAction('scrollUp');
          } else if (cursorY > window.innerHeight - VIEWPORT_EDGE_THRESHOLD) {
            window.scrollBy({ top: SCROLL_STEP, behavior: 'auto' });
            updateAction('scrollDown');
          } else if (actionKindRef.current.startsWith('scroll')) {
            updateAction('moving');
          }
        } else if (actionKindRef.current.startsWith('scroll')) {
          updateAction('moving');
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
      <style>{`
        .virtual-hover {
          cursor: pointer !important;
        }
        button.virtual-hover, a.virtual-hover, [role="button"].virtual-hover, [draggable="true"].virtual-hover {
          outline: 2.5px dashed #000000 !important;
          outline-offset: -1px !important;
          box-shadow: 0 0 8px rgba(0,0,0,0.3) !important;
        }
      `}</style>

      {/* Chuột ảo luôn hiển thị để điều khiển hệ thống */}
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

      {/* Hộp xem trước Camera: Ẩn/Hiện phản hồi trực quan theo thuộc tính visualFeedback cấu hình của user */}
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
          display: 'block',
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
