import * as Blockly from 'blockly';

type BlockSvg = Blockly.BlockSvg;

type LessonBlockSpec = {
  type: string;
  fields?: Record<string, string | number>;
  value?: LessonBlockSpec;
  values?: Record<string, LessonBlockSpec>;
  do?: LessonBlockSpec[];
  statements?: Record<string, LessonBlockSpec[]>;
};

const VALUE_INPUT_BY_TYPE: Record<string, string> = {
  text_print: 'TEXT',
  controls_repeat_ext: 'TIMES',
  variables_set: 'VALUE',
};

function ensureVariable(workspace: Blockly.Workspace, name: string): void {
  if (!workspace.getVariable(name)) {
    workspace.createVariable(name);
  }
}

function applyFields(block: Blockly.Block, fields?: Record<string, string | number>): void {
  if (!fields) return;

  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    if (fieldName === 'VAR' && typeof fieldValue === 'string') {
      ensureVariable(block.workspace, fieldValue);
    }
    block.setFieldValue(fieldValue, fieldName);
  }
}

function connectValueInput(
  workspace: Blockly.WorkspaceSvg,
  block: Blockly.Block,
  inputName: string,
  spec?: LessonBlockSpec,
): void {
  if (!spec) return;

  const valueBlock = createBlockFromSpec(workspace, spec);
  const input = block.getInput(inputName);
  if (valueBlock.outputConnection && input?.connection) {
    input.connection.connect(valueBlock.outputConnection);
  }
}

function connectStatementInput(
  workspace: Blockly.WorkspaceSvg,
  block: Blockly.Block,
  inputName: string,
  specs: LessonBlockSpec[] = [],
): void {
  let previous: Blockly.Block | null = null;

  for (const spec of specs) {
    const child = createBlockFromSpec(workspace, spec);
    if (previous?.nextConnection && child.previousConnection) {
      previous.nextConnection.connect(child.previousConnection);
    } else {
      const input = block.getInput(inputName);
      if (child.previousConnection && input?.connection) {
        input.connection.connect(child.previousConnection);
      }
    }
    previous = getChainTail(child);
  }
}

function getChainTail(block: BlockSvg): BlockSvg {
  let current: BlockSvg = block;
  while (current.getNextBlock()) {
    current = current.getNextBlock()!;
  }
  return current;
}

const WORKSPACE_BLOCK_PADDING = 56;

function layoutStartBlockTopLeft(workspace: Blockly.WorkspaceSvg, startBlock: BlockSvg): void {
  Blockly.svgResize(workspace);
  const targetX = WORKSPACE_BLOCK_PADDING;
  const targetY = WORKSPACE_BLOCK_PADDING;
  const { x, y } = startBlock.getRelativeToSurfaceXY();
  startBlock.moveBy(targetX - x, targetY - y);
}

function createBlockFromSpec(workspace: Blockly.WorkspaceSvg, spec: LessonBlockSpec): BlockSvg {
  const block = workspace.newBlock(spec.type) as BlockSvg;
  applyFields(block, spec.fields);

  if (spec.value) {
    const inputName = VALUE_INPUT_BY_TYPE[spec.type] ?? 'TEXT';
    connectValueInput(workspace, block, inputName, spec.value);
  }

  if (spec.values) {
    for (const [inputName, valueSpec] of Object.entries(spec.values)) {
      connectValueInput(workspace, block, inputName, valueSpec);
    }
  }

  if (spec.do) {
    connectStatementInput(workspace, block, 'DO', spec.do);
  }

  if (spec.statements) {
    for (const [inputName, statementSpecs] of Object.entries(spec.statements)) {
      connectStatementInput(workspace, block, inputName, statementSpecs);
    }
  }

  block.initSvg();
  block.render();
  return block;
}

export function loadLessonIntoWorkspace(
  workspace: Blockly.WorkspaceSvg,
  initialBlocks: Record<string, unknown> | undefined,
): void {
  workspace.clear();

  const startBlock = workspace.newBlock('controls_start') as BlockSvg;
  startBlock.initSvg();
  startBlock.render();

  const specs = Array.isArray((initialBlocks as { blocks?: LessonBlockSpec[] })?.blocks)
    ? ((initialBlocks as { blocks: LessonBlockSpec[] }).blocks ?? [])
    : [];

  let previous: BlockSvg = startBlock;

  for (const spec of specs) {
    if (spec.type === 'text_print' && spec.fields?.TEXT !== undefined && !spec.value) {
      const normalizedSpec: LessonBlockSpec = {
        ...spec,
        fields: undefined,
        value: { type: 'text', fields: { TEXT: String(spec.fields.TEXT) } },
      };
      const block = createBlockFromSpec(workspace, normalizedSpec);
      if (previous.nextConnection && block.previousConnection) {
        previous.nextConnection.connect(block.previousConnection);
      }
      previous = getChainTail(block);
      continue;
    }

    const block = createBlockFromSpec(workspace, spec);
    if (previous.nextConnection && block.previousConnection) {
      previous.nextConnection.connect(block.previousConnection);
    }
    previous = getChainTail(block);
  }

  layoutStartBlockTopLeft(workspace, startBlock);
}
