import { createClient } from '@supabase/supabase-js';

// Local Supabase configuration for testing
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const testSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const testSupabaseServiceClient = createClient(
  supabaseUrl,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Test user helpers
export const TEST_USER_EMAIL = 'test@example.com';
export const TEST_USER_PASSWORD = 'test123456';

export const createTestUser = async () => {
  // First try to sign up the user
  const { data: signUpData, error: signUpError } = await testSupabaseClient.auth.signUp({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  if (signUpError && !signUpError.message.includes('already registered')) {
    console.error('Sign up failed:', signUpError);
    throw signUpError;
  }
  
  return signUpData.user;
};

export const signInTestUser = async () => {
  const { data, error } = await testSupabaseClient.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  if (error) {
    throw error;
  }
  
  // Verify we have a session
  const { data: sessionData } = await testSupabaseClient.auth.getSession();
  if (!sessionData?.session) {
    throw new Error('No session found after sign in');
  }
  
  return data.user;
};

export const cleanupTestData = async () => {
  // Clean up test data after each test - delete all data for safety in test environment
  try {
    // Delete all note metadata
    const { error: noteError } = await testSupabaseServiceClient.from('note_metadata').delete().neq('id', '');
    if (noteError) {
      console.warn('Note metadata cleanup failed:', noteError);
    }
    
    // Delete all folders
    const { error: folderError } = await testSupabaseServiceClient.from('folders').delete().neq('id', '');
    if (folderError) {
      console.warn('Folder cleanup failed:', folderError);
    }
    
    // Clean up storage files recursively
    try {
      const { data: files } = await testSupabaseServiceClient.storage.from('notes').list('', {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });
      if (files && files.length > 0) {
        // Get all files recursively
        const allFiles = [];
        for (const file of files) {
          if (file.name) {
            allFiles.push(file.name);
            // If it's a directory, get files inside
            try {
              const { data: subFiles } = await testSupabaseServiceClient.storage.from('notes').list(file.name, {
                limit: 1000
              });
              if (subFiles) {
                subFiles.forEach(subFile => {
                  if (subFile.name) {
                    allFiles.push(`${file.name}/${subFile.name}`);
                  }
                });
              }
            } catch (subError) {
              // Continue if directory listing fails
            }
          }
        }
        
        if (allFiles.length > 0) {
          const { error: removeError } = await testSupabaseServiceClient.storage.from('notes').remove(allFiles);
          if (removeError) {
            console.warn('Storage file removal failed:', removeError);
          }
        }
      }
    } catch (storageError) {
      console.warn('Storage cleanup failed:', storageError);
    }
  } catch (error) {
    console.warn('General cleanup failed:', error);
  }
  
  // Sign out current user
  await testSupabaseClient.auth.signOut();
};