import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useI18n } from '../i18n/I18nProvider';
import { useCalibration } from '../context/CalibrationContext';
import { useEyeTracking } from '../context/EyeTrackingContext';

// Blockly bị code-split nên Workspace.getAll() không thấy chunk khác — đọc registry
// từ window.__activeBlocklyWorkspaces (do BlocklyEditor.tsx quản lý) thay thế.
interface BlocklyFlyoutLike {
  getWorkspace?: () => BlocklyWorkspaceLike | undefined;
}

interface BlocklyWorkspaceLike {
  scrollX: number;
  scrollY: number;
  scroll: (x: number, y: number) => void;
  getInjectionDiv?: () => HTMLElement | undefined;
  getFlyout?: () => BlocklyFlyoutLike | null | undefined;
}

declare global {
  interface Window {
    __activeBlocklyWorkspaces?: Set<BlocklyWorkspaceLike>;
  }
}

type ActionKind = 'moving' | 'click' | 'drag' | 'drop' | 'scrollUp' | 'scrollDown';

const ACTION_LABEL_KEYS: Record<ActionKind, string> = {
  moving: 'faceControl.moving',
  click: 'faceControl.click',
  drag: 'faceControl.drag',
  drop: 'faceControl.drop',
  scrollUp: 'faceControl.scrollUp',
  scrollDown: 'faceControl.scrollDown',
};

