import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Circle, Terminal, X } from 'lucide-react';

import type { LogLine, LogLineType } from '../blockly/evaluateWorkspace';

type WorkspaceOutputPanelProps = {
  lines: LogLine[];
  isOpen: boolean;
  isRunning: boolean;
  hasRun: boolean;
  passed: boolean | null;
  title: string;
  runningLabel: string;
  passedLabel: string;
  errorLabel: string;
  placeholder: string;
  clearLabel: string;
  onToggleOpen: () => void;
  onClear: () => void;
};

const LINE_CLASS: Record<LogLineType, string> = {
  info: 'workspace-output-line--info',
  dim: 'workspace-output-line--dim',
  step: 'workspace-output-line--step',
  success: 'workspace-output-line--success',
  error: 'workspace-output-line--error',
  output: 'workspace-output-line--output',
};

export default function WorkspaceOutputPanel({
  lines,
  isOpen,
  isRunning,
  hasRun,
  passed,
  title,
  runningLabel,
  passedLabel,
  errorLabel,
  placeholder,
  clearLabel,
  onToggleOpen,
  onClear,
}: WorkspaceOutputPanelProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, isOpen, isRunning]);

  const showPassed = !isRunning && hasRun && passed === true;
  const showError = !isRunning && hasRun && passed === false;

  return (
    <div
      className={`workspace-output-panel${isOpen ? ' workspace-output-panel--open' : ''}${hasRun ? ' workspace-output-panel--active' : ''}`}
    >
      <div
        className="workspace-output-header"
        role="button"
        tabIndex={0}
        onClick={onToggleOpen}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleOpen();
          }
        }}
      >
        <div className="workspace-output-header-left">
          <Terminal size={20} strokeWidth={2.5} className="workspace-output-terminal-icon" />
          <span className="workspace-output-title">{title}</span>
          {isRunning && (
            <span className="workspace-output-badge workspace-output-badge--running">
              <Circle size={10} className="workspace-output-badge-dot" />
              {runningLabel}
            </span>
          )}
          {showPassed && (
            <span className="workspace-output-badge workspace-output-badge--passed">
              <CheckCircle2 size={14} strokeWidth={3} />
              {passedLabel}
            </span>
          )}
          {showError && (
            <span className="workspace-output-badge workspace-output-badge--error">
              <AlertCircle size={14} strokeWidth={3} />
              {errorLabel}
            </span>
          )}
        </div>

        <div className="workspace-output-header-right">
          {hasRun && (
            <button
              type="button"
              className="workspace-output-clear"
              aria-label={clearLabel}
              onClick={event => {
                event.stopPropagation();
                onClear();
              }}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          )}
          <span className="workspace-output-chevron" aria-hidden="true">
            {isOpen ? '▾' : '▸'}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="workspace-output-body">
          {lines.length === 0 && !isRunning && <span className="workspace-output-placeholder">{placeholder}</span>}
          {lines.map(line => (
            <div key={line.id} className={`workspace-output-line ${LINE_CLASS[line.type]}`}>
              {line.text}
            </div>
          ))}
          {isRunning && <span className="workspace-output-cursor" aria-hidden="true" />}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
