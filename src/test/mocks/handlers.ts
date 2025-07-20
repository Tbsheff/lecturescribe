import { http, HttpResponse } from 'msw';

// Mock Supabase API endpoints
export const handlers = [
  // Auth endpoints
  http.post('*/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
      },
    });
  }),

  http.post('*/auth/v1/signup', () => {
    return HttpResponse.json({
      id: 'mock-user-id',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    });
  }),

  http.post('*/auth/v1/logout', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/auth/v1/user', () => {
    return HttpResponse.json({
      id: 'mock-user-id',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    });
  }),

  // Storage endpoints
  http.post('*/storage/v1/object/notes/*', () => {
    return HttpResponse.json({
      Key: 'notes/mock-note-id/note.json',
    });
  }),

  http.get('*/storage/v1/object/notes/*', () => {
    return HttpResponse.json({
      id: 'mock-note-id',
      title: 'Mock Note',
      transcription: 'This is a mock transcription',
      summary: 'This is a mock summary',
      created_at: new Date().toISOString(),
    });
  }),

  http.delete('*/storage/v1/object/notes/*', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Database endpoints - Notes metadata
  http.get('*/rest/v1/note_metadata', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    
    if (userId === 'eq.mock-user-id') {
      return HttpResponse.json([
        {
          id: 'mock-note-1',
          user_id: 'mock-user-id',
          title: 'Mock Note 1',
          preview: 'This is a preview of mock note 1',
          created_at: new Date().toISOString(),
          folder_id: null,
        },
        {
          id: 'mock-note-2',
          user_id: 'mock-user-id',
          title: 'Mock Note 2',
          preview: 'This is a preview of mock note 2',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          folder_id: 'mock-folder-1',
        },
      ]);
    }
    
    return HttpResponse.json([]);
  }),

  http.post('*/rest/v1/note_metadata', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ...body,
      id: 'mock-new-note-id',
      created_at: new Date().toISOString(),
    });
  }),

  http.patch('*/rest/v1/note_metadata', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ...body,
      updated_at: new Date().toISOString(),
    });
  }),

  http.delete('*/rest/v1/note_metadata', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Database endpoints - Folders
  http.get('*/rest/v1/folders', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    
    if (userId === 'eq.mock-user-id') {
      return HttpResponse.json([
        {
          id: 'mock-folder-1',
          user_id: 'mock-user-id',
          name: 'Mock Folder 1',
          parent_id: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 'mock-folder-2',
          user_id: 'mock-user-id',
          name: 'Mock Subfolder',
          parent_id: 'mock-folder-1',
          created_at: new Date().toISOString(),
        },
      ]);
    }
    
    return HttpResponse.json([]);
  }),

  http.post('*/rest/v1/folders', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ...body,
      id: 'mock-new-folder-id',
      created_at: new Date().toISOString(),
    });
  }),

  http.patch('*/rest/v1/folders', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ...body,
      updated_at: new Date().toISOString(),
    });
  }),

  http.delete('*/rest/v1/folders', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Edge function - Audio summarization
  http.post('*/functions/v1/summarize-audio', async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.audioUrl) {
      return HttpResponse.json({
        transcription: 'This is a mock transcription of the audio file.',
        summary: '## Summary\n\nThis is a mock summary of the transcribed audio.\n\n## Key Points\n\n- Mock key point 1\n- Mock key point 2\n- Mock key point 3',
      });
    }
    
    if (body.audioText) {
      return HttpResponse.json({
        transcription: body.audioText,
        summary: '## Summary\n\nThis is a mock summary of the provided text.',
      });
    }
    
    return HttpResponse.json(
      { error: 'No audio URL or text provided' },
      { status: 400 }
    );
  }),
];