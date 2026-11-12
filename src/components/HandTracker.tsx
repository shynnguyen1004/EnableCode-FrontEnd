import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useHandTracking } from '../context/HandTrackingContext';
import { useI18n } from '../i18n/I18nProvider';

type Point = { x: number; y: number };
type HandStatus = 'ready' | 'moving' | 'grabbing' | 'noHand';

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const HAND_POINTER_ID = 31;
const PINCH_START_RATIO = 0.4;
const PINCH_RELEASE_RATIO = 0.55;

declare global {
  interface Window {
    __handTrackingPointerActive?: boolean;
  }
}

const distance = (first: NormalizedLandmark, second: NormalizedLandmark) =>
  Math.hypot(first.x - second.x, first.y - second.y, (first.z ?? 0) - (second.z ?? 0));

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getPointerPosition = (landmark: NormalizedLandmark): Point => ({
  // The preview is mirrored, so the hand cursor mirrors the camera image as well.
  x: clamp((1 - landmark.x) * window.innerWidth, 0, window.innerWidth),
  y: clamp(landmark.y * window.innerHeight, 0, window.innerHeight),
});

const createPointerEvent = (type: string, point: Point, buttons: number) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    pointerId: HAND_POINTER_ID,
    pointerType: 'mouse',
    isPrimary: true,
    buttons,
  });

const getBlockAtPoint = (point: Point): Element | null => {
  const elements = document.elementsFromPoint(point.x, point.y);
  for (const element of elements) {
    const draggable = element.closest('.blocklyDraggable');
    if (draggable) return draggable;
  }
  return null;
};

