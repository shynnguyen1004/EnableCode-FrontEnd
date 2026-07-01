import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { FaceMeshResults, CameraType, FaceMeshType } from '../lib/types';
import { useCalibration } from '../context/CalibrationContext';
import { useEyeTracking } from '../context/EyeTrackingContext';

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
  const { isEnabled } = useEyeTracking();

  // Giữ ref luôn đồng bộ với dữ liệu calibration mới nhất từ Context mà không trigger re-run useEffect
  const calibrationRef = useRef(calibration);
  useEffect(() => {
    calibrationRef.current = calibration;
  }, [calibration]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  const [actionKind, setActionKind] = useState<ActionKind>('moving');
  const [isDragging, setIsDragging] = useState(false);

  const actionKindRef = useRef<ActionKind>('moving');
  const isDraggingRef = useRef(false);
  const draggedElementRef = useRef<HTMLElement | SVGElement | null>(null);
  const depthRatioRef = useRef<number>(1); // EMA tỉ lệ khoảng cách camera — chỉ dùng cho ngưỡng há miệng
  const faceNotDetectedTimerRef = useRef<number | null>(null);
  const [showFaceWarning, setShowFaceWarning] = useState(false);

  // Trạng thái One Euro Filter — đảm nhiệm cả lọc small jitter (đứng yên) lẫn large jitter (di chuyển)
  const oneEuroStateX = useRef({ value: 0.5, derivative: 0 });
  const oneEuroStateY = useRef({ value: 0.5, derivative: 0 });

  // EMA riêng cho vị trí khuôn mặt trong khung hình — dùng để bù trôi khi ngồi lệch tâm so với lúc calib
  const faceCenterFilterRef = useRef({ x: 0.5, y: 0.5 });

  // Lưu trữ vị trí dispatch sự kiện DOM gần nhất nhằm phục vụ cơ chế Throttle di chuyển (Delta d > 5px)
  const lastDispatchedPosition = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastDomScanTimeRef = useRef<number>(0);

  const updateAction = (kind: ActionKind) => {
    actionKindRef.current = kind;
    setActionKind(kind);
  };

  const mouseAction = t(ACTION_LABEL_KEYS[actionKind]);
  const wasMouthOpenRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  const lastHoveredElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isEnabled) return;
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext('2d');
    if (!canvasCtx) return;

    const { FaceMesh, Camera } = window;
    if (!FaceMesh || !Camera) return;

    let isActive = true;

    const getScrollableParent = (element: Element | null): Element | null => {
      if (!element) return null;
      const style = window.getComputedStyle(element);
      const overflowY = style.overflowY;
      const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
      const canScroll = element.scrollHeight > element.clientHeight;

      if (isScrollable && canScroll) {
        return element;
      }
      return getScrollableParent(element.parentElement);
    };

    const faceMesh = new FaceMesh({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.8,
      minTrackingConfidence: 0.8,
    });

    faceMesh.onResults((results: FaceMeshResults) => {
      if (!isActive) return;

      const currentTimeMs = performance.now();
      // Giới hạn tần suất xử lý khung hình tối đa để cân bằng năng lượng CPU
      if (currentTimeMs - lastFrameTimeRef.current < 16) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.scale(-1, 1);
      canvasCtx.drawImage(results.image, -canvasElement.width, 0, canvasElement.width, canvasElement.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        if (faceNotDetectedTimerRef.current) {
          clearTimeout(faceNotDetectedTimerRef.current);
          faceNotDetectedTimerRef.current = null;
        }
        setShowFaceWarning(false);

        // --- BƯỚC 1: TRÍCH XUẤT LANDMARK CỐT LÕI ---
        const nose = landmarks[4]; // Đầu mũi — tâm định vị laser-pointer
        const cheekL = landmarks[116]; // Má trái — điểm neo hộp sọ
        const cheekR = landmarks[345]; // Má phải — điểm neo hộp sọ
        const forehead = landmarks[10]; // Trán — điểm neo ổn định hình học
        const lipTop = landmarks[13]; // Môi trên — tính biên độ há miệng
        const lipBottom = landmarks[14]; // Môi dưới — tính biên độ há miệng

        if (!nose || !cheekL || !cheekR) {
          canvasCtx.restore();
          return;
        }

        // Vẽ phản hồi các điểm neo cốt lõi trực quan lên Canvas preview
        const essentialIndices = [4, 13, 14, 10, 116, 345];
        essentialIndices.forEach(index => {
          const point = landmarks[index];
          if (point) {
            canvasCtx.beginPath();
            canvasCtx.fillStyle = index === 4 ? '#f2ff00' : [13, 14].includes(index) ? '#00aeff' : '#66ff00';
            canvasCtx.arc((1 - point.x) * -canvasElement.width, point.y * canvasElement.height, 3, 0, 2 * Math.PI);
            canvasCtx.fill();
          }
        });
        canvasCtx.restore();

        // Đọc nạp cấu hình calibration từ Context tầng trên
        const currentCalibration = calibrationRef.current;
        const userPreferences = currentCalibration?.preferences;
        const calibrationBounds = currentCalibration?.bounds;
        const userSpeed = userPreferences?.speed ?? 1.0;

        // --- BƯỚC 2: TÍN HIỆU GÓC XOAY ĐẦU (tự chuẩn hóa theo khoảng cách camera) ---
        const faceCenterX = (cheekL.x + cheekR.x) / 2;
        const upperFaceHeight = Math.abs((cheekL.y + cheekR.y) / 2 - forehead.y) || 1;
        const faceWidth = Math.abs(cheekR.x - cheekL.x) || 1;
        const faceHeight = upperFaceHeight * 2.5;
        const faceCenterY = forehead.y + upperFaceHeight * 1.25;

        // rotX/rotY: tỉ lệ lệch mũi so với tâm mặt — cùng co giãn theo khoảng cách nên không cần bù thêm
        const rotX = (nose.x - faceCenterX) / faceWidth;
        const rotY = (nose.y - faceCenterY) / faceHeight;

        // --- BƯỚC 3: EMA RIÊNG CHO VỊ TRÍ KHUÔN MẶT — bù trôi khi ngồi lệch tâm so với lúc calib ---
        const FACE_CENTER_SMOOTHING = 0.15; // càng nhỏ càng ổn định nhưng càng chậm nhận ra dịch chuyển thật
        faceCenterFilterRef.current.x += FACE_CENTER_SMOOTHING * (faceCenterX - faceCenterFilterRef.current.x);
        faceCenterFilterRef.current.y += FACE_CENTER_SMOOTHING * (faceCenterY - faceCenterFilterRef.current.y);

        const refFacePos = calibrationBounds?.refFacePos;
        const DRIFT_COMPENSATION = 0.4; // 0 = tắt bù, 1 = bù toàn phần
        const driftAwareRotX = refFacePos
          ? rotX - (faceCenterFilterRef.current.x - refFacePos.x) * DRIFT_COMPENSATION
          : rotX;

        // --- BƯỚC 4: ÁNH XẠ rotX/rotY SANG % MÀN HÌNH QUA CALIB BOUNDS (mapping tuyến tính độc lập từng trục) ---
        let percentX = 0.5;
        let percentY = 0.5;

        if (
          calibrationBounds?.left &&
          calibrationBounds?.right &&
          calibrationBounds?.top &&
          calibrationBounds?.bottom &&
          calibrationBounds?.center
        ) {
          const center = calibrationBounds.center;
          const left = calibrationBounds.left;
          const right = calibrationBounds.right;
          const top = calibrationBounds.top;
          const bottom = calibrationBounds.bottom;

          // X: chọn nhánh bằng driftAwareRotX (đã bù lệch tâm), nhưng nội suy bằng rotX thật
          if (driftAwareRotX > center.x) {
            const denom = left.x - center.x;
            const factor = denom !== 0 ? (rotX - center.x) / denom : 0;
            percentX = 0.5 - 0.5 * Math.max(0, Math.min(1, factor));
          } else {
            const denom = right.x - center.x;
            const factor = denom !== 0 ? (rotX - center.x) / denom : 0;
            percentX = 0.5 + 0.5 * Math.max(0, Math.min(1, factor));
          }

          // Y: mapping độc lập, không phụ thuộc trục X
          if (rotY < center.y) {
            const denom = top.y - center.y;
            const factor = denom !== 0 ? (rotY - center.y) / denom : 0;
            percentY = 0.5 - 0.5 * Math.max(0, Math.min(1, factor));
          } else {
            const denom = bottom.y - center.y;
            const factor = denom !== 0 ? (rotY - center.y) / denom : 0;
            percentY = 0.5 + 0.5 * Math.max(0, Math.min(1, factor));
          }
        }

        // --- BƯỚC 5: ONE EURO FILTER — lọc duy nhất, chịu trách nhiệm cả small jitter lẫn large jitter ---
        const deltaTimeSeconds = (currentTimeMs - lastFrameTimeRef.current) / 1000;
        lastFrameTimeRef.current = currentTimeMs;

        const MIN_CUTOFF = 0.00005; // Hz — tần số cắt khi đứng yên: càng nhỏ càng lọc mạnh small jitter, càng "nặng tay" lúc bắt đầu di chuyển
        const VELOCITY_BETA = 0.03; // hệ số mở cutoff theo vận tốc: càng nhỏ càng lọc mạnh large jitter, càng trễ khi quay đầu nhanh
        const MAX_CUTOFF = 1.5; // trần cutoff — chặn filter "lọc gần như tắt" khi vận tốc cao, giữ lại 1 mức lọc tối thiểu lúc di chuyển
        const DERIVATIVE_CUTOFF = 0.5; // Hz — tần số lọc riêng cho đạo hàm vận tốc thô

        // --- BƯỚC 7 (KHÔNG THUỘC PIPELINE LỌC): NGƯỠNG HÁ MIỆNG — scaleDepthFactor tách riêng, chỉ phục vụ click/drag ---
        let depthRatio = 1.0;
        const cheekDistance = Math.sqrt(Math.pow(cheekL.x - cheekR.x, 2) + Math.pow(cheekL.y - cheekR.y, 2));
        if (calibrationBounds?.refWidth && cheekDistance > 0) {
          depthRatio = calibrationBounds.refWidth / cheekDistance;
        }
        depthRatio = Math.min(4.0, Math.max(0.4, depthRatio)); // range rộng hơn cursor filter — bù đủ cho khoảng cách xa
        depthRatio = depthRatioRef.current + 0.2 * (depthRatio - depthRatioRef.current);
        depthRatioRef.current = depthRatio;

        const mouthDeltaX = lipTop.x - lipBottom.x;
        const mouthDeltaY = lipTop.y - lipBottom.y;
        const mouthDepthCompensation = Math.pow(depthRatio, 2.2);
        const currentMouthGapDistance =
          Math.sqrt(mouthDeltaX * mouthDeltaX + mouthDeltaY * mouthDeltaY) * mouthDepthCompensation;

        // Đồng bộ hóa biên độ hiệu chuẩn "Mở thoải mái" cá nhân hóa để chống mỏi hàm sinh học
        const personalComfortThreshold = userPreferences?.mouthDragThreshold ?? 0.03;
        const schmittTriggerDragThreshold = personalComfortThreshold; // 100% Mốc mỏ neo mở thoải mái
        const schmittTriggerDropThreshold = personalComfortThreshold * 0.5; // 50% Mốc mỏ neo mở thoải mái
        const mouthDetectThreshold = personalComfortThreshold * 0.35; // phát hiện bắt đầu há — thấp hơn drag threshold, tune 0.25–0.45
        const isMouthOpening = currentMouthGapDistance > mouthDetectThreshold;
        const adaptiveMinCutoff = isMouthOpening ? MIN_CUTOFF * 4.0 : MIN_CUTOFF; // lọc cực mạnh khi phát hiện há miệng — tune 3.0–6.0

        const applyOneEuroFilter = (rawValue: number, state: { value: number; derivative: number }) => {
          if (deltaTimeSeconds <= 0) return state.value;

          const rawDerivative = (rawValue - state.value) / deltaTimeSeconds;
          const alphaDerivative = 1.0 / (1.0 + 1.0 / (2.0 * Math.PI * DERIVATIVE_CUTOFF * deltaTimeSeconds));
          const filteredDerivative = alphaDerivative * rawDerivative + (1.0 - alphaDerivative) * state.derivative;

          const adaptiveCutoff = Math.min(MAX_CUTOFF, adaptiveMinCutoff + VELOCITY_BETA * Math.abs(filteredDerivative));
          const alphaValue = 1.0 / (1.0 + 1.0 / (2.0 * Math.PI * adaptiveCutoff * deltaTimeSeconds));
          const filteredValue = alphaValue * rawValue + (1.0 - alphaValue) * state.value;

          state.value = filteredValue;
          state.derivative = filteredDerivative;
          return filteredValue;
        };

        const filteredX = applyOneEuroFilter(percentX, oneEuroStateX.current);
        const filteredY = applyOneEuroFilter(percentY, oneEuroStateY.current);

        // --- BƯỚC 6: GAIN CURVE DUY NHẤT — quyết định cả tốc độ tổng thể lẫn độ chính xác gần tâm, luôn chạm viền ---
        const applyGainCurve = (value: number, speed: number) => {
          const centered = value - 0.5;
          const sign = Math.sign(centered);
          const magnitude = Math.abs(centered) * 2; // 0..1
          const safeSpeed = Math.max(0.3, Math.min(2, speed)); // chặn 2 đầu, tránh gain tại tâm vọt quá cao gây jitter
          const k = 1 / safeSpeed;
          const curved = magnitude / (magnitude + k * (1 - magnitude)); // đạo hàm tại tâm = safeSpeed (hữu hạn), tại viền luôn = 1
          return 0.5 + sign * curved * 0.5;
        };

        const dragSpeedMultiplier = isDraggingRef.current ? 0.5 : 1.0;
        const gainedX = applyGainCurve(filteredX, userSpeed * dragSpeedMultiplier);
        const gainedY = applyGainCurve(filteredY, userSpeed * dragSpeedMultiplier);

        const finalPixelPositionX = Math.max(0, Math.min(window.innerWidth, gainedX * window.innerWidth));
        const finalPixelPositionY = Math.max(0, Math.min(window.innerHeight, gainedY * window.innerHeight));

        // Phản hồi phần cứng UI trực tiếp qua biến đổi translate3d tăng tốc GPU mượt mà 60 FPS
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate3d(${finalPixelPositionX}px, ${finalPixelPositionY}px, 0)`;
        }

        const elementAtCursorPoint = document.elementFromPoint(finalPixelPositionX, finalPixelPositionY);

        setInterval(() => {
          console.log({
            depthRatio,
            cheekDistance,
            mouthGap: Math.sqrt(mouthDeltaX * mouthDeltaX + mouthDeltaY * mouthDeltaY),
            currentMouthGapDistance,
            threshold: personalComfortThreshold,
          });
        }, 10000);

        if (currentMouthGapDistance >= schmittTriggerDragThreshold) {
          if (!wasMouthOpenRef.current) {
            wasMouthOpenRef.current = true;

            if (
              elementAtCursorPoint &&
              (elementAtCursorPoint instanceof HTMLElement || elementAtCursorPoint instanceof SVGElement)
            ) {
              const targetDraggableElement =
                (elementAtCursorPoint.closest('.blocklyDraggable') as HTMLElement | SVGElement | null) ||
                (elementAtCursorPoint.hasAttribute('draggable')
                  ? elementAtCursorPoint
                  : (elementAtCursorPoint.closest('[draggable]') as HTMLElement | SVGElement | null));

              if (targetDraggableElement) {
                draggedElementRef.current = targetDraggableElement;
                isDraggingRef.current = true;
                setIsDragging(true);
                updateAction('drag');

                // Kích hoạt giả lập luồng sự kiện nhấn Drag hệ thống chuột trái giữ
                targetDraggableElement.dispatchEvent(
                  new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    clientX: finalPixelPositionX,
                    clientY: finalPixelPositionY,
                    buttons: 1,
                  }),
                );
                targetDraggableElement.dispatchEvent(
                  new PointerEvent('pointerdown', {
                    bubbles: true,
                    cancelable: true,
                    clientX: finalPixelPositionX,
                    clientY: finalPixelPositionY,
                    buttons: 1,
                    pointerId: 1,
                    isPrimary: true,
                  }),
                );
              } else {
                // Nhấp lệnh Click hệ thống chuẩn nếu không quét thấy tính chất Drag
                updateAction('click');
                if (elementAtCursorPoint instanceof HTMLElement && typeof elementAtCursorPoint.click === 'function') {
                  elementAtCursorPoint.click();
                }
                setTimeout(() => {
                  if (!isDraggingRef.current) updateAction('moving');
                }, 500);
              }
            }
          }
        } else if (currentMouthGapDistance <= schmittTriggerDropThreshold) {
          if (wasMouthOpenRef.current) {
            wasMouthOpenRef.current = false;
            oneEuroStateX.current.derivative = 0;
            oneEuroStateY.current.derivative = 0;

            if (isDraggingRef.current) {
              // Giải phóng và nhả liên kết Kéo thả an toàn qua phân tách hai ngưỡng Schmitt Trigger
              document.dispatchEvent(
                new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  clientX: finalPixelPositionX,
                  clientY: finalPixelPositionY,
                  buttons: 0,
                }),
              );
              document.dispatchEvent(
                new PointerEvent('pointerup', {
                  bubbles: true,
                  cancelable: true,
                  clientX: finalPixelPositionX,
                  clientY: finalPixelPositionY,
                  buttons: 0,
                  pointerId: 1,
                }),
              );

              draggedElementRef.current = null;
              isDraggingRef.current = false;
              setIsDragging(false);
              updateAction('drop');
              setTimeout(() => updateAction('moving'), 500);
            }
          }
        }

        // Bắn sự kiện Move liên hoàn bảo lưu trạng thái Drag vật thể khi đang kích hoạt
        if (isDraggingRef.current && draggedElementRef.current) {
          document.dispatchEvent(
            new MouseEvent('mousemove', {
              bubbles: true,
              cancelable: true,
              clientX: finalPixelPositionX,
              clientY: finalPixelPositionY,
              buttons: 1,
            }),
          );
          document.dispatchEvent(
            new PointerEvent('pointermove', {
              bubbles: true,
              cancelable: true,
              clientX: finalPixelPositionX,
              clientY: finalPixelPositionY,
              buttons: 1,
              pointerId: 1,
              isPrimary: true,
            }),
          );
        }

        // --- BƯỚC 7: GIẢ LẬP SỰ KIỆN HỆ THỐNG DOM VÀ CƠ CHẾ THROTTLE PERFORMANCE ---
        const moveDeltaDistanceX = finalPixelPositionX - lastDispatchedPosition.current.x;
        const moveDeltaDistanceY = finalPixelPositionY - lastDispatchedPosition.current.y;
        const calculatedMovementDelta = Math.sqrt(
          moveDeltaDistanceX * moveDeltaDistanceX + moveDeltaDistanceY * moveDeltaDistanceY,
        );

        // Hàm điều tiết (Throttle): Chỉ tính toán hình học cây DOM và phát sự kiện Virtual Hover khi con trỏ di chuyển vượt ngưỡng Delta d > 5px
        if (calculatedMovementDelta > 5.0) {
          const interactiveTargetElement =
            elementAtCursorPoint?.closest('button, a, [role="button"], input, select, [draggable="true"]') ||
            elementAtCursorPoint;

          if (interactiveTargetElement !== lastHoveredElement.current) {
            if (lastHoveredElement.current) {
              lastHoveredElement.current.classList.remove('virtual-hover');
              ['mouseleave', 'mouseout'].forEach(eventName =>
                lastHoveredElement.current?.dispatchEvent(
                  new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }),
                ),
              );
            }
            if (interactiveTargetElement) {
              interactiveTargetElement.classList.add('virtual-hover');
              ['mouseenter', 'mouseover', 'mousemove'].forEach(eventName =>
                interactiveTargetElement.dispatchEvent(
                  new MouseEvent(eventName, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: finalPixelPositionX,
                    clientY: finalPixelPositionY,
                  }),
                ),
              );
            }
            lastHoveredElement.current = interactiveTargetElement;
          } else if (interactiveTargetElement) {
            interactiveTargetElement.dispatchEvent(
              new MouseEvent('mousemove', {
                bubbles: true,
                view: window,
                clientX: finalPixelPositionX,
                clientY: finalPixelPositionY,
              }),
            );
          }
          // Lưu vết tọa độ dispatch an toàn gần nhất phục vụ kiểm tra chu kỳ kế tiếp
          lastDispatchedPosition.current = { x: finalPixelPositionX, y: finalPixelPositionY };
        }

        // Giảm tần số lấy mẫu tác vụ phụ (Edge Scrolling) cố định ở mức 25 FPS - 30 FPS để bảo vệ CPU khỏi Layout Thrashing
        if (currentTimeMs - lastDomScanTimeRef.current >= 33) {
          lastDomScanTimeRef.current = currentTimeMs;

          const activeScrollableParent = getScrollableParent(elementAtCursorPoint);
          const VIEWPORT_EDGE_BUFFER_ZONE = 180; // Vùng đệm biên cấu hình cố định 80px
          const SCROLL_STEP_INTENSITY = 30;

          if (activeScrollableParent && activeScrollableParent !== document.documentElement) {
            const boundingRectangle = activeScrollableParent.getBoundingClientRect();
            const PANEL_EDGE_PADDING = 40;

            if (finalPixelPositionX >= boundingRectangle.left && finalPixelPositionX <= boundingRectangle.right) {
              if (
                finalPixelPositionY >= boundingRectangle.top &&
                finalPixelPositionY <= boundingRectangle.top + PANEL_EDGE_PADDING
              ) {
                activeScrollableParent.scrollBy({ top: -SCROLL_STEP_INTENSITY, behavior: 'auto' });
                updateAction('scrollUpPanel');
              } else if (
                finalPixelPositionY <= boundingRectangle.bottom &&
                finalPixelPositionY >= boundingRectangle.bottom - PANEL_EDGE_PADDING
              ) {
                activeScrollableParent.scrollBy({ top: SCROLL_STEP_INTENSITY, behavior: 'auto' });
                updateAction('scrollDownPanel');
              } else if (actionKindRef.current.startsWith('scroll')) {
                updateAction('moving');
              }
            }
          } else if (!elementAtCursorPoint?.closest('.workspace-page')) {
            // Tự động kích hoạt cơ chế Edge Scrolling cuộn trang mượt mà khi tiệm cận biên rìa màn hình chính
            if (finalPixelPositionY < VIEWPORT_EDGE_BUFFER_ZONE) {
              window.scrollBy({ top: -SCROLL_STEP_INTENSITY, behavior: 'auto' });
              updateAction('scrollUp');
            } else if (finalPixelPositionY > window.innerHeight - VIEWPORT_EDGE_BUFFER_ZONE) {
              window.scrollBy({ top: SCROLL_STEP_INTENSITY, behavior: 'auto' });
              updateAction('scrollDown');
            } else if (actionKindRef.current.startsWith('scroll')) {
              updateAction('moving');
            }
          } else if (actionKindRef.current.startsWith('scroll')) {
            updateAction('moving');
          }
        }
      } else {
        canvasCtx.restore();
        if (!faceNotDetectedTimerRef.current) {
          faceNotDetectedTimerRef.current = window.setTimeout(() => {
            setShowFaceWarning(true);
          }, 600);
        }
      }
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        if (isActive) await faceMesh.send({ image: videoElement });
      },
      width: 320,
      height: 240,
    });

    void camera.start();

    return () => {
      isActive = false;
      camera.stop();
      void faceMesh.close();
      if (faceNotDetectedTimerRef.current) {
        window.clearTimeout(faceNotDetectedTimerRef.current);
      }
    };
  }, [isEnabled]);
  if (!isEnabled) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      <style>{`
        .virtual-hover {
          cursor: pointer !important;
        }
        button.virtual-hover, a.virtual-hover, [role="button"].virtual-hover, [draggable="true"].virtual-hover {
          outline: 2.5px dashed #ff7700 !important;
          outline-offset: -1px !important;
          box-shadow: 0 0 8px rgba(0,0,0,0.3) !important;
        }
      `}</style>

      {/* Vòng tròn định vị ảo của hệ thống chuột Face Tracking */}
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

      {showFaceWarning && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '32px 48px',
            borderRadius: '16px',
            zIndex: 99999,
            textAlign: 'center',
            fontSize: '1.1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            width: '420px',
            maxWidth: '90vw',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📷</div>
          <div style={{ fontWeight: 700, marginBottom: '8px', color: '#ff7700' }}>Không nhận diện được khuôn mặt</div>
          <div style={{ opacity: 0.8, fontSize: '0.95rem' }}>Hãy ngồi gần camera hơn</div>
        </div>
      )}

      {/* Hộp xem trước Camera thu nhỏ phản hồi trạng thái thời gian thực */}
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
