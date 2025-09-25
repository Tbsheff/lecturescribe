export function createMockAudioFile(
  name: string = 'test-audio.wav',
  type: string = 'audio/wav',
  size: number = 1024 * 1024 // 1MB
): File {
  const buffer = new ArrayBuffer(size);
  const blob = new Blob([buffer], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
}

export function createMockAudioBlob(
  type: string = 'audio/wav',
  size: number = 1024 * 1024
): Blob {
  const buffer = new ArrayBuffer(size);
  return new Blob([buffer], { type });
}

export const mockAudioFiles = {
  validWav: createMockAudioFile('test.wav', 'audio/wav', 1024 * 1024),
  validMp3: createMockAudioFile('test.mp3', 'audio/mpeg', 2 * 1024 * 1024),
  validM4a: createMockAudioFile('test.m4a', 'audio/x-m4a', 1.5 * 1024 * 1024),
  validWebm: createMockAudioFile('test.webm', 'audio/webm', 1024 * 1024),
  invalidType: createMockAudioFile('test.txt', 'text/plain', 1024),
  emptyFile: createMockAudioFile('empty.wav', 'audio/wav', 0),
  oversizedFile: createMockAudioFile('large.wav', 'audio/wav', 101 * 1024 * 1024), // 101MB
};

export function mockFetch(response: any, ok: boolean = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  });
}

export const mockTranscriptionResponse = {
  transcription: 'This is a test transcription of the audio file.',
  summary: 'Test audio file transcribed successfully.',
  keyPoints: ['Test point 1', 'Test point 2'],
  confidence: 0.95,
};

export const mockNoteData = {
  id: 'test-note-123',
  user_id: 'test-user-123',
  title: 'Test Note',
  transcription: 'Test transcription content',
  raw_summary: 'Test summary content',
  audio_url: 'https://test.supabase.co/storage/v1/object/public/audio/test.wav',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};