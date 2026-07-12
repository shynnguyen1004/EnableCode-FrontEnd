import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useI18n } from '../i18n/I18nProvider';
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

// ===== ONE EURO FILTER (Casiez, Roussel, Vogel — 2012) =====
// Low-pass filter với cutoff frequency thích ứng theo tốc độ thay đổi của tín hiệu:
// đứng yên (tốc độ thấp) -> cutoff thấp -> lọc mạnh, triệt jitter gần như hoàn toàn.
// di chuyển nhanh -> cutoff tăng theo beta*|dx| -> lọc yếu đi -> giảm lag, bám sát chuyển động thật.
// Đây là lý do KHÔNG cần thêm state machine "isMovingIntentionally" hay deadzone thủ công nữa:
// bản thân filter đã tự chuyển đổi mượt giữa 2 chế độ dựa trên đạo hàm tín hiệu.
type OneEuroState = { value: number; derivative: number; lastTimeSec: number; initialized: boolean };

const oneEuroSmoothingFactor = (samplingRateHz: number, cutoffHz: number): number => {
  const r = (2 * Math.PI * cutoffHz) / samplingRateHz;
  return r / (r + 1);
};

const oneEuroExponentialSmoothing = (alpha: number, x: number, xPrev: number): number =>
  alpha * x + (1 - alpha) * xPrev;

/**
 * Áp dụng One Euro Filter cho 1 mẫu tín hiệu mới.
 * @param state       state nội bộ của filter (mutate tại chỗ, giữ nguyên giữa các lần gọi)
 * @param x           giá trị thô (nhiễu) của frame hiện tại
 * @param timeSec     timestamp hiện tại tính bằng GIÂY (bắt buộc đơn vị giây để cutoff tính đúng theo Hz)
 * @param minCutoffHz cutoff tối thiểu (Hz) — GIẢM để triệt jitter mạnh hơn lúc đứng yên, tăng lag lúc đứng yên
 * @param beta        hệ số tốc độ — TĂNG để giảm lag lúc di chuyển nhanh, tăng nhạy với nhiễu tốc độ cao
 * @param derivativeCutoffHz cutoff cho bộ lọc đạo hàm (mặc định 1Hz theo paper gốc, hiếm khi cần đổi)
 */
