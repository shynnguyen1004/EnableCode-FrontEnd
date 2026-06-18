import * as Blockly from 'blockly';

/** Category colours in rainbow order (red → pink). */
export const CATEGORY_COLOURS = {
  event: '#E53935',
  loops: '#FF7700',
  variables: '#F5C518',
  action: '#74A258',
  logic: '#4A90E2',
  math: '#00BCD4',
  output: '#9B51E0',
  text: '#E91E8C',
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
      ...blockShades(CATEGORY_COLOURS.event, '#C62828', '#B71C1C'),
      hat: 'cap',
    },
    loop_blocks: blockShades(CATEGORY_COLOURS.loops, '#E56A00', '#CC5E00'),
    variable_blocks: blockShades(CATEGORY_COLOURS.variables, '#D4A800', '#B38F00'),
    action_blocks: blockShades(CATEGORY_COLOURS.action, '#5E8648', '#486A38'),
    logic_blocks: blockShades(CATEGORY_COLOURS.logic, '#3A78C2', '#2A60A2'),
    math_blocks: blockShades(CATEGORY_COLOURS.math, '#0097A7', '#006064'),
    output_blocks: blockShades(CATEGORY_COLOURS.output, '#7B3FB8', '#5B2F8A'),
    text_blocks: blockShades(CATEGORY_COLOURS.text, '#C2185B', '#880E4F'),
  },
  categoryStyles: {
    event_category: { colour: CATEGORY_COLOURS.event },
    loops_category: { colour: CATEGORY_COLOURS.loops },
    variables_category: { colour: CATEGORY_COLOURS.variables },
    action_category: { colour: CATEGORY_COLOURS.action },
    logic_category: { colour: CATEGORY_COLOURS.logic },
    math_category: { colour: CATEGORY_COLOURS.math },
    output_category: { colour: CATEGORY_COLOURS.output },
    text_category: { colour: CATEGORY_COLOURS.text },
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
    family: 'Unbounded, Montserrat, sans-serif',
    weight: 'bold',
    size: 14,
  },
  startHats: true,
});
