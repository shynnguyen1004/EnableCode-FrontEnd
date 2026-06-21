import type { BlocklyOptions } from 'blockly';

const CATEGORY_BLOCKS: Record<string, string[]> = {
  event: ['controls_start'],
  loops: ['controls_repeat_ext'],
  variables: ['variables_set', 'variables_get'],
  action: ['move_forward'],
  logic: ['controls_if'],
  math: ['math_number', 'math_arithmetic'],
  output: ['text_print'],
  text: ['text', 'text_join'],
};

const CATEGORY_LABELS: Record<string, string> = {
  event: 'Events',
  loops: 'Loops',
  variables: 'Variables',
  action: 'Actions',
  logic: 'Logic',
  math: 'Math',
  output: 'Output',
  text: 'Text',
};

/** Toolbox display order — rainbow top to bottom. */
export const RAINBOW_CATEGORY_ORDER = [
  'event',
  'loops',
  'variables',
  'action',
  'logic',
  'math',
  'output',
  'text',
] as const;

export const ALL_TOOLBOX_CATEGORIES = [...RAINBOW_CATEGORY_ORDER];

const DEFAULT_CATEGORIES = [...ALL_TOOLBOX_CATEGORIES];

function sortCategories(categories: string[]): string[] {
  const order = new Map(RAINBOW_CATEGORY_ORDER.map((category, index) => [category, index]));

  return [...categories].sort((left, right) => {
    const leftIndex = order.get(left as (typeof RAINBOW_CATEGORY_ORDER)[number]) ?? 99;
    const rightIndex = order.get(right as (typeof RAINBOW_CATEGORY_ORDER)[number]) ?? 99;
    return leftIndex - rightIndex;
  });
}

export function buildToolbox(toolboxConfig: Record<string, unknown> | undefined): BlocklyOptions['toolbox'] {
  if (
    toolboxConfig &&
    toolboxConfig.kind &&
    Array.isArray(toolboxConfig.contents) &&
    toolboxConfig.contents.length > 0
  ) {
    return toolboxConfig as unknown as BlocklyOptions['toolbox'];
  }
  const categories = sortCategories(
    Array.isArray(toolboxConfig?.categories) ? (toolboxConfig.categories as string[]) : DEFAULT_CATEGORIES,
  );
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
