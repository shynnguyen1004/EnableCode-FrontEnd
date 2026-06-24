import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { CustomBlockDTO } from '../lib/types';
export const registerCustomBlocks = (customBlocks: CustomBlockDTO[]) => {
  customBlocks.forEach(blockConfig => {
    const { blockType, definition, generatorCode } = blockConfig;
    if (!Blockly.Blocks[blockType]) {
      Blockly.Blocks[blockType] = {
        init: function () {
          this.jsonInit(definition);
        },
      };
    }
    if (!pythonGenerator.forBlock[blockType]) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pythonGenerator.forBlock[blockType] = new Function('block', 'generator', generatorCode) as any;
      } catch (err) {
        console.error(`Failed to parse generator code for block: ${blockType}`, err);
      }
    }
  });
};
