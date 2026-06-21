import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as Blockly from 'blockly';

import { registerEnableCodeBlocks } from '../blockly/blocks';
import { loadLessonIntoWorkspace } from '../blockly/lessonBlocksLoader';
import { enableCodeTheme } from '../blockly/theme';
import { buildToolbox } from '../blockly/toolbox';

import '../styles/blockly.css';

export type BlocklyEditorHandle = {
  getWorkspace: () => Blockly.WorkspaceSvg | null;
  resetWorkspace: () => void;
};

type BlocklyEditorProps = {
  toolboxConfig?: Record<string, unknown>;
  initialBlocks?: Record<string, unknown>;
  lessonKey: string;
  toolboxTitle?: string;
};

function ensureToolboxTitle(host: HTMLElement, title: string): void {
  const toolbox = host.querySelector('.blocklyToolboxDiv');
  if (!toolbox) return;

  let heading = toolbox.querySelector<HTMLDivElement>('.blockly-toolbox-title');
  if (!heading) {
    heading = document.createElement('div');
    heading.className = 'blockly-toolbox-title';
    toolbox.prepend(heading);
  }

  heading.textContent = title;
}

const BlocklyEditor = forwardRef<BlocklyEditorHandle, BlocklyEditorProps>(function BlocklyEditor(
  { toolboxConfig, initialBlocks, lessonKey, toolboxTitle = 'Block Library' },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const initialBlocksRef = useRef(initialBlocks);

  initialBlocksRef.current = initialBlocks;

  useImperativeHandle(ref, () => ({
    getWorkspace: () => workspaceRef.current,
    resetWorkspace: () => {
      if (!workspaceRef.current) return;
      loadLessonIntoWorkspace(workspaceRef.current, initialBlocksRef.current);
    },
  }));

  useEffect(() => {
    if (!hostRef.current) return;

    registerEnableCodeBlocks();

    const workspace = Blockly.inject(hostRef.current, {
      toolbox: buildToolbox(toolboxConfig),
      theme: enableCodeTheme,
      renderer: 'zelos',
      toolboxPosition: 'end',
      horizontalLayout: false,
      grid: {
        spacing: 28,
        length: 3,
        colour: 'rgba(255, 249, 220, 0.18)',
        snap: true,
      },
      zoom: {
        controls: false,
        wheel: true,
        startScale: 1,
        maxScale: 1.4,
        minScale: 0.7,
        pinch: true,
      },
      trashcan: false,
      sounds: false,
      move: {
        scrollbars: {
          horizontal: true,
          vertical: true,
        },
        drag: true,
        wheel: true,
      },
    });

    workspaceRef.current = workspace;
    workspace.addChangeListener(event => {
      if (event.type === Blockly.Events.BLOCK_CREATE) {
        const blockCreateEvent = event as Blockly.Events.BlockCreate;

        blockCreateEvent.ids?.forEach((blockId: string) => {
          const block = workspace.getBlockById(blockId);
          const svgRoot = block?.getSvgRoot();

          if (svgRoot) {
            svgRoot.setAttribute('id', 'draggable');
          }
        });
      }
    });
    loadLessonIntoWorkspace(workspace, initialBlocksRef.current);
    ensureToolboxTitle(hostRef.current, toolboxTitle);

    const resize = () => {
      Blockly.svgResize(workspace);
      if (hostRef.current) ensureToolboxTitle(hostRef.current, toolboxTitle);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(hostRef.current);
    window.addEventListener('resize', resize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [lessonKey, toolboxConfig, toolboxTitle]);

  return <div ref={hostRef} className="blockly-editor-host" aria-label="Blockly workspace" />;
});

export default BlocklyEditor;
