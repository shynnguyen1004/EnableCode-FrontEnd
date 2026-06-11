import type { BlocklyOptions } from 'blockly';

const CATEGORY_BLOCKS: Record<string, string[]> = {
  event: ['controls_start'],
  output: ['text_print'],
  text: ['text', 'text_join'],
  loops: ['controls_repeat_ext'],
  logic: ['controls_if'],
  variables: ['variables_set', 'variables_get'],
  math: ['math_number', 'math_arithmetic'],
  action: ['move_forward'],
};

const CATEGORY_LABELS: Record<string, string> = {
  event: 'Events',
  output: 'Output',
  text: 'Text',
  loops: 'Loops',
  logic: 'Logic',
  variables: 'Variables',
  math: 'Math',
  action: 'Actions',
};

/** All 11 block types across 8 toolbox categories. */
export const ALL_TOOLBOX_CATEGORIES = [
  'event',
  'output',
  'text',
  'loops',
  'logic',
  'variables',
  'math',
  'action',
] as const;

const DEFAULT_CATEGORIES = [...ALL_TOOLBOX_CATEGORIES];

export function buildToolbox(toolboxConfig: Record<string, unknown> | undefined): BlocklyOptions['toolbox'] {
  const categories = Array.isArray(toolboxConfig?.categories)
    ? (toolboxConfig.categories as string[])
    : DEFAULT_CATEGORIES;

  return {
    kind: 'categoryToolbox',
    contents: categories
      .filter(category => CATEGORY_BLOCKS[category])
      .map(category => ({
        kind: 'category' as const,
        name: CATEGORY_LABELS[category] ?? category,
        categorystyle: `${category}_category`,
        contents: CATEGORY_BLOCKS[category].map(type => ({
          kind: 'block' as const,
          type,
        })),
      })),
  };
}
