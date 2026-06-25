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
  savedWorkspaceState?: Record<string, unknown>;
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

function lockWorkspaceScale(workspace: Blockly.WorkspaceSvg): void {
  if (workspace.getScale() !== 1) {
    workspace.setScale(1);
  }
}

const BlocklyEditor = forwardRef<BlocklyEditorHandle, BlocklyEditorProps>(function BlocklyEditor(
  { toolboxConfig, initialBlocks, lessonKey, savedWorkspaceState, toolboxTitle = 'Block Library' },
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
      workspaceRef.current.clear();
      if (initialBlocksRef.current && Object.keys(initialBlocksRef.current).length > 0) {
        Blockly.serialization.workspaces.load(initialBlocksRef.current, workspaceRef.current);
      } else {
        const startBlock = workspaceRef.current.newBlock('controls_start');
        startBlock.initSvg();
        startBlock.render();
        startBlock.moveBy(56, 56);
      }
    },
  }));

  useEffect(() => {
    if (!hostRef.current) return;

    registerEnableCodeBlocks();
    Blockly.config.snapRadius = 48;
    Blockly.config.connectingSnapRadius = 96;
    const workspace = Blockly.inject(hostRef.current, {
      toolbox: buildToolbox(toolboxConfig) as Blockly.utils.toolbox.ToolboxDefinition,
      theme: enableCodeTheme,
      renderer: 'zelos',
      toolboxPosition: 'end',
      horizontalLayout: false,
      grid: {
        spacing: 20,
        length: 3,
        colour: 'rgba(255, 249, 220, 0.18)',
        snap: true,
      },
      zoom: {
        controls: false,
        wheel: false,
        pinch: false,
        startScale: 1.2,
        maxScale: 1.5,
        minScale: 1,
        scaleSpeed: 1,
      },
      trashcan: false,
      sounds: false,
      move: {
        scrollbars: false,
        drag: false,
        wheel: false,
      },
    });

    workspaceRef.current = workspace;
    lockWorkspaceScale(workspace);
    workspace.addChangeListener(() => lockWorkspaceScale(workspace));
    workspace.addChangeListener(event => {
      if (event.type === Blockly.Events.BLOCK_CREATE) {
        const blockCreateEvent = event as Blockly.Events.BlockCreate;

        blockCreateEvent.ids?.forEach((blockId: string) => {
          const block = workspace.getBlockById(blockId);
          const svgRoot = block?.getSvgRoot();

          if (svgRoot) {
            svgRoot.setAttribute('draggable', 'true');
          }
        });
      }
    });
    ensureToolboxTitle(hostRef.current, toolboxTitle);

    const resize = () => {
      Blockly.svgResize(workspace);
      lockWorkspaceScale(workspace);
      if (hostRef.current) ensureToolboxTitle(hostRef.current, toolboxTitle);
    };

    resize();
    loadLessonIntoWorkspace(workspace, initialBlocksRef.current);

    const preventBrowserZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    };

    const host = hostRef.current;
    host.addEventListener('wheel', preventBrowserZoom, { passive: false });
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    window.addEventListener('resize', resize);

    return () => {
      host.removeEventListener('wheel', preventBrowserZoom);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [toolboxConfig, toolboxTitle]);
  useEffect(() => {
    if (workspaceRef.current && toolboxConfig) {
      const newToolbox = buildToolbox(toolboxConfig);
      if (newToolbox) {
        workspaceRef.current.updateToolbox(newToolbox as Blockly.utils.toolbox.ToolboxDefinition);
      }
      if (hostRef.current) ensureToolboxTitle(hostRef.current, toolboxTitle);
    }
  }, [toolboxConfig, toolboxTitle]);

  useEffect(() => {
    if (!workspaceRef.current) return;

    workspaceRef.current.clear();

    if (savedWorkspaceState && Object.keys(savedWorkspaceState).length > 0) {
      try {
        Blockly.serialization.workspaces.load(savedWorkspaceState, workspaceRef.current);
      } catch (error) {
        console.error('Lỗi load saved state:', error);
      }
    } else if (initialBlocks && Object.keys(initialBlocks).length > 0) {
      try {
        Blockly.serialization.workspaces.load(initialBlocks, workspaceRef.current);
      } catch (error) {
        console.error('Lỗi load initialBlocks:', error);
      }
    } else {
      const startBlock = workspaceRef.current.newBlock('controls_start');
      startBlock.initSvg();
      startBlock.render();
      startBlock.moveBy(56, 56);
    }
  }, [lessonKey, initialBlocks, savedWorkspaceState]);
  return <div ref={hostRef} className="blockly-editor-host" aria-label="Blockly workspace" />;
});

export default BlocklyEditor;