// ===== ONE EURO FILTER (Casiez, Roussel, Vogel — 2012) =====
// Cutoff tự thích ứng theo tốc độ tín hiệu: đứng yên lọc mạnh, di chuyển nhanh lọc yếu để giảm lag.
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

  // One Euro Filter cho landmark MŨI THÔ (nose.x, nose.y), lọc TRƯỚC khi tính rotX/rotY — tức TRƯỚC phép
  // chia cho denom (faceWidth/faceHeight, hoặc denom nhỏ trong mapping calib top/bottom/left/right).
  // Lý do: nếu chỉ lọc percentY (SAU khi đã chia cho denom, như tầng percent cũ từng làm), nhiễu ở numerator
  // đã bị khuếch đại HÀNG CHỤC LẦN trước khi tới bộ lọc đó — lọc sau chỉ làm mượt phần "ngọn" của spike,
  // không ngăn được biên độ spike ban đầu. Lọc ngay tại nguồn (nose thô) giảm nhiễu ở nơi CHƯA bị khuếch
  // đại, hiệu quả hơn nhiều lần so với lọc ở tầng percentY, đặc biệt khi denom (biên độ calib) nhỏ.
  const oneEuroStateNoseX = useRef({ value: 0.5, derivative: 0, lastTimeSec: 0, initialized: false });
  const oneEuroStateNoseY = useRef({ value: 0.5, derivative: 0, lastTimeSec: 0, initialized: false });

  // One Euro Filter RIÊNG cho mouth gap dùng để bù faceHeight (KHÁC với currentMouthGapDistance/depthRatioRef
  // — cái đó vẫn dùng EMA thường cho ngưỡng drag/drop, không đổi). Cần bộ lọc này vì: nếu không lọc gì,
  // dao động nhiễu tự nhiên của mouth gap lúc GIỮ há (drag) truyền thẳng vào faceHeight mỗi frame, cộng dồn
  // với chuyển động đầu thật -> giật mạnh khi vừa há vừa di chuyển. Nhưng nếu lọc bằng EMA thường (trễ pha)
  // thì lúc CHUYỂN trạng thái ngậm<->há lại bị delay, gây lệch cursor tạm thời (vấn đề đã sửa trước đó).
  // One Euro giải quyết cả 2: minCutoff thấp -> lọc mượt dao động nhỏ lúc giữ ổn định (giảm nhiễu-giật khi
  // drag); beta cao -> phản ứng nhanh khi mouth gap đổi NHANH (giảm trễ pha lúc bắt đầu/kết thúc há miệng).
  const oneEuroStateMouthGap = useRef({ value: 0, derivative: 0, lastTimeSec: 0, initialized: false });

  // EMA cho kích thước hình học khuôn mặt (faceWidth, faceHeight trán-cằm đã bù mouth gap) — dùng làm
  // MẪU SỐ của rotX/rotY. Làm mượt tại đây để denominator ổn định giữa 2 trục, tránh nhiễu landmark
  // bị khuếch đại vào rotY.
  const faceWidthEmaRef = useRef<number>(0.2);
  const faceHeightEmaRef = useRef<number>(0.25);

  // One Euro Filter RIÊNG cho rotX/rotY, áp NGAY SAU khi tính (trước mapping calib ở BƯỚC 3).
  // Khác nguồn nhiễu với oneEuroStateNoseX/Y ở trên: bộ lọc nose thô chỉ triệt nhiễu LANDMARK (input mũi),
  // còn nhiễu sinh ra bởi chính phép chia cho faceHeight (mẫu số dao động hình học — EMA faceHeight, bù
  // mouth gap, MIN_FACE_HEIGHT_RATIO clamp...) vẫn truyền thẳng vào rotY mà không qua bộ lọc nào. Đây là
  // nhiễu ở tầng "hình học" (geometry), phát sinh SAU phép chia, khác nguồn với nhiễu landmark ở numerator
  // -> cần 1 tầng lọc riêng đặt sau, không thể gộp chung vào oneEuroStateNoseX/Y phía trên.
  const oneEuroStateRotX = useRef({ value: 0, derivative: 0, lastTimeSec: 0, initialized: false });
  const oneEuroStateRotY = useRef({ value: 0, derivative: 0, lastTimeSec: 0, initialized: false });

  // Buffer 3 giá trị gần nhất cho median-of-3 spike rejection — chỉ dùng cho mouth gap (cursor dùng One Euro Filter)
  const mouthGapMedianBufferRef = useRef({ a: 0, b: 0, c: 0 });

  // Lưu trữ vị trí dispatch sự kiện DOM gần nhất nhằm phục vụ cơ chế Throttle di chuyển (Delta d > 5px)
  const lastDispatchedPosition = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastDomScanTimeRef = useRef<number>(0);
  // Vị trí pixel HIỆN TẠI của cursor sau khi đã áp velocity clamp — mốc để tính delta cho frame kế tiếp.
  // Khác lastDispatchedPosition (chỉ cập nhật khi thực sự dispatch), ref này cập nhật MỌI frame.
  const currentCursorPixelRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  // Timestamp riêng cho velocity clamp — KHÔNG dùng chung lastFrameTimeRef vì ref đó được set NGAY ĐẦU
  // renderLoop (trước khi processFrame chạy trong cùng frame), nên nếu dùng chung, deltaSec luôn ~= 0.
  const lastVelocityClampTimeRef = useRef<number>(0);

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

    // Blockly là <svg>, tự quản lý cuộn qua workspace.scroll(x,y) riêng, không phải scrollBy DOM.
    // ScrollTarget gộp 2 loại để phần gọi scroll không cần biết đang xử lý loại nào.
    type ScrollTarget =
      | { kind: 'dom'; element: Element }
      | { kind: 'blockly'; element: Element; workspace: BlocklyWorkspaceLike };

    // Tìm flyout Blockly chứa `element` (chỉ flyout cần cuộn, không phải workspace chính).
    // So khớp bằng getInjectionDiv() của từng flyout workspace để xác nhận nó thực sự chứa element.
    const findBlocklyTargetForElement = (
      element: Element,
    ): { workspace: BlocklyWorkspaceLike; svgRoot: Element } | null => {
      const activeWorkspaces = window.__activeBlocklyWorkspaces;
      if (!activeWorkspaces || activeWorkspaces.size === 0) return null;

      const flyoutDescendant = element.closest('[class*="blocklyFlyout"]');
      if (!flyoutDescendant) return null;

      const svgRoot = element.closest('svg');
      if (!svgRoot) return null;

      for (const ws of activeWorkspaces) {
        const flyoutWorkspace = ws.getFlyout?.()?.getWorkspace?.();
        const flyoutInjectionDiv = flyoutWorkspace?.getInjectionDiv?.();
        if (flyoutWorkspace && flyoutInjectionDiv?.contains(flyoutDescendant)) {
          return { workspace: flyoutWorkspace, svgRoot };
        }
      }
      return null;
    };

    const getScrollableParent = (element: Element | null): ScrollTarget | null => {
      if (!element) return null;

      const blocklyTarget = findBlocklyTargetForElement(element);
      if (blocklyTarget) {
        return { kind: 'blockly', element: blocklyTarget.svgRoot, workspace: blocklyTarget.workspace };
      }

      const style = window.getComputedStyle(element);
      const overflowY = style.overflowY;
      const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
      const canScroll = element.scrollHeight > element.clientHeight;

      if (isScrollable && canScroll && element !== document.documentElement) {
        return { kind: 'dom', element };
      }
      return getScrollableParent(element.parentElement);
    };

    // processFrame chứa toàn bộ logic xử lý 1 kết quả detect — giữ nguyên logic gốc,
    // chỉ đổi nguồn landmarks từ FaceMesh (Solutions API cũ) sang FaceLandmarker (Tasks API mới).
    const processFrame = (landmarks: NormalizedLandmark[], currentTimeMs: number) => {
      {
        // --- BƯỚC 1: TRÍCH XUẤT LANDMARK CỐT LÕI ---
        const nose = landmarks[4]; // Đầu mũi — tâm laser-pointer
        const cheekL = landmarks[116]; // Má trái — neo hộp sọ
        const cheekR = landmarks[345]; // Má phải — neo hộp sọ
        const forehead = landmarks[10]; // Trán — điểm neo ổn định hình học
        const chin = landmarks[152]; // Cằm — neo dưới cho faceHeight, cần bù trừ mouth gap vì mô mềm dịch theo miệng
        const lipTop = landmarks[13]; // Môi trên
        const lipBottom = landmarks[14]; // Môi dưới

        if (!nose || !cheekL || !cheekR || !forehead || !chin) {
          canvasCtx.restore();
          return;
        }

        // Vẽ các điểm neo cốt lõi lên Canvas preview
        const essentialIndices = [4, 13, 14, 10, 152, 116, 345];
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

        // --- BƯỚC 2A: NGƯỠNG HÁ MIỆNG — normalize theo faceWidth. Dùng median-of-3 để chống spike.
        // Tính TRƯỚC faceHeight vì cần dùng mouth gap để bù trừ độ giãn nở trán-cằm khi há miệng.
        const timeSec = currentTimeMs / 1000; // khai báo sớm để dùng chung cho One Euro Filter mouth gap + cursor
        const medianOf3 = (buffer: { a: number; b: number; c: number }, next: number) => {
          const { a, b, c } = buffer;
          buffer.a = b;
          buffer.b = c;
          buffer.c = next;
          return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
        };
        const mouthDeltaX = lipTop.x - lipBottom.x;
        const mouthDeltaY = lipTop.y - lipBottom.y;
        const rawMouthGapPixels = Math.sqrt(mouthDeltaX * mouthDeltaX + mouthDeltaY * mouthDeltaY); // đơn vị normalized landmark thô, CHƯA chia faceWidth

        // Lọc rawMouthGapPixels bằng One Euro Filter TRƯỚC KHI dùng để bù faceHeight (ở BƯỚC 2B bên dưới).
        // minCutoff thấp -> triệt dao động nhiễu nhỏ khi GIỮ há miệng ổn định lúc drag, tránh giật khi vừa
        // há vừa di chuyển đầu. beta cao -> vẫn phản ứng nhanh khi mouth gap đổi NHANH (lúc bắt đầu/kết
        // thúc há miệng), tránh trễ pha giống vấn đề EMA thường đã gặp trước đó. Đây LÀ filter riêng, KHÔNG
        // dùng chung với currentMouthGapDistance (vẫn EMA thường, dùng cho ngưỡng drag/drop, giữ nguyên).
        const MOUTH_GAP_COMPENSATION_MIN_CUTOFF_HZ = 0.6;
        const MOUTH_GAP_COMPENSATION_BETA = 8;
        const smoothedMouthGapPixels = oneEuroFilter(
          oneEuroStateMouthGap.current,
          rawMouthGapPixels,
          timeSec,
          MOUTH_GAP_COMPENSATION_MIN_CUTOFF_HZ,
          MOUTH_GAP_COMPENSATION_BETA,
        );

        const rawMouthGapNormalized = rawMouthGapPixels / (Math.abs(cheekR.x - cheekL.x) || 1); // dùng faceWidth thô vì faceWidth EMA chưa tính ở bước này
        const medianMouthGap = medianOf3(mouthGapMedianBufferRef.current, rawMouthGapNormalized);

        const MOUTH_GAP_SMOOTHING = 0.35; // tune: nhỏ hơn = chống nhiễu mạnh hơn nhưng phản ứng há miệng chậm hơn
        depthRatioRef.current += MOUTH_GAP_SMOOTHING * (medianMouthGap - depthRatioRef.current); // tái dùng ref làm EMA mouth gap
        const currentMouthGapDistance = depthRatioRef.current; // normalized theo faceWidth — dùng cho ngưỡng drag/drop

        // --- BƯỚC 2B: TÍN HIỆU GÓC XOAY ĐẦU (tự chuẩn hóa theo khoảng cách camera) ---
        const faceCenterX = (cheekL.x + cheekR.x) / 2;
        const rawFaceWidth = Math.abs(cheekR.x - cheekL.x) || 1;

        // faceHeight đo trực tiếp trán-cằm (chính xác hơn suy luận qua má), NHƯNG khi há miệng, môi dưới
        // kéo giãn mô mềm khiến khoảng trán-cằm phình ra theo đúng bằng khoảng miệng đã mở ra — gây cursor
        // trôi lệch dù đầu không di chuyển.
        //
        // QUAN TRỌNG — thứ tự EMA vs bù trừ: faceHeight gánh 2 vai trò xung đột nhau — (1) EMA chậm để lọc
        // nhiễu landmark thuần túy (ổn định lâu dài), và (2) bù mouth gap cần phản ứng TỨC THỜI (ngậm miệng
        // lại là phải về giá trị đầy đủ ngay lập tức). Nếu trừ mouth gap RỒI MỚI đưa qua EMA (như trước),
        // lúc ngậm miệng lại, faceHeight-đã-bù nhảy vọt về giá trị đầy đủ ngay, nhưng EMA cần vài frame mới
        // đuổi kịp -> trong lúc đó faceHeight (mẫu số) vẫn còn NHỎ hơn thực tế -> rotY bị phóng đại -> cursor
        // lệch xuống sau một khoảng delay đúng bằng thời gian EMA đuổi kịp. Đây là nguồn jitter có độ trễ.
        //
        // Sửa: EMA CHỈ chạy trên rawChinForeheadHeight thô (chưa bù mouth) để lọc nhiễu landmark nền tảng.
        // Việc bù mouth gap thực hiện SAU EMA, trừ trực tiếp mỗi frame — không đi qua bộ lọc nào cả, nên
        // luôn tức thời và không có trễ pha dù há hay ngậm miệng.
        const rawChinForeheadHeight = Math.abs(chin.y - forehead.y) || 1;

        // faceWidth (khoảng cách má-má theo X) là phép đo trực tiếp 1 cạnh ổn định -> jitter thấp.
        // rawChinForeheadHeight (trán-cằm) vẫn là hiệu của 2 tọa độ Y nên còn nhiễu landmark gốc
        // -> cần EMA làm mượt để denominator ổn định ngang nhau giữa 2 trục.
        const GEOMETRY_SMOOTHING = 0.15;
        faceWidthEmaRef.current += GEOMETRY_SMOOTHING * (rawFaceWidth - faceWidthEmaRef.current);
        faceHeightEmaRef.current += GEOMETRY_SMOOTHING * (rawChinForeheadHeight - faceHeightEmaRef.current);

        // Bù mouth gap SAU EMA của faceHeight, dùng giá trị ĐÃ QUA One Euro Filter (không phải raw thô nữa)
        // để vừa tức thời khi chuyển trạng thái vừa mượt khi giữ ổn định lúc drag (xem giải thích ở BƯỚC 2A).
        // Nhân với mouthCompensationRatio ĐO RIÊNG cho từng user ở bước calibration (điểm há miệng),
        // vì cằm (xương) dịch chuyển ÍT HƠN mouth gap (mô mềm) theo tỷ lệ khác nhau giữa từng khuôn mặt —
        // trừ nguyên 1:1 (hệ số 1.0) sẽ trừ thừa và làm faceHeight nhỏ hơn thực tế, khiến rotY bị phóng đại.
        const mouthCompensationRatio = userPreferences?.mouthCompensationRatio ?? 0.3;
        const MIN_FACE_HEIGHT_RATIO = 0.5; // sàn an toàn: nếu há miệng cực to, tránh faceHeight về gần 0/âm
        const faceWidth = faceWidthEmaRef.current || 1;
        const faceHeight =
          Math.max(
            faceHeightEmaRef.current - smoothedMouthGapPixels * mouthCompensationRatio,
            faceHeightEmaRef.current * MIN_FACE_HEIGHT_RATIO,
          ) || 1;
        const faceCenterY = forehead.y + faceHeight * 0.5;

        // Lọc landmark MŨI THÔ bằng One Euro Filter TRƯỚC khi tính rotX/rotY — tức TRƯỚC phép chia cho
        // denom. Đây là điểm mấu chốt: numerator (nose.y - faceCenterY) trước đây dùng nose.y thô 100%,
        // nên nhiễu landmark truyền thẳng vào rotY rồi bị KHUẾCH ĐẠI qua phép chia (đặc biệt khi denom của
        // mapping calib nhỏ, đã đo được ở log debug: denom top/bottom chỉ ~0.02-0.04). Lọc percentY sau khi
        // chia (tầng percent cũ, nay đã bỏ) chỉ làm mượt "ngọn" của spike đã bị khuếch đại, không hiệu quả.
        // Lọc nose thô ở đây giảm nhiễu TẠI NGUỒN, trước khi bị nhân lên hàng chục lần.
        const NOSE_MIN_CUTOFF_HZ = 0.1;
        const NOSE_BETA = 5;
        const smoothedNoseX = oneEuroFilter(oneEuroStateNoseX.current, nose.x, timeSec, NOSE_MIN_CUTOFF_HZ, NOSE_BETA);
        const smoothedNoseY = oneEuroFilter(oneEuroStateNoseY.current, nose.y, timeSec, NOSE_MIN_CUTOFF_HZ, NOSE_BETA);

        // rotX/rotY: tỉ lệ lệch mũi so với tâm mặt — cùng co giãn theo khoảng cách nên không cần bù thêm
        const rawRotX = (smoothedNoseX - faceCenterX) / faceWidth;
        const rawRotY = (smoothedNoseY - faceCenterY) / faceHeight;

        // Lọc rotX/rotY NGAY SAU khi tính, TRƯỚC khi vào mapping calib (BƯỚC 3). Nhiễu ở đây khác nguồn với
        // nhiễu landmark đã lọc ở oneEuroStateNoseX/Y phía trên: đây là nhiễu sinh ra bởi chính phép CHIA
        // cho faceHeight — faceHeight dao động do EMA hình học, do bù mouth gap tức thời, do clamp
        // MIN_FACE_HEIGHT_RATIO — nên dù numerator đã sạch, denom dao động vẫn khuếch đại thành nhiễu ở
        // rotY. Cutoff thấp hơn & beta thấp hơn tầng nose (numerator đã sạch sẵn, tầng này chỉ cần dọn nốt
        // phần nhiễu hình học còn sót, không cần bám nhanh theo tốc độ như tầng nose).
        const ROT_MIN_CUTOFF_HZ = 0.1;
        const ROT_BETA = 2;
        const rotX = oneEuroFilter(oneEuroStateRotX.current, rawRotX, timeSec, ROT_MIN_CUTOFF_HZ, ROT_BETA);
        const rotY = oneEuroFilter(oneEuroStateRotY.current, rawRotY, timeSec, ROT_MIN_CUTOFF_HZ, ROT_BETA);

        // ===== JITTER DEBUG (tạm) =====
        if (!(window as any).__jitterLog) (window as any).__jitterLog = [];
        (window as any).__jitterLog.push({
          rawNoseX: nose.x,
          rawNoseY: nose.y,
          smoothedNoseX,
          smoothedNoseY,
          faceWidth,
          faceHeight,
          faceHeightEma: faceHeightEmaRef.current,
          rawChinForeheadHeight,
          smoothedMouthGapPixels,
          mouthCompensationRatio,
          rawRotX,
          rawRotY,
          rotX,
          rotY,
        });
        if ((window as any).__jitterLog.length >= 60) {
          const L = (window as any).__jitterLog;
          const stdev = (key: string) => {
            const vals = L.map((v: any) => v[key]);
            const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
            const variance = vals.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / vals.length;
            return Math.sqrt(variance);
          };
          console.log(
            `[JITTER n=${L.length}] rawNoseX std=${stdev('rawNoseX').toFixed(5)} rawNoseY std=${stdev('rawNoseY').toFixed(5)} | smoothedNoseX std=${stdev('smoothedNoseX').toFixed(5)} smoothedNoseY std=${stdev('smoothedNoseY').toFixed(5)} | rawRotX std=${stdev('rawRotX').toFixed(5)} rawRotY std=${stdev('rawRotY').toFixed(5)} | rotX std=${stdev('rotX').toFixed(5)} rotY std=${stdev('rotY').toFixed(5)} | faceWidth std=${stdev('faceWidth').toFixed(5)} faceHeight std=${stdev('faceHeight').toFixed(5)}`,
          );
          console.log(
            `[JITTER_FACEHEIGHT n=${L.length}] faceHeightEma std=${stdev('faceHeightEma').toFixed(5)} (nhiễu landmark thô, KHÔNG bù mouth) | faceHeight(final) std=${stdev('faceHeight').toFixed(5)} (SAU bù mouth) | rawChinForeheadHeight std=${stdev('rawChinForeheadHeight').toFixed(5)} | smoothedMouthGapPixels std=${stdev('smoothedMouthGapPixels').toFixed(5)} mean=${(L.reduce((a: number, v: any) => a + v.smoothedMouthGapPixels, 0) / L.length).toFixed(5)} | mouthCompensationRatio=${L[0].mouthCompensationRatio.toFixed(5)}`,
          );
          (window as any).__jitterLog = [];
        }
        // ===== END JITTER DEBUG =====

        // --- BƯỚC 3: ÁNH XẠ rotX/rotY SANG % MÀN HÌNH QUA CALIB BOUNDS (mapping tuyến tính độc lập từng trục) ---
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

          if (rotX > center.x) {
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

        // --- BƯỚC 4B: (ĐÃ GỘP VÀO BƯỚC 2B) — cursor không lọc lại ở tầng percent nữa.
        // Trước đây có 1 lớp One Euro Filter riêng ở đây (percentX/percentY), NHƯNG đây là lọc dư thừa:
        // rotX/rotY đã được lọc TẠI NGUỒN (nose thô, xem oneEuroStateNoseX/Y ở BƯỚC 2B) trước khi bị khuếch
        // đại qua phép chia cho denom (faceWidth/faceHeight hoặc denom nhỏ của calib mapping). Lọc thêm 1
        // lần nữa SAU khi đã mapping sang percent chỉ làm mượt phần "ngọn" của spike đã bị khuếch đại — kém
        // hiệu quả hơn nhiều so với chặn nhiễu ở nơi CHƯA bị khuếch đại, đồng thời cộng thêm lag không cần
        // thiết (2 tầng lọc nối tiếp = trễ pha kép). Việc lọc 1 tầng duy nhất ở nose thô áp dụng ĐỀU cho cả
        // X và Y (đối xứng), nên percentX/percentY dùng thẳng, không qua filter nào thêm ở bước này.
        const smoothedX = percentX;
        const smoothedY = percentY;

        // ===== JITTER DEBUG tầng percent (tạm) =====
        if (!(window as any).__jitterLogPercent) (window as any).__jitterLogPercent = [];
        (window as any).__jitterLogPercent.push({ percentX, percentY });
        if ((window as any).__jitterLogPercent.length >= 60) {
          const L = (window as any).__jitterLogPercent;
          const stdev = (key: string) => {
            const vals = L.map((v: any) => v[key]);
            const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
            const variance = vals.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / vals.length;
            return Math.sqrt(variance);
          };
          const pxStdX = stdev('percentX') * window.innerWidth;
          const pxStdY = stdev('percentY') * window.innerHeight;
          console.log(
            `[JITTER_PERCENT n=${L.length}] percentX std=${stdev('percentX').toFixed(5)} (~${pxStdX.toFixed(1)}px) percentY std=${stdev('percentY').toFixed(5)} (~${pxStdY.toFixed(1)}px)`,
          );
          (window as any).__jitterLogPercent = [];
        }
        // ===== END JITTER DEBUG tầng percent =====

        // --- BƯỚC 4C: currentMouthGapDistance đã tính ở BƯỚC 2A (cần trước để bù trừ faceHeight) ---

        // Đồng bộ hóa biên độ hiệu chuẩn "Mở thoải mái" cá nhân hóa để chống mỏi hàm sinh học
        const dragThreshold = userPreferences?.mouthDragThreshold ?? 0.03;
        const dropThreshold = dragThreshold * 0.7;

        // --- BƯỚC 5: GIỚI HẠN TỐC ĐỘ (VELOCITY CLAMP) — giới hạn PIXEL/GIÂY cursor di chuyển tới target,
        // nên speed thấp = cursor lết chậm thật sự, đúng cảm giác "tốc độ chuột" thay vì "độ nhạy góc".
        const targetPixelX = Math.max(0, Math.min(window.innerWidth, smoothedX * window.innerWidth));
        const targetPixelY = Math.max(0, Math.min(window.innerHeight, smoothedY * window.innerHeight));

        const currentPixel = currentCursorPixelRef.current;
        const isNearEdge =
          currentPixel.x < window.innerWidth * 0.08 ||
          currentPixel.x > window.innerWidth * 0.92 ||
          currentPixel.y < window.innerHeight * 0.08 ||
          currentPixel.y > window.innerHeight * 0.92;
        const dragSpeedMultiplier = isDraggingRef.current && !isNearEdge ? 0.5 : 1.0;

        const BASE_MAX_SPEED_PX_PER_SEC = 2200; // tốc độ tối đa ở speed=1 — tune nếu thấy chuột đuổi theo không kịp/quá chậm
        const maxSpeedPxPerSec = BASE_MAX_SPEED_PX_PER_SEC * userSpeed * dragSpeedMultiplier;
        const deltaSec = Math.max(1e-3, (currentTimeMs - (lastVelocityClampTimeRef.current || currentTimeMs)) / 1000);
        lastVelocityClampTimeRef.current = currentTimeMs;
        const maxStepPx = maxSpeedPxPerSec * deltaSec;

        const deltaX = targetPixelX - currentPixel.x;
        const deltaY = targetPixelY - currentPixel.y;
        const deltaDistance = Math.hypot(deltaX, deltaY);

        let finalPixelPositionX: number;
        let finalPixelPositionY: number;
        if (deltaDistance <= maxStepPx || deltaDistance === 0) {
          finalPixelPositionX = targetPixelX;
          finalPixelPositionY = targetPixelY;
        } else {
          const clampScale = maxStepPx / deltaDistance;
          finalPixelPositionX = currentPixel.x + deltaX * clampScale;
          finalPixelPositionY = currentPixel.y + deltaY * clampScale;
        }
        currentCursorPixelRef.current = { x: finalPixelPositionX, y: finalPixelPositionY };

        // Phản hồi phần cứng UI trực tiếp qua biến đổi translate3d tăng tốc GPU mượt mà 60 FPS
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate3d(${finalPixelPositionX}px, ${finalPixelPositionY}px, 0)`;
        }

        const elementAtCursorPoint = document.elementFromPoint(finalPixelPositionX, finalPixelPositionY);

        if (currentMouthGapDistance >= dragThreshold) {
          if (!wasMouthOpenRef.current) {
            // Chỉ đánh dấu "đã xử lý" nếu có target hợp lệ, tránh kẹt state khi elementAtCursorPoint null.
            if (
              elementAtCursorPoint &&
              (elementAtCursorPoint instanceof HTMLElement || elementAtCursorPoint instanceof SVGElement)
            ) {
              wasMouthOpenRef.current = true;

              const targetDraggableElement =
                (elementAtCursorPoint.closest('.blocklyDraggable') as HTMLElement | SVGElement | null) ||
                (elementAtCursorPoint.hasAttribute('draggable')
                  ? elementAtCursorPoint
                  : (elementAtCursorPoint.closest('[draggable]') as HTMLElement | SVGElement | null));

              if (targetDraggableElement) {
                draggedElementRef.current = targetDraggableElement;
                isDraggingRef.current = true;
                setIsDragging(true);
                oneEuroStateNoseX.current.derivative = 0;
                oneEuroStateNoseY.current.derivative = 0;
                oneEuroStateRotX.current.derivative = 0;
                oneEuroStateRotY.current.derivative = 0;
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
        } else if (currentMouthGapDistance <= dropThreshold) {
          if (wasMouthOpenRef.current) {
            wasMouthOpenRef.current = false;
            oneEuroStateNoseX.current.derivative = 0;
            oneEuroStateNoseY.current.derivative = 0;
            oneEuroStateRotX.current.derivative = 0;
            oneEuroStateRotY.current.derivative = 0;

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
          const VIEWPORT_EDGE_BUFFER_ZONE = 80;
          const SCROLL_STEP_INTENSITY = 30;

          // DOM dùng scrollBy chuẩn; Blockly dùng workspace.scroll(x,y) vì scrollX/Y là giá trị TUYỆT ĐỐI,
          // phải cộng dồn thủ công rồi gọi lại scroll(), không truyền thẳng deltaY.
          const scrollPanelBy = (target: ScrollTarget, deltaY: number) => {
            if (target.kind === 'dom') {
              target.element.scrollBy({ top: deltaY, behavior: 'auto' });
            } else {
              target.workspace.scroll(target.workspace.scrollX, target.workspace.scrollY - deltaY);
            }
          };

          if (activeScrollableParent) {
            const boundingRectangle = activeScrollableParent.element.getBoundingClientRect();
            const PANEL_EDGE_PADDING = 40;
            if (finalPixelPositionX >= boundingRectangle.left && finalPixelPositionX <= boundingRectangle.right) {
              if (
                finalPixelPositionY >= boundingRectangle.top &&
                finalPixelPositionY <= boundingRectangle.top + PANEL_EDGE_PADDING
              ) {
                scrollPanelBy(activeScrollableParent, -SCROLL_STEP_INTENSITY);
                updateAction('scrollUp');
              } else if (
                finalPixelPositionY <= boundingRectangle.bottom &&
                finalPixelPositionY >= boundingRectangle.bottom - PANEL_EDGE_PADDING
              ) {
                scrollPanelBy(activeScrollableParent, SCROLL_STEP_INTENSITY);
                updateAction('scrollDown');
              } else {
                if (actionKindRef.current.startsWith('scroll')) {
                  updateAction('moving');
                }
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

    // Vòng lặp detect chính dùng requestAnimationFrame + detectForVideo (Tasks API).
    // runningMode 'VIDEO' cho phép model tự lọc nhiễu temporal giữa các frame theo timestamp.
    const renderLoop = () => {
      if (!isActive || !faceLandmarker) return;
      rafId = requestAnimationFrame(renderLoop);

      const currentTimeMs = performance.now();
      // Giới hạn tần suất xử lý khung hình tối đa để cân bằng năng lượng CPU
      if (currentTimeMs - lastFrameTimeRef.current < 16) return;

      // ===== E2E LATENCY DEBUG =====
      // fps thực của renderLoop (khoảng cách giữa 2 frame THỰC SỰ được xử lý, không phải rAF thô)
      const actualFrameGapMs = currentTimeMs - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTimeMs;

      if (videoElement.readyState < 2 || videoElement.currentTime === lastVideoTime) return;
      lastVideoTime = videoElement.currentTime;

      const detectStartMs = performance.now();
      const results = faceLandmarker.detectForVideo(videoElement, currentTimeMs);
      const detectDurationMs = performance.now() - detectStartMs;

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
        const frameStartMs = performance.now();
        processFrame(landmarks, currentTimeMs);
        const processDurationMs = performance.now() - frameStartMs;
        const totalE2eMs = performance.now() - detectStartMs; // detect + processFrame, tới khi DOM đã cập nhật xong (processFrame là hàm đồng bộ)

        if (!(window as any).__e2eLatencyLog) {
          (window as any).__e2eLatencyLog = { samples: [], startTime: performance.now() };
        }
        const e2eLog = (window as any).__e2eLatencyLog;
        e2eLog.samples.push({ actualFrameGapMs, detectDurationMs, processDurationMs, totalE2eMs });

        // In thống kê mỗi 1 giây thay vì mỗi frame (đỡ spam console)
        if (performance.now() - e2eLog.startTime > 1000) {
          const s = e2eLog.samples;
          if (s.length > 0) {
            const avg = (key: string) => s.reduce((sum: number, v: any) => sum + v[key], 0) / s.length;
            const max = (key: string) => Math.max(...s.map((v: any) => v[key]));

            const avgFrameGap = avg('actualFrameGapMs');
            const effectiveFps = 1000 / avgFrameGap;

            console.log(
              `[E2E_LATENCY] n=${s.length} | effectiveFps=${effectiveFps.toFixed(1)} (frameGap avg=${avgFrameGap.toFixed(1)}ms max=${max('actualFrameGapMs').toFixed(1)}ms) | detect avg=${avg('detectDurationMs').toFixed(1)}ms max=${max('detectDurationMs').toFixed(1)}ms | processFrame avg=${avg('processDurationMs').toFixed(1)}ms max=${max('processDurationMs').toFixed(1)}ms | TOTAL avg=${avg('totalE2eMs').toFixed(1)}ms max=${max('totalE2eMs').toFixed(1)}ms`,
            );
          }
          e2eLog.samples = [];
          e2eLog.startTime = performance.now();
        }
        // ===== END E2E LATENCY DEBUG =====
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

      // Camera 640x480 cho hiệu năng ổn định trên máy yếu, đủ chính xác cho landmark mặt.
      // getUserMedia có thể fail nếu gọi ngay sau khi trang Calib vừa stop() camera — retry 1 lần.
      const requestCamera = () =>
        navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      try {
        stream = await requestCamera();
      } catch {
        await new Promise(resolve => setTimeout(resolve, 400)); // chờ camera cũ nhả phần cứng
        if (!isActive) return;
        stream = await requestCamera();
      }

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
