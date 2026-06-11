/** Use bundled curriculum JSON instead of the REST API (default on in dev). */
export const isMockDataEnabled =
  import.meta.env.VITE_USE_MOCK_DATA === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_DATA !== 'false');

/** First Blockly intro lesson — handy for local workspace testing. */
export const DEV_WORKSPACE_LESSON_ID = '664b00000000000000000001';

/** Topic: "Làm quen với Blockly" */
export const DEV_WORKSPACE_TOPIC_ID = '664a00000000000000000001';
