# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development
- `npm run dev` - Start the development server (Vite)
- `npm run build` - Create production build
- `npm run build:dev` - Create development build
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint to check code quality

### TypeScript Checking
- `npx tsc --noEmit` - Run TypeScript type checking (no test script configured)

## High-Level Architecture

### Project Overview
LectureScribe is a React-based note-taking and transcription application built with:
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui components + Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **State Management**: Zustand + React Query (TanStack Query)
- **Routing**: React Router v6

### Key Architectural Patterns

1. **Component Organization**
   - Components are organized by feature in `/src/components/`
   - All pages wrapped in `AdminPanelLayout` with collapsible sidebar
   - UI components from shadcn/ui in `/src/components/ui/`

2. **Authentication Flow**
   - Centralized auth management via `AuthProvider` context
   - Supabase Auth integration for user management
   - Protected routes redirect to `/auth` when not authenticated

3. **Data Flow**
   - Services layer (`/src/services/`) handles business logic
   - React Query for server state management
   - Zustand for client state (sidebar, theme preferences)

4. **Audio Processing**
   - Audio recording with custom visualization components
   - Supabase Edge Function for transcription using Google Gemini API
   - Edge Function at `/supabase/functions/summarize-audio/`

5. **Note Management**
   - Rich text editing with BlockNote and EditorJS
   - Folder-based organization with hierarchical structure
   - Notes stored in Supabase with file uploads to EdgeStore

### Key Services

- **Transcription Service** (`src/services/transcription.ts`) - Handles audio upload and transcription
- **Note Storage** (`src/services/noteStorage.ts`) - CRUD operations for notes
- **Folder Management** (`src/services/folderService.ts`) - Folder hierarchy management
- **Migration Service** (`src/services/migration.ts`) - Data migration utilities

### Important Configuration

- **Path Aliases**: `@/*` maps to `./src/*`
- **TypeScript**: Relaxed settings (no strict mode, allows implicit any)
- **ESLint**: Configured with React hooks and refresh plugins
- **Tailwind**: Extended theme with custom animations and colors

### Supabase Integration

- **Database**: PostgreSQL with migrations in `/supabase/migrations/`
- **Storage**: Audio files and note attachments
- **Edge Functions**: Audio transcription with Gemini API
- **Auth**: Email/password authentication

### Development Notes

- No test framework configured - add testing infrastructure as needed
- Lazy loading implemented for MigrationPage and FolderView routes
- Theme support with light/dark mode via next-themes
- Admin panel layout provides consistent navigation across all pages