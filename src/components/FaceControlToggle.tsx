import { useEyeTracking } from '../context/EyeTrackingContext';

export default function FaceControlToggle() {
  const { isEnabled, toggle, shortcutLabel } = useEyeTracking();

  return (
    <button
      type="button"
      className={`btn btn-ghost face-control-toggle${isEnabled ? ' face-control-toggle--on' : ''}`}
      onClick={toggle}
      aria-pressed={isEnabled}
      aria-label={isEnabled ? 'Disable face control' : 'Enable face control'}
      title={`Press ${shortcutLabel} to toggle`}
    >
      <span className="face-control-toggle-main">
        Face Control <span className="face-control-dev-label">(DevMode)</span>
        <span className="face-control-state">{isEnabled ? 'ON' : 'OFF'}</span>
      </span>
      <span className="face-control-toggle-hint">Press {shortcutLabel} to toggle</span>
    </button>
  );
}
