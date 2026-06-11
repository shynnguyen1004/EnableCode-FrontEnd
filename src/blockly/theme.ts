import * as Blockly from 'blockly';

/** One distinct colour per toolbox category (8 groups). */
export const CATEGORY_COLOURS = {
  event: '#D32F2F',
  output: '#9B51E0',
  text: '#E91E8C',
  loops: '#FF7700',
  logic: '#4A90E2',
  variables: '#F5C518',
  math: '#00ACC1',
  action: '#74A258',
} as const;

function blockShades(primary: string, secondary: string, tertiary: string) {
  return {
    colourPrimary: primary,
    colourSecondary: secondary,
    colourTertiary: tertiary,
    hat: '' as const,
  };
}

export const enableCodeTheme = Blockly.Theme.defineTheme('enablecode', {
  name: 'enablecode',
  base: Blockly.Themes.Zelos,
  blockStyles: {
    event_blocks: {
      ...blockShades(CATEGORY_COLOURS.event, '#B71C1C', '#8B0000'),
      hat: 'cap',
    },
    output_blocks: blockShades(CATEGORY_COLOURS.output, '#7B3FB8', '#5B2F8A'),
    text_blocks: blockShades(CATEGORY_COLOURS.text, '#C2185B', '#880E4F'),
    loop_blocks: blockShades(CATEGORY_COLOURS.loops, '#E56A00', '#CC5E00'),
    logic_blocks: blockShades(CATEGORY_COLOURS.logic, '#3A78C2', '#2A60A2'),
    variable_blocks: blockShades(CATEGORY_COLOURS.variables, '#D4A800', '#B38F00'),
    math_blocks: blockShades(CATEGORY_COLOURS.math, '#00838F', '#006064'),
    action_blocks: blockShades(CATEGORY_COLOURS.action, '#5E8648', '#486A38'),
  },
  categoryStyles: {
    event_category: { colour: CATEGORY_COLOURS.event },
    output_category: { colour: CATEGORY_COLOURS.output },
    text_category: { colour: CATEGORY_COLOURS.text },
    loops_category: { colour: CATEGORY_COLOURS.loops },
    logic_category: { colour: CATEGORY_COLOURS.logic },
    variables_category: { colour: CATEGORY_COLOURS.variables },
    math_category: { colour: CATEGORY_COLOURS.math },
    action_category: { colour: CATEGORY_COLOURS.action },
  },
  componentStyles: {
    workspaceBackgroundColour: 'transparent',
    toolboxBackgroundColour: '#111111',
    toolboxForegroundColour: '#FFF9DC',
    flyoutBackgroundColour: '#111111',
    flyoutForegroundColour: '#FFF9DC',
    flyoutOpacity: 0.96,
    scrollbarColour: '#FFF9DC',
    scrollbarOpacity: 0.35,
    insertionMarkerColour: '#FF7700',
    insertionMarkerOpacity: 0.55,
  },
  fontStyle: {
    family: 'Montserrat, sans-serif',
    weight: 'bold',
    size: 13,
  },
  startHats: true,
});
