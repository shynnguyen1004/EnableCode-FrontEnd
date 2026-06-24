import * as Blockly from 'blockly';
import { Order, pythonGenerator } from 'blockly/python';
import { CustomBlockDTO } from '../lib/types';
let blocksRegistered = false;

const blockDefinitions = [
  {
    type: 'controls_start',
    message0: 'On Start',
    nextStatement: null,
    style: 'event_blocks',
    hat: 'cap',
    tooltip: 'Runs when the program starts',
  },
  {
    type: 'text_print',
    message0: 'print %1',
    args0: [{ type: 'input_value', name: 'TEXT', check: ['String', 'Number'] }],
    previousStatement: null,
    nextStatement: null,
    style: 'output_blocks',
    tooltip: 'Print a value',
  },
  {
    type: 'text',
    message0: '%1',
    args0: [{ type: 'field_input', name: 'TEXT', text: '' }],
    output: 'String',
    style: 'text_blocks',
  },
  {
    type: 'controls_repeat_ext',
    message0: 'Repeat %1 times',
    args0: [{ type: 'input_value', name: 'TIMES', check: 'Number' }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    style: 'loop_blocks',
  },
  {
    type: 'math_number',
    message0: '%1',
    args0: [{ type: 'field_number', name: 'NUM', value: 0 }],
    output: 'Number',
    style: 'math_blocks',
  },
  {
    type: 'math_arithmetic',
    message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      {
        type: 'field_dropdown',
        name: 'OP',
        options: [
          ['+', 'ADD'],
          ['-', 'MINUS'],
          ['×', 'MULTIPLY'],
          ['÷', 'DIVIDE'],
        ],
      },
      { type: 'input_value', name: 'B', check: 'Number' },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'math_blocks',
  },
  {
    type: 'variables_set',
    message0: 'set %1 to %2',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'item' },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'variable_blocks',
  },
  {
    type: 'variables_get',
    message0: '%1',
    args0: [{ type: 'field_variable', name: 'VAR', variable: 'item' }],
    output: null,
    style: 'variable_blocks',
  },
  {
    type: 'text_join',
    message0: 'join %1 %2',
    args0: [
      { type: 'input_value', name: 'A', check: 'String' },
      { type: 'input_value', name: 'B', check: 'String' },
    ],
    output: 'String',
    style: 'text_blocks',
  },
  {
    type: 'controls_if',
    message0: 'if %1 then',
    args0: [{ type: 'input_value', name: 'IF0', check: 'Boolean' }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO0' }],
    previousStatement: null,
    nextStatement: null,
    style: 'logic_blocks',
  },
  {
    type: 'move_forward',
    message0: 'Move Forward %1 step',
    args0: [{ type: 'field_number', name: 'STEPS', value: 1, min: 1 }],
    previousStatement: null,
    nextStatement: null,
    style: 'action_blocks',
  },
];

export function registerEnableCodeBlocks(): void {
  if (blocksRegistered) return;

  Blockly.common.defineBlocksWithJsonArray(blockDefinitions);

  pythonGenerator.forBlock.controls_start = () => '';

  pythonGenerator.forBlock.text_print = (block, generator) => {
    const value = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
    return `print(${value})\n`;
  };

  pythonGenerator.forBlock.text = block => {
    return [JSON.stringify(block.getFieldValue('TEXT')), Order.ATOMIC];
  };

  pythonGenerator.forBlock.controls_repeat_ext = (block, generator) => {
    const times = generator.valueToCode(block, 'TIMES', Order.MEMBER) || '0';
    const branch = generator.statementToCode(block, 'DO');
    return `for _ in range(int(${times})):\n${branch || generator.INDENT + 'pass\n'}`;
  };

  pythonGenerator.forBlock.math_number = block => {
    return [String(block.getFieldValue('NUM')), Order.ATOMIC];
  };

  pythonGenerator.forBlock.math_arithmetic = (block, generator) => {
    const operators: Record<string, string> = {
      ADD: '+',
      MINUS: '-',
      MULTIPLY: '*',
      DIVIDE: '/',
    };
    const operator = operators[block.getFieldValue('OP')];
    const order = operator === '+' || operator === '-' ? Order.ADDITIVE : Order.MULTIPLICATIVE;
    const argument0 = generator.valueToCode(block, 'A', order) || '0';
    const argument1 = generator.valueToCode(block, 'B', order) || '0';
    return [`${argument0} ${operator} ${argument1}`, order];
  };

  pythonGenerator.forBlock.variables_set = (block, generator) => {
    const variable = String(block.getFieldValue('VAR'));
    const value = generator.valueToCode(block, 'VALUE', Order.NONE) || '0';
    return `${variable} = ${value}\n`;
  };

  pythonGenerator.forBlock.variables_get = block => {
    return [String(block.getFieldValue('VAR')), Order.ATOMIC];
  };

  pythonGenerator.forBlock.text_join = (block, generator) => {
    const left = generator.valueToCode(block, 'A', Order.NONE) || "''";
    const right = generator.valueToCode(block, 'B', Order.NONE) || "''";
    return [`str(${left}) + str(${right})`, Order.ATOMIC];
  };

  pythonGenerator.forBlock.controls_if = (block, generator) => {
    const condition = generator.valueToCode(block, 'IF0', Order.NONE) || 'False';
    const branch = generator.statementToCode(block, 'DO0');
    return `if ${condition}:\n${branch || generator.INDENT + 'pass\n'}`;
  };

  pythonGenerator.forBlock.move_forward = block => {
    const steps = block.getFieldValue('STEPS');
    return `# move forward ${steps}\n`;
  };

  blocksRegistered = true;
}
export function registerDynamicBlocks(dynamicBlocks: CustomBlockDTO[]): void {
  if (!dynamicBlocks || dynamicBlocks.length === 0) return;

  dynamicBlocks.forEach(blockConfig => {
    const { blockType, definition, generatorCode } = blockConfig;

    // 1. Nạp giao diện (UI Definition) cho khối lệnh nếu chưa có
    if (!Blockly.Blocks[blockType]) {
      Blockly.Blocks[blockType] = {
        init: function () {
          this.jsonInit(definition);
        },
      };
    }

    // 2. Nạp logic dịch code Python (Generator) nếu chưa có
    if (!pythonGenerator.forBlock[blockType]) {
      try {
        // Biến chuỗi string từ Database thành một hàm JavaScript chạy được
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pythonGenerator.forBlock[blockType] = new Function('block', 'generator', generatorCode) as any;
      } catch (error) {
        console.error(`Lỗi biên dịch generator code cho block ${blockType}:`, error);
      }
    }
  });
}
