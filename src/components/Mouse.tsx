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
  const previousScaleDepthFactor = useRef<number>(1);

  // Bộ lưu trữ trạng thái động của cấu trúc One Euro Filter để chống nhiễu Jitter thích ứng
  const oneEuroStateX = useRef({ value: 0.5, derivative: 0 });
  const oneEuroStateY = useRef({ value: 0.5, derivative: 0 });
  const smoothedGainRef = useRef(1.0);
  const smoothedPixelRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

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
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
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

        // --- BƯỚC 1: THU THẬP VÀ TRÍCH XUẤT LANDMARK CỐT LÕI ---
        const noseTipLandmark = landmarks[4]; // Đầu mũi làm tâm định vị laser-pointer 1:1 chính xác
        const leftCheekboneLandmark = landmarks[234]; // Điểm neo cố định hộp sọ vùng má trái
        const rightCheekboneLandmark = landmarks[454]; // Điểm neo cố định hộp sọ vùng má phải
        const foreheadCenterLandmark = landmarks[10]; // Vùng trán cố định ổn định hình học
        const topLipCenterLandmark = landmarks[13]; // Điểm tính biên độ há miệng môi trên
        const bottomLipCenterLandmark = landmarks[14]; // Điểm tính biên độ há miệng môi dưới

        if (!noseTipLandmark || !leftCheekboneLandmark || !rightCheekboneLandmark) {
          canvasCtx.restore();
          return;
        }

        // Vẽ phản hồi các điểm neo cốt lõi trực quan lên Canvas preview
        const essentialIndices = [4, 13, 14, 10, 234, 454];
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

        // Đọc nạp cấu hình dữ liệu cân chỉnh từ Context tầng trên
        const currentCalibration = calibrationRef.current;
        const userPreferences = currentCalibration?.preferences;
        const calibrationBounds = currentCalibration?.bounds;

        const baseMouseSpeedFactor = userPreferences?.speed ?? 1.0;

        // --- BƯỚC 2: TÍNH TOÁN TÍNH BẤT BIẾN KHOẢNG CÁCH (DISTANCE INVARIANCE) ---
        let scaleDepthFactor = 1.0;
        const currentCheekWidth = Math.sqrt(
          Math.pow(leftCheekboneLandmark.x - rightCheekboneLandmark.x, 2) +
            Math.pow(leftCheekboneLandmark.y - rightCheekboneLandmark.y, 2),
        );

        if (calibrationBounds?.refWidth && currentCheekWidth > 0) {
          scaleDepthFactor = calibrationBounds.refWidth / currentCheekWidth;
        }
        const rawDepthRatio =
          calibrationBounds?.refWidth && currentCheekWidth > 0 ? calibrationBounds.refWidth / currentCheekWidth : 1.0;

        // Clamping chặn biên giới hạn hệ số co giãn tránh nhiễu nhảy vọt phần cứng camera ngoài ý muốn
        scaleDepthFactor = Math.min(2.5, Math.max(0.6, scaleDepthFactor));
        scaleDepthFactor =
          previousScaleDepthFactor.current + 0.2 * (scaleDepthFactor - previousScaleDepthFactor.current);
        previousScaleDepthFactor.current = scaleDepthFactor;

        // --- BƯỚC 3: NỘI SUY VÀ ÁNH XẠ TỌA ĐỘ SANG MÀN HÌNH (COORDINATE MAPPING VIA SMOOTHSTEP) ---
        const faceCenterX = (leftCheekboneLandmark.x + rightCheekboneLandmark.x) / 2;
        const stableUpperHeight =
          Math.abs((leftCheekboneLandmark.y + rightCheekboneLandmark.y) / 2 - foreheadCenterLandmark.y) || 1;
        const faceHeightBounding = stableUpperHeight * 2.5;
        const faceWidthBounding = Math.abs(rightCheekboneLandmark.x - leftCheekboneLandmark.x) || 1;
        const faceCenterY = foreheadCenterLandmark.y + stableUpperHeight * 1.25;

        const refFacePos = calibrationBounds?.refFacePos;
        const relativeRotationX = (noseTipLandmark.x - faceCenterX) / faceWidthBounding;
        const relativeRotationY = (noseTipLandmark.y - faceCenterY) / faceHeightBounding;

        const DRIFT_COMPENSATION = 0.4; // 0 = tắt bù, 1 = bù toàn phần — tune trong 0.4–0.8
        const compensatedRotationX = refFacePos
          ? relativeRotationX - (faceCenterX - refFacePos.x) * DRIFT_COMPENSATION
          : relativeRotationX;

        // Định nghĩa hàm nội suy mượt Smoothstep bảo toàn liên tục C1 đạo hàm, triệt tiêu sượng tại tâm
        const applySmoothstep = (value: number) => {
          const clampedValue = Math.max(0, Math.min(1, value));
          return clampedValue * clampedValue * (3 - 2 * clampedValue);
        };
        const applySpeedCurve = (value: number, speed: number) => {
          const centered = value - 0.5;
          const sign = Math.sign(centered);
          const magnitude = Math.abs(centered) * 2; // 0..1
          const safeSpeed = Math.max(0.3, Math.min(2, speed)); // chặn cả 2 đầu, tránh cực trị
          const k = 1 / safeSpeed;
          const curved = magnitude / (magnitude + k * (1 - magnitude)); // đạo hàm tại 0 = safeSpeed (hữu hạn), tại 1 = 1/safeSpeed
          return 0.5 + sign * curved * 0.5;
        };

        let normalizedPercentX = 0.5;
        let normalizedPercentY = 0.5;

        if (
          calibrationBounds?.left &&
          calibrationBounds?.right &&
          calibrationBounds?.top &&
          calibrationBounds?.bottom &&
          calibrationBounds?.center
        ) {
          const centerBound = calibrationBounds.center;
          const leftBound = calibrationBounds.left;
          const rightBound = calibrationBounds.right;
          const topBound = calibrationBounds.top;
          const bottomBound = calibrationBounds.bottom;

          // X: chỉ phụ thuộc relativeRotationX, không còn lệ thuộc Y
          if (compensatedRotationX > centerBound.x) {
            const denom = leftBound.x - centerBound.x;
            const factor = denom !== 0 ? (relativeRotationX - centerBound.x) / denom : 0;
            normalizedPercentX = 0.5 - 0.5 * Math.max(0, Math.min(1, factor));
          } else {
            const denom = rightBound.x - centerBound.x;
            const factor = denom !== 0 ? (relativeRotationX - centerBound.x) / denom : 0;
            normalizedPercentX = 0.5 + 0.5 * Math.max(0, Math.min(1, factor));
          }

          // Y: chỉ phụ thuộc relativeRotationY, không còn lệ thuộc X
          if (relativeRotationY < centerBound.y) {
            const denom = topBound.y - centerBound.y;
            const factor = denom !== 0 ? (relativeRotationY - centerBound.y) / denom : 0;
            normalizedPercentY = 0.5 - 0.5 * Math.max(0, Math.min(1, factor));
          } else {
            const denom = bottomBound.y - centerBound.y;
            const factor = denom !== 0 ? (relativeRotationY - centerBound.y) / denom : 0;
            normalizedPercentY = 0.5 + 0.5 * Math.max(0, Math.min(1, factor));
          }
        }

        // --- BƯỚC 4: BỘ LỌC LÀM MƯỢT VÀ CHỐNG JITTER (ONE EURO FILTER THÍCH ỨNG) ---
        const deltaTimeSeconds = (currentTimeMs - lastFrameTimeRef.current) / 1000;
        lastFrameTimeRef.current = currentTimeMs;

        // Cấu hình tham số chuẩn hóa cho kiến trúc One Euro Filter thích ứng tần số cắt
        const minCutoffFrequency = 0.05 / scaleDepthFactor; // Tần số cắt tối thiểu (Hz) khi đầu đứng yên để lọc 100% micro-jitter
        const velocityBetaFactor = 0.008 / scaleDepthFactor; // Hệ số bám đuổi tốc độ cao nhằm triệt tiêu độ trễ cao su khi quay đầu nhanh
        const derivativeCutoffFrequency = 0.5; // Tần số lọc mượt cho đạo hàm vận tốc thô

        const calculateOneEuroFilter = (
          currentRawValue: number,
          filterState: { value: number; derivative: number },
        ) => {
          if (deltaTimeSeconds <= 0) return filterState.value;

          // Đo đạc vận tốc dịch chuyển tức thời để phân tích đặc trưng chuyển động đầu
          const rawDerivative = (currentRawValue - filterState.value) / deltaTimeSeconds;
          const alphaDerivative = 1.0 / (1.0 + 1.0 / (2.0 * Math.PI * derivativeCutoffFrequency * deltaTimeSeconds));
          const filteredDerivative = alphaDerivative * rawDerivative + (1.0 - alphaDerivative) * filterState.derivative;

          // Điều tiết động tần số cắt dựa trên tốc độ chuyển động thực tế tế cơ sinh học
          const adaptiveCutoff = Math.min(
            1.6, // dù di chuyển nhanh cỡ nào cũng không lọc ít hơn mức này
            minCutoffFrequency + velocityBetaFactor * Math.abs(filteredDerivative),
          );
          const alphaValue = 1.0 / (1.0 + 1.0 / (2.0 * Math.PI * adaptiveCutoff * deltaTimeSeconds));
          const filteredValue = alphaValue * currentRawValue + (1.0 - alphaValue) * filterState.value;

          filterState.value = filteredValue;
          filterState.derivative = filteredDerivative;
          return filteredValue;
        };

        const filteredTargetX = calculateOneEuroFilter(normalizedPercentX, oneEuroStateX.current);
        const filteredTargetY = calculateOneEuroFilter(normalizedPercentY, oneEuroStateY.current);

        const finalSteppedX = applySmoothstep(filteredTargetX);
        const finalSteppedY = applySmoothstep(filteredTargetY);

        // --- BƯỚC 5: HIỆU CHỈNH TỐC ĐỘ CHUỘT VÀ TỈ LỆ 1:1 ---
        const velocityMagnitude = Math.sqrt(
          oneEuroStateX.current.derivative ** 2 + oneEuroStateY.current.derivative ** 2,
        );
        const PRECISION_GAIN_MIN = 0.25; // gain khi gần như đứng yên — chỉnh nhỏ hơn để canh dễ hơn
        const PRECISION_GAIN_MAX = 1.0; // gain khi di chuyển nhanh — giữ tốc độ cũ
        const VELOCITY_GAIN_THRESHOLD = 3.5; // vận tốc (đơn vị/giây) để đạt full gain, tune 1.0-2.5
        const targetGain =
          PRECISION_GAIN_MIN +
          (PRECISION_GAIN_MAX - PRECISION_GAIN_MIN) * Math.min(1, velocityMagnitude / VELOCITY_GAIN_THRESHOLD);
        smoothedGainRef.current += 0.15 * (targetGain - smoothedGainRef.current); // 0.15 = tốc độ lọc gain

        const speedCurvedX = applySpeedCurve(finalSteppedX, baseMouseSpeedFactor * smoothedGainRef.current);
        const speedCurvedY = applySpeedCurve(finalSteppedY, baseMouseSpeedFactor * smoothedGainRef.current);

        const rawPixelX = Math.max(0, Math.min(window.innerWidth, speedCurvedX * window.innerWidth));
        const rawPixelY = Math.max(0, Math.min(window.innerHeight, speedCurvedY * window.innerHeight));

        const PIXEL_SMOOTHING = 0.05; // càng nhỏ càng mượt nhưng càng trễ, tune trong khoảng 0.15-0.4
        smoothedPixelRef.current.x += PIXEL_SMOOTHING * (rawPixelX - smoothedPixelRef.current.x);
        smoothedPixelRef.current.y += PIXEL_SMOOTHING * (rawPixelY - smoothedPixelRef.current.y);

        const finalPixelPositionX = smoothedPixelRef.current.x;
        const finalPixelPositionY = smoothedPixelRef.current.y;

        // Phản hồi phần cứng UI trực tiếp qua biến đổi translate3d tăng tốc GPU mượt mà 60 FPS
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate3d(${finalPixelPositionX}px, ${finalPixelPositionY}px, 0)`;
        }

        const elementAtCursorPoint = document.elementFromPoint(finalPixelPositionX, finalPixelPositionY);

        // --- BƯỚC 6: XỬ LÝ KÉO & THẢ QUA BIỂU CẢM HÁ MIỆNG (SCHMITT TRIGGER / HYSTERESIS) ---
        const mouthDeltaX = topLipCenterLandmark.x - bottomLipCenterLandmark.x;
        const mouthDeltaY = topLipCenterLandmark.y - bottomLipCenterLandmark.y;
        const mouthScaleFactor = Math.min(4.0, Math.max(0.4, rawDepthRatio));
        const currentMouthGapDistance =
          Math.sqrt(mouthDeltaX * mouthDeltaX + mouthDeltaY * mouthDeltaY) * mouthScaleFactor;

        // Đồng bộ hóa biên độ hiệu chuẩn "Mở thoải mái" cá nhân hóa để chống mỏi hàm sinh học
        const personalComfortThreshold = (userPreferences?.mouthDragThreshold ?? 0.03) * scaleDepthFactor;
        const schmittTriggerDragThreshold = personalComfortThreshold; // 100% Mốc mỏ neo mở thoải mái
        const schmittTriggerDropThreshold = personalComfortThreshold * 0.3; // 50% Mốc mỏ neo mở thoải mái

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
          const VIEWPORT_EDGE_BUFFER_ZONE = 80; // Vùng đệm biên cấu hình cố định 80px
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
