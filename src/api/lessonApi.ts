import axiosClient from './axiosClient';

export const lessonApi = {
  // Retrieves all chapters/topics available in the Python curriculum
  getTopics: () => {
    return axiosClient.get('/api/topics');
  },

  // Fetches all individual lessons belonging to a specific topic ID
  getLessonsByTopic: (topicId: string) => {
    return axiosClient.get(`/api/topics/${topicId}/lessons`);
  },

  // Loads complete workspace configurations and public test cases for a single lesson
  getLessonDetails: (lessonId: string) => {
    return axiosClient.get(`/api/lessons/${lessonId}`);
  },

  // Autosaves the student's current Blockly block layout as a draft without triggering grading
  saveDraftProgress: (lessonId: string, workspaceState: Record<string, unknown>) => {
    return axiosClient.post(`/api/lessons/${lessonId}/save-progress`, { workspace_state: workspaceState });
  },

  // Compiles and submits Python source code to be executed via Piston and graded against hidden test cases
  submitWorkspace: (
    lessonId: string,
    pythonCode: string,
    workspaceState: Record<string, unknown>,
    timeTaken: number,
  ) => {
    return axiosClient.post(`/api/lessons/${lessonId}/submit`, {
      python_code: pythonCode,
      workspace_state: workspaceState,
      time_taken: timeTaken,
    });
  },
};