const oneEuroFilter = (
  state: OneEuroState,
  x: number,
  timeSec: number,
  minCutoffHz: number,
  beta: number,
  derivativeCutoffHz = 1.0,
): number => {
  if (!state.initialized) {
    // Frame đầu tiên: chưa có t_prev hợp lệ để tính dt -> khởi tạo trực tiếp bằng giá trị thô,
    // đạo hàm = 0 (đứng yên tuyệt đối tại điểm khởi tạo).
    state.value = x;
    state.derivative = 0;
    state.lastTimeSec = timeSec;
    state.initialized = true;
    return x;
  }

  const dt = Math.max(timeSec - state.lastTimeSec, 1e-6); // tránh chia 0 nếu 2 frame trùng timestamp
  const samplingRateHz = 1 / dt;

  // Đạo hàm thô + lọc đạo hàm (dùng derivativeCutoffHz cố định)
  const rawDerivative = (x - state.value) / dt;
  const alphaDerivative = oneEuroSmoothingFactor(samplingRateHz, derivativeCutoffHz);
  const smoothedDerivative = oneEuroExponentialSmoothing(alphaDerivative, rawDerivative, state.derivative);

  // Cutoff thích ứng: minCutoffHz khi đứng yên, tăng dần theo beta * |derivative| khi di chuyển nhanh
  const adaptiveCutoffHz = minCutoffHz + beta * Math.abs(smoothedDerivative);
  const alphaValue = oneEuroSmoothingFactor(samplingRateHz, adaptiveCutoffHz);
  const smoothedValue = oneEuroExponentialSmoothing(alphaValue, x, state.value);

  state.value = smoothedValue;
  state.derivative = smoothedDerivative;
  state.lastTimeSec = timeSec;
  return smoothedValue;
};

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
  const depthRatioRef = useRef<number>(0); // EMA cho mouth gap (normalize theo faceWidth) — chống nhiễu tức thời khi phát hiện há miệng
  const faceNotDetectedTimerRef = useRef<number | null>(null);
  const [showFaceWarning, setShowFaceWarning] = useState(false);

  // State chuẩn cho One Euro Filter (Casiez et al.) — mỗi trục X/Y một state độc lập.
  // value = x_prev (giá trị đã lọc của frame trước), derivative = dx_prev (đạo hàm đã lọc của frame trước),
  // initialized = false ở frame đầu tiên vì chưa có dx_prev/t_prev hợp lệ để tính đạo hàm.
  const oneEuroStateX = useRef({ value: 0.5, derivative: 0, lastTimeSec: 0, initialized: false });
  const oneEuroStateY = useRef({ value: 0.5, derivative: 0, lastTimeSec: 0, initialized: false });

  // Buffer 3 giá trị gần nhất cho median-of-3 spike rejection — chỉ dùng cho mouth gap (cursor dùng One Euro Filter)
  const mouthGapMedianBufferRef = useRef({ a: 0, b: 0, c: 0 });

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

    let isActive = true;
    let faceLandmarker: FaceLandmarker | null = null;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let lastVideoTime = -1;

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

    // processFrame chứa toàn bộ logic xử lý 1 kết quả detect — giữ nguyên logic gốc,
    // chỉ đổi nguồn landmarks từ FaceMesh (Solutions API cũ) sang FaceLandmarker (Tasks API mới).
    const processFrame = (landmarks: NormalizedLandmark[], currentTimeMs: number) => {
      {
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

          // X: cả chọn nhánh lẫn nội suy đều dùng driftAwareRotX (đã bù lệch tâm) — trước đây chỉ dùng để chọn
          // nhánh, còn nội suy vẫn dùng rotX gốc nên khi ngồi lệch trái/phải, bù trôi không phát huy tác dụng
          // đầy đủ (chuột vẫn lệch theo hướng ngồi lệch dù đã tính driftAwareRotX).
          if (driftAwareRotX > center.x) {
            const denom = left.x - center.x;
            const factor = denom !== 0 ? (driftAwareRotX - center.x) / denom : 0;
            percentX = 0.5 - 0.5 * Math.max(0, Math.min(1, factor));
          } else {
            const denom = right.x - center.x;
            const factor = denom !== 0 ? (driftAwareRotX - center.x) / denom : 0;
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

        // --- BƯỚC 4B: LÀM MƯỢT CURSOR — One Euro Filter chuẩn (Casiez et al.), áp dụng độc lập cho X và Y.
        // Thay thế toàn bộ cụm cũ (velocity clamp + EMA + state machine "isMovingIntentionally" + deadzone
        // snap thủ công): filter này TỰ thích ứng cutoff theo tốc độ tín hiệu, nên không cần dựng thêm state
        // machine hay ngưỡng deadzone riêng để phân biệt "đứng yên" vs "đang di chuyển" — bản chất toán học
        // của filter đã làm việc đó liên tục, mượt (không có bước nhảy rời rạc do snap).
        //
        // CURSOR_MIN_CUTOFF_HZ: cutoff khi đứng yên (đạo hàm ~0). Giảm giá trị này để triệt jitter mạnh hơn
        // lúc đứng yên, đổi lại lag nhích lên chút khi bắt đầu di chuyển chậm. 0.5Hz là điểm khởi đầu hợp lý
        // cho tín hiệu vị trí cursor (tương tự khuyến nghị gốc của paper cho chuyển động tay/con trỏ).
        // CURSOR_BETA: hệ số phản ứng theo tốc độ. Tăng để giảm lag khi di chuyển nhanh (đổi lại nhạy nhiễu
        // hơn ở tốc độ cao — nhưng nhiễu tốc độ cao thường không đáng chú ý bằng jitter lúc đứng yên).
        const CURSOR_MIN_CUTOFF_HZ = 0.01;
        const CURSOR_BETA = 0.5;
        const timeSec = currentTimeMs / 1000;
        const smoothedX = oneEuroFilter(oneEuroStateX.current, percentX, timeSec, CURSOR_MIN_CUTOFF_HZ, CURSOR_BETA);
        const smoothedY = oneEuroFilter(oneEuroStateY.current, percentY, timeSec, CURSOR_MIN_CUTOFF_HZ, CURSOR_BETA);

        // --- BƯỚC 4C: NGƯỠNG HÁ MIỆNG — normalize theo faceWidth (đã tự bù khoảng cách camera, cùng cơ chế
        // như rotX/rotY ở BƯỚC 2). Dùng median-of-3 ở đây vì mouth-gap không cần bám sát tức thời như cursor,
        // độ trễ nhỏ 1-2 frame chấp nhận được để đổi lấy chống spike tốt hơn cho việc phát hiện há miệng.
        const medianOf3 = (buffer: { a: number; b: number; c: number }, next: number) => {
          const { a, b, c } = buffer;
          buffer.a = b;
          buffer.b = c;
          buffer.c = next;
          return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
        };
        const mouthDeltaX = lipTop.x - lipBottom.x;
        const mouthDeltaY = lipTop.y - lipBottom.y;
        const rawMouthGap = Math.sqrt(mouthDeltaX * mouthDeltaX + mouthDeltaY * mouthDeltaY) / faceWidth;
        const medianMouthGap = medianOf3(mouthGapMedianBufferRef.current, rawMouthGap);

        const MOUTH_GAP_SMOOTHING = 0.35; // tune: nhỏ hơn = chống nhiễu mạnh hơn nhưng phản ứng há miệng chậm hơn
        depthRatioRef.current += MOUTH_GAP_SMOOTHING * (medianMouthGap - depthRatioRef.current); // tái dùng ref làm EMA mouth gap
        const currentMouthGapDistance = depthRatioRef.current;

        // Đồng bộ hóa biên độ hiệu chuẩn "Mở thoải mái" cá nhân hóa để chống mỏi hàm sinh học
        const personalComfortThreshold = userPreferences?.mouthDragThreshold ?? 0.03;
        const schmittTriggerDragThreshold = personalComfortThreshold; // 100% Mốc mỏ neo mở thoải mái
        const schmittTriggerDropThreshold = personalComfortThreshold * 0.5; // 50% Mốc mỏ neo mở thoải mái

        // --- BƯỚC 5: MAPPING TỐC ĐỘ — nhân tuyến tính đơn giản quanh tâm, KHÔNG dùng gain curve phi tuyến.
        // Lý do bỏ gain curve hyperbol kiểu cũ: nó áp dụng RIÊNG trên từng trục X/Y, nên khi mũi di chuyển theo
        // đường chéo, tỉ lệ khuếch đại X và Y khác nhau tại từng thời điểm → méo hướng di chuyển thành hyperbol.
        // Power curve dưới đây áp dụng lên MAGNITUDE (khoảng cách từ tâm), rồi chia đều lại cho X và Y theo cùng
        // 1 hệ số — nghĩa là HƯỚNG vector từ tâm không đổi, chỉ ĐỘ DÀI thay đổi. Path do đó luôn thẳng, không méo.
        // power=1 (speed=1): tuyến tính hoàn toàn. power<1 (speed>1): nhạy hơn ở gần tâm. power>1 (speed<1): kém
        // nhạy hơn ở gần tâm — nhưng LUÔN đạt đúng 0/1 khi input đạt đúng biên calib, ở MỌI mức speed.
        // BUG ĐÃ SỬA: dùng magnitude Euclid (hình tròn, chuẩn hóa theo bán kính 0.5) để chuẩn hóa, nhưng vùng
        // khả dụng thật của percentX/Y là HÌNH VUÔNG [0,1]x[0,1] — ở góc màn hình, magnitude Euclid = 0.5*sqrt(2)
        // (~0.707) luôn bị clamp về 1 khi chia cho 0.5, khiến curvedMagnitude luôn = 0.5 bất kể speed → chuột
        // dừng cứng ở ~85% màn hình, tạo thành 1 hình chữ nhật bo góc, không bao giờ chạm 4 góc thật.
        // Fix: dùng Chebyshev norm (max(|dx|,|dy|)) — khớp đúng hình vuông, nên tại góc màn hình (dx=dy=0.5),
        // magnitude = 0.5 = đúng max khả dĩ, không bị clamp sai, curvedMagnitude đạt đúng 0.5 => chạm góc thật.
        const applySpeedGain = (x: number, y: number, speed: number) => {
          const dx = x - 0.5;
          const dy = y - 0.5;
          const magnitude = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev norm, khớp vùng vuông [0,1]x[0,1]
          if (magnitude === 0) return { x: 0.5, y: 0.5 };

          const safeSpeed = Math.max(0.3, Math.min(2, speed));
          const power = 1 / safeSpeed; // speed=1 -> power=1 (tuyến tính); speed=2 -> power=0.5 (nhạy hơn ở tâm); speed=0.5 -> power=2 (kém nhạy hơn ở tâm)
          const normalizedMagnitude = Math.min(1, magnitude / 0.5); // magnitude=0.5 luôn tương ứng đúng biên (cạnh hoặc góc) của hình vuông
          const curvedMagnitude = Math.pow(normalizedMagnitude, power) * 0.5;
          const scale = curvedMagnitude / magnitude;

          return {
            x: 0.5 + dx * scale,
            y: 0.5 + dy * scale,
          };
        };

        const isNearEdge = smoothedX < 0.08 || smoothedX > 0.92 || smoothedY < 0.08 || smoothedY > 0.92;
        const dragSpeedMultiplier = isDraggingRef.current && !isNearEdge ? 0.5 : 1.0;

        const gained = applySpeedGain(smoothedX, smoothedY, userSpeed * dragSpeedMultiplier);
        const gainedX = Math.max(0, Math.min(1, gained.x));
        const gainedY = Math.max(0, Math.min(1, gained.y));

        const finalPixelPositionX = Math.max(0, Math.min(window.innerWidth, gainedX * window.innerWidth));
        const finalPixelPositionY = Math.max(0, Math.min(window.innerHeight, gainedY * window.innerHeight));

        // Phản hồi phần cứng UI trực tiếp qua biến đổi translate3d tăng tốc GPU mượt mà 60 FPS
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate3d(${finalPixelPositionX}px, ${finalPixelPositionY}px, 0)`;
        }

        const elementAtCursorPoint = document.elementFromPoint(finalPixelPositionX, finalPixelPositionY);

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
                oneEuroStateX.current.derivative = 0;
                oneEuroStateY.current.derivative = 0;
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
          const VIEWPORT_EDGE_BUFFER_ZONE = 130; // Vùng đệm biên cấu hình cố định 80px
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
      }
    };

    const handleNoFaceDetected = () => {
      canvasCtx.restore();
      if (!faceNotDetectedTimerRef.current) {
        faceNotDetectedTimerRef.current = window.setTimeout(() => {
          setShowFaceWarning(true);
        }, 600);
      }
    };

    // Vòng lặp detect chính — dùng requestAnimationFrame + detectForVideo (Tasks API),
    // thay cho Camera utils + onResults callback (Solutions API cũ, đã deprecated).
    // runningMode: 'VIDEO' cho phép FaceLandmarker tự áp dụng temporal filtering giữa các
    // frame liên tiếp (dựa trên timestamp) — giảm nhiễu landmark ngay tại tầng model,
    // trước khi tới bất kỳ EMA/deadzone nào ở phía sau.
    const renderLoop = () => {
      if (!isActive || !faceLandmarker) return;
      rafId = requestAnimationFrame(renderLoop);

      const currentTimeMs = performance.now();
      // Giới hạn tần suất xử lý khung hình tối đa để cân bằng năng lượng CPU
      if (currentTimeMs - lastFrameTimeRef.current < 16) return;

      if (videoElement.readyState < 2 || videoElement.currentTime === lastVideoTime) return;
      lastVideoTime = videoElement.currentTime;

      const results = faceLandmarker.detectForVideo(videoElement, currentTimeMs);

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.scale(-1, 1);
      canvasCtx.drawImage(videoElement, -canvasElement.width, 0, canvasElement.width, canvasElement.height);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        if (faceNotDetectedTimerRef.current) {
          clearTimeout(faceNotDetectedTimerRef.current);
          faceNotDetectedTimerRef.current = null;
        }
        setShowFaceWarning(false);
        processFrame(landmarks, currentTimeMs);
      } else {
        handleNoFaceDetected();
      }
    };

    const setup = async () => {
      // WASM runtime của Tasks API, tải qua CDN jsdelivr (thay cho package @mediapipe/face_mesh cũ đã deprecated)
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
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

      if (!isActive) return;

      // Tăng resolution camera 320x240 -> 1280x720: giảm nhiễu landmark ngay từ đầu vào,
      // vì model có nhiều chi tiết ảnh hơn để định vị điểm mốc chính xác hơn ở mức sub-pixel.
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (!isActive) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      videoElement.srcObject = stream;
      await videoElement.play();

      rafId = requestAnimationFrame(renderLoop);
    };

    void setup();

    return () => {
      isActive = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (faceLandmarker) void faceLandmarker.close();
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
