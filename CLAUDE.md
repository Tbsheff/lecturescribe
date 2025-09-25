# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LectureScribe is a web application for audio transcription, note-taking, and content management built with React, TypeScript, Vite, and Supabase. The application features real-time transcription capabilities using Deepgram and Gemini providers, rich text editing with BlockNote, and file storage with EdgeStore.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 8080)
npm run dev

# Build for production
npm run build

# Build for development mode
npm run build:dev

# Run ESLint
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Core Technologies
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: Zustand + React Context
- **Data Fetching**: Tanstack Query
- **Backend**: Supabase (Auth, Database, Storage, Functions)
- **Router**: React Router v6
- **Editor**: BlockNote (rich text) + EditorJS components

### Project Structure
```
src/
├── components/       # UI components (shadcn/ui + custom)
│   ├── admin-panel/ # Admin layout components
│   ├── audio/       # Audio recording/visualization
│   ├── editor/      # BlockNote editor components
│   ├── notes/       # Note management components
│   └── ui/          # shadcn/ui components
├── hooks/           # Custom React hooks
├── integrations/    # External service integrations
│   └── supabase/    # Supabase client and types
├── lib/             # Utility libraries
├── pages/           # Route page components
├── services/        # Business logic and API services
│   ├── providers/   # Transcription providers (Deepgram, Gemini)
│   ├── transcriptionService.ts
│   ├── noteStorage.ts
│   └── realtimeSessionManager.ts
├── types/           # TypeScript type definitions
└── utils/           # Helper functions
```

### Key Features & Services

#### Transcription System
- **Dual Provider Support**: Gemini (default) and Deepgram integration
- **Real-time Transcription**: Live audio capture and transcription via `realtimeSessionManager.ts`
- **File Upload**: Audio file processing through Supabase Functions
- **Provider Management**: Configurable via `transcriptionConfig.ts` and `transcriptionManager.ts`

#### Note Management
- **Storage**: Notes stored in Supabase with `noteStorage.ts`
- **Editor**: Rich text editing using BlockNote (`EnhancedEditor.tsx`)
- **Organization**: Folder system managed by `folderService.ts`
- **Migration**: Legacy data migration support (`migrationService.ts`)

#### Authentication & Layout
- **Auth Provider**: Custom hook `useAuth.tsx` wrapping Supabase Auth
- **Admin Layout**: Collapsible sidebar navigation with theme support
- **Protected Routes**: All main routes wrapped in `AdminPanelLayout`

### Environment Variables
Required environment variables (in `.env`):
```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Optional for transcription providers:
- Deepgram API credentials (configured in provider)
- Gemini API credentials (configured in provider)

### Path Aliases
The project uses `@/` as an alias for `src/`:
```typescript
import { Button } from "@/components/ui/button"
```

### TypeScript Configuration
- Relaxed type checking (no implicit any, unused parameters/locals allowed)
- Path aliases configured for `@/*` → `./src/*`
- Separate configs for app (`tsconfig.app.json`) and node (`tsconfig.node.json`)

### Important Considerations
1. **Supabase Integration**: The app has a mock Supabase client for development when credentials aren't provided
2. **Lovable Integration**: Built with Lovable.dev, includes component tagging in dev mode
3. **Tempo DevTools**: Optional integration when `TEMPO=true` environment variable is set
4. **No Test Runner**: Currently no test framework configured (only one test file exists at `src/tests/transcription.test.ts`)
5. **Database**: Supabase migrations are located in `supabase/migrations/`

### Common Development Tasks
- To add a new page: Create component in `src/pages/`, add route in `App.tsx` wrapped with `AdminPanelLayout`
- To modify UI components: Check `src/components/ui/` for shadcn components, follow existing patterns
- To work with transcription: Use `transcriptionManager.ts` for provider selection, `realtimeSessionManager.ts` for live transcription
- To manage notes: Use `noteStorage.ts` for CRUD operations, integrate with `NoteEditor.tsx` for editing