const HandTracker: React.FC = () => {
  const { isEnabled } = useHandTracking();
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<HandStatus>('ready');
  const [showHandWarning, setShowHandWarning] = useState(false);

  const statusRef = useRef<HandStatus>('ready');
  const isGrabbingRef = useRef(false);
  const draggedBlockRef = useRef<Element | null>(null);
  const lastPointerRef = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const noHandTimerRef = useRef<number | null>(null);

  const updateStatus = (next: HandStatus) => {
    statusRef.current = next;
    setStatus(previous => (previous === next ? previous : next));
  };

  useEffect(() => {
    if (!isEnabled) return;

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const canvasContext = canvasElement.getContext('2d');
    if (!canvasContext) return;

    let isActive = true;
    let handLandmarker: HandLandmarker | null = null;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let lastVideoTime = -1;
    let lastFrameTime = 0;
    let smoothedPointer: Point | null = null;
    setShowHandWarning(false);
    updateStatus('ready');

    const releaseBlock = () => {
      if (!isGrabbingRef.current) return;
      const point = lastPointerRef.current;
      document.dispatchEvent(createPointerEvent('pointerup', point, 0));
      isGrabbingRef.current = false;
      draggedBlockRef.current = null;
      window.__handTrackingPointerActive = false;
      updateStatus('moving');
    };

    const beginGrab = (point: Point) => {
      const block = getBlockAtPoint(point);
      if (!block) return;

      draggedBlockRef.current = block;
      isGrabbingRef.current = true;
      window.__handTrackingPointerActive = true;
      block.dispatchEvent(createPointerEvent('pointerdown', point, 1));
      updateStatus('grabbing');
    };

    const movePointer = (point: Point) => {
      lastPointerRef.current = point;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
      }

      if (isGrabbingRef.current) {
        document.dispatchEvent(createPointerEvent('pointermove', point, 1));
      }
    };

    const drawHand = (landmarks: NormalizedLandmark[]) => {
      canvasContext.strokeStyle = '#fbbf24';
      canvasContext.lineWidth = 2;
      canvasContext.lineCap = 'round';
      HAND_CONNECTIONS.forEach(([startIndex, endIndex]) => {
        const start = landmarks[startIndex];
        const end = landmarks[endIndex];
        if (!start || !end) return;
        canvasContext.beginPath();
        canvasContext.moveTo((1 - start.x) * canvasElement.width, start.y * canvasElement.height);
        canvasContext.lineTo((1 - end.x) * canvasElement.width, end.y * canvasElement.height);
        canvasContext.stroke();
      });

      [4, 8].forEach(index => {
        const point = landmarks[index];
        if (!point) return;
        canvasContext.beginPath();
        canvasContext.fillStyle = index === 8 ? '#2dd4bf' : '#f97316';
        canvasContext.arc((1 - point.x) * canvasElement.width, point.y * canvasElement.height, 5, 0, Math.PI * 2);
        canvasContext.fill();
      });
    };

    const processFrame = (landmarks: NormalizedLandmark[]) => {
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const wrist = landmarks[0];
      const middleMcp = landmarks[9];
      if (!indexTip || !thumbTip || !wrist || !middleMcp) return;

      const rawPointer = getPointerPosition(indexTip);
      smoothedPointer = smoothedPointer
        ? {
            x: smoothedPointer.x * 0.65 + rawPointer.x * 0.35,
            y: smoothedPointer.y * 0.65 + rawPointer.y * 0.35,
          }
        : rawPointer;
      movePointer(smoothedPointer);

      const palmSize = Math.max(distance(wrist, middleMcp), 0.001);
      const pinchRatio = distance(thumbTip, indexTip) / palmSize;
      const isPinched = isGrabbingRef.current ? pinchRatio < PINCH_RELEASE_RATIO : pinchRatio < PINCH_START_RATIO;

      if (isPinched) {
        if (!isGrabbingRef.current) beginGrab(smoothedPointer);
        else updateStatus('grabbing');
      } else if (isGrabbingRef.current) {
        releaseBlock();
      } else {
        updateStatus('moving');
      }
    };

    const handleNoHand = () => {
      releaseBlock();
      smoothedPointer = null;
      updateStatus('noHand');
      if (!noHandTimerRef.current) {
        noHandTimerRef.current = window.setTimeout(() => setShowHandWarning(true), 800);
      }
    };

    const renderLoop = () => {
      if (!isActive || !handLandmarker) return;
      rafId = window.requestAnimationFrame(renderLoop);

      const currentTimeMs = performance.now();
      if (currentTimeMs - lastFrameTime < 30) return;
      lastFrameTime = currentTimeMs;
      if (videoElement.readyState < 2 || videoElement.currentTime === lastVideoTime) return;
      lastVideoTime = videoElement.currentTime;

      const results = handLandmarker.detectForVideo(videoElement, currentTimeMs);
      canvasContext.save();
      canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasContext.scale(-1, 1);
      canvasContext.drawImage(videoElement, -canvasElement.width, 0, canvasElement.width, canvasElement.height);
      canvasContext.restore();

      const landmarks = results.landmarks?.[0];
      if (landmarks) {
        if (noHandTimerRef.current) {
          window.clearTimeout(noHandTimerRef.current);
          noHandTimerRef.current = null;
        }
        setShowHandWarning(false);
        drawHand(landmarks);
        processFrame(landmarks);
      } else {
        handleNoHand();
      }
    };

    const setup = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        );
        handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.65,
          minHandPresenceConfidence: 0.65,
          minTrackingConfidence: 0.65,
        });

        if (!isActive) {
          void handLandmarker.close();
          return;
        }

        const requestCamera = () =>
          navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
        try {
          stream = await requestCamera();
        } catch {
          await new Promise(resolve => window.setTimeout(resolve, 400));
          if (!isActive) return;
          stream = await requestCamera();
        }

        if (!isActive || !stream) {
          stream?.getTracks().forEach(track => track.stop());
          return;
        }

        videoElement.srcObject = stream;
        await videoElement.play();
        rafId = window.requestAnimationFrame(renderLoop);
      } catch (error) {
        console.error('Failed to start hand tracking:', error);
        updateStatus('noHand');
      }
    };

    void setup();

    return () => {
      isActive = false;
      releaseBlock();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      stream?.getTracks().forEach(track => track.stop());
      if (handLandmarker) void handLandmarker.close();
      if (noHandTimerRef.current) window.clearTimeout(noHandTimerRef.current);
      noHandTimerRef.current = null;
      window.__handTrackingPointerActive = false;
    };
  }, [isEnabled]);

  if (!isEnabled) return null;

  const statusLabel = {
    ready: t('handTracking.ready'),
    moving: t('handTracking.moving'),
    grabbing: t('handTracking.grabbing'),
    noHand: t('handTracking.noHand'),
  }[status];

  return (
    <div className="hand-tracking-layer" aria-live="polite">
      <div
        ref={cursorRef}
        className={`hand-tracking-cursor${status === 'grabbing' ? ' hand-tracking-cursor--grabbing' : ''}`}
        aria-hidden="true"
      >
        <span />
      </div>

      {showHandWarning && (
        <div className="hand-tracking-warning" role="status">
          <div className="hand-tracking-warning-icon">✋</div>
          <strong>{t('handTracking.noHandTitle')}</strong>
          <span>{t('handTracking.noHandDescription')}</span>
        </div>
      )}

      <div className="hand-tracking-preview">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} width="260" height="180" />
        <span className="hand-tracking-status">{statusLabel}</span>
      </div>
    </div>
  );
};

export default HandTracker;
