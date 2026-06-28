import type { Block, Workspace } from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
export type LogLineType = 'info' | 'dim' | 'step' | 'success' | 'error' | 'output';

export type LogLine = {
  id: string;
  text: string;
  type: LogLineType;
};

type RuntimeContext = {
  variables: Map<string, string | number | boolean>;
  outputs: string[];
  logs: LogLine[];
  logId: number;
};

function pushLog(context: RuntimeContext, text: string, type: LogLineType): void {
  context.logs.push({
    id: String(context.logId++),
    text,
    type,
  });
}

function evaluateValue(block: Block | null, context: RuntimeContext): string | number | boolean {
  if (!block) return '';

  switch (block.type) {
    case 'text':
      return String(block.getFieldValue('TEXT') ?? '');
    case 'math_number':
      return Number(block.getFieldValue('NUM') ?? 0);
    case 'variables_get':
      return context.variables.get(String(block.getFieldValue('VAR'))) ?? '';
    case 'math_arithmetic': {
      const left = Number(evaluateValue(block.getInputTargetBlock('A'), context));
      const right = Number(evaluateValue(block.getInputTargetBlock('B'), context));
      const operator = block.getFieldValue('OP');
      switch (operator) {
        case 'ADD':
          return left + right;
        case 'MINUS':
          return left - right;
        case 'MULTIPLY':
          return left * right;
        case 'DIVIDE':
          return right === 0 ? 0 : left / right;
        default:
          return 0;
      }
    }
    case 'text_join': {
      const left = evaluateValue(block.getInputTargetBlock('A'), context);
      const right = evaluateValue(block.getInputTargetBlock('B'), context);
      return `${left}${right}`;
    }
    default:
      return '';
  }
}

function executeBlock(block: Block, context: RuntimeContext, depth = 0): void {
  const indent = '   '.repeat(depth);

  switch (block.type) {
    case 'text_print': {
      const value = evaluateValue(block.getInputTargetBlock('TEXT'), context);
      const text = String(value);
      context.outputs.push(text);
      pushLog(context, `${indent}print → ${text}`, 'output');
      break;
    }
    case 'variables_set': {
      const variableName = String(block.getFieldValue('VAR'));
      const value = evaluateValue(block.getInputTargetBlock('VALUE'), context);
      context.variables.set(variableName, value);
      pushLog(context, `${indent}set ${variableName} = ${value}`, 'dim');
      break;
    }
    case 'controls_repeat_ext': {
      const times = Number(evaluateValue(block.getInputTargetBlock('TIMES'), context));
      const body = block.getInputTargetBlock('DO');
      pushLog(context, `${indent}[Loop] Repeat × ${times}`, 'dim');
      for (let index = 0; index < times; index += 1) {
        pushLog(context, `${indent}   iteration ${index + 1}`, 'dim');
        executeChain(body, context, depth + 1);
      }
      break;
    }
    case 'controls_if': {
      const condition = evaluateValue(block.getInputTargetBlock('IF0'), context);
      pushLog(context, `${indent}if ${condition ? 'true' : 'false'}`, 'dim');
      if (condition) {
        executeChain(block.getInputTargetBlock('DO0'), context, depth);
      }
      break;
    }
    case 'move_forward': {
      const steps = block.getFieldValue('STEPS');
      pushLog(context, `${indent}Move Forward ${steps} step${steps === 1 ? '' : 's'}`, 'step');
      break;
    }
    default:
      break;
  }
}

function executeChain(block: Block | null, context: RuntimeContext, depth = 0): void {
  let current = block;
  while (current) {
    executeBlock(current, context, depth);
    current = current.getNextBlock();
  }
}

function createContext(): RuntimeContext {
  return {
    variables: new Map(),
    outputs: [],
    logs: [],
    logId: 0,
  };
}

function generateCodeFromStartBlock(workspace: Workspace): string {
  const topBlocks = workspace.getTopBlocks(true);
  const startBlock = topBlocks.find(block => block.type === 'controls_start');

  if (!startBlock) return '';

  const codeLines: string[] = [];
  let current = startBlock.getNextBlock();

  while (current) {
    const line = pythonGenerator.blockToCode(current);
    if (typeof line === 'string') {
      codeLines.push(line);
    }
    current = current.getNextBlock();
  }

  return codeLines.join('');
}

export type WorkspaceRunResult = {
  output: string;
  logs: LogLine[];
};

export function evaluateWorkspaceRun(workspace: Workspace): WorkspaceRunResult {
  const context = createContext();
  pushLog(context, '▶  Running program…', 'info');

  let generatedPythonCode = '';

  try {
    const topBlocks = workspace.getTopBlocks(true);
    const orphanCount = topBlocks.filter(block => block.type !== 'controls_start' && block.previousConnection).length;

    if (orphanCount > 0) {
      pushLog(
        context,
        `   ⚠ ${orphanCount} disconnected block(s) were ignored — connect blocks to the "On Start" block to run them.`,
        'dim',
      );
    }

    generatedPythonCode = generateCodeFromStartBlock(workspace);

    if (!generatedPythonCode.trim()) {
      pushLog(context, '   (Workspace is empty, no code generated)', 'dim');
    } else {
      pushLog(context, '   Code generated successfully, sending to server...', 'info');
    }
  } catch (error) {
    pushLog(context, ` ❌ Code generation error: ${error}`, 'error');
  }
  return {
    output: generatedPythonCode,
    logs: context.logs,
  };
}
export function evaluateWorkspaceOutput(workspace: Workspace): string {
  return evaluateWorkspaceRun(workspace).output;
}
