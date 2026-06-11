import type { Block, Workspace } from 'blockly/core';

type RuntimeContext = {
  variables: Map<string, string | number | boolean>;
  outputs: string[];
};

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

function executeBlock(block: Block, context: RuntimeContext): void {
  switch (block.type) {
    case 'text_print': {
      const value = evaluateValue(block.getInputTargetBlock('TEXT'), context);
      context.outputs.push(String(value));
      break;
    }
    case 'variables_set': {
      const variableName = String(block.getFieldValue('VAR'));
      const value = evaluateValue(block.getInputTargetBlock('VALUE'), context);
      context.variables.set(variableName, value);
      break;
    }
    case 'controls_repeat_ext': {
      const times = Number(evaluateValue(block.getInputTargetBlock('TIMES'), context));
      const body = block.getInputTargetBlock('DO');
      for (let index = 0; index < times; index += 1) {
        executeChain(body, context);
      }
      break;
    }
    case 'controls_if': {
      const condition = evaluateValue(block.getInputTargetBlock('IF0'), context);
      if (condition) {
        executeChain(block.getInputTargetBlock('DO0'), context);
      }
      break;
    }
    case 'move_forward':
      break;
    default:
      break;
  }
}

function executeChain(block: Block | null, context: RuntimeContext): void {
  let current = block;
  while (current) {
    executeBlock(current, context);
    current = current.getNextBlock();
  }
}

export function evaluateWorkspaceOutput(workspace: Workspace): string {
  const context: RuntimeContext = {
    variables: new Map(),
    outputs: [],
  };

  const startBlock = workspace.getBlocksByType('controls_start', false)[0] ?? workspace.getTopBlocks(false)[0];
  if (startBlock) {
    executeChain(startBlock.getNextBlock(), context);
  }

  return context.outputs.join('\n');
}
