# LectureScribe - Audio Transcription & Note-Taking App

## Overview

LectureScribe is a modern React-based web application that transforms audio lectures and recordings into structured, AI-powered notes. The app leverages Google's Gemini AI for transcription and summarization, providing students and professionals with an intelligent note-taking solution.

## Core Features

### 🎙️ Multi-Modal Audio Input
- **Live Recording**: Real-time audio recording with visual feedback and waveform display
- **File Upload**: Support for multiple audio formats (MP3, WAV, M4A, WebM)
- **URL Processing**: Planned support for YouTube and other web-based audio sources

### 🤖 AI-Powered Processing
- **Automatic Transcription**: Uses Google Gemini 2.0 Flash model for accurate speech-to-text
- **Smart Summarization**: Generates structured lecture notes with key points and sections
- **Markdown Formatting**: Well-organized output with headers, bullet points, and emphasis

### 📝 Note Management
- **Searchable Library**: Full-text search across all notes and summaries
- **Folder Organization**: Hierarchical folder structure for content organization
- **Rich Text Editor**: Enhanced editor with BlockNote integration for note editing
- **Real-time Sync**: Automatic saving and synchronization across devices

### 🔐 User Authentication & Data Security
- **Supabase Auth**: Secure user authentication and session management
- **User-Specific Storage**: Isolated data storage per user account
- **Cloud Backup**: Automatic backup of all notes and audio files

## Technical Architecture

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom theming
- **Routing**: React Router DOM for client-side navigation
- **State Management**: Zustand for global state, React Query for server state

### Backend & Services
- **Database**: Supabase PostgreSQL with real-time subscriptions
- **Storage**: Supabase Storage for audio file management
- **AI Processing**: Google Gemini API via Supabase Edge Functions
- **Authentication**: Supabase Auth with email/password and social logins

### Key Components

#### Audio Processing Pipeline
1. **Audio Capture**: `AudioRecorder.tsx` - Records audio with real-time visualization
2. **File Upload**: `AudioUploader.tsx` - Handles file selection and validation
3. **Processing Service**: `transcription.ts` - Orchestrates upload and AI processing
4. **Edge Function**: `summarize-audio/index.ts` - Deno-based function for Gemini API integration

#### User Interface
- **Admin Panel Layout**: Collapsible sidebar with navigation and user controls
- **Theme System**: Dark/light mode toggle with persistent preferences
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Accessibility**: ARIA compliance and keyboard navigation support

## File Structure

```
src/
├── components/
│   ├── admin-panel/         # Admin layout components
│   ├── audio/              # Audio recording/upload components
│   ├── editor/             # Rich text editor components
│   ├── notes/              # Note management components
│   ├── ui/                 # Reusable UI components
│   └── providers/          # Context providers
├── hooks/                  # Custom React hooks
├── pages/                  # Route components
├── services/               # API and business logic
├── lib/                    # Utility functions
└── types/                  # TypeScript type definitions
```

## Key Dependencies

### Core Framework
- `react` & `react-dom` - UI framework
- `typescript` - Type safety
- `vite` - Build tool and dev server

### UI & Design
- `@radix-ui/*` - Accessible UI primitives
- `tailwindcss` - Utility-first CSS framework
- `lucide-react` - Icon library
- `next-themes` - Theme management

### Data & State
- `@supabase/supabase-js` - Backend integration
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management

### Audio & Editor
- `@blocknote/react` - Rich text editor
- `react-markdown` - Markdown rendering
- Custom audio recording hooks

## Recent Development

The application has undergone significant refactoring to improve the layout system:
- Removed legacy layout components in favor of a unified admin panel layout
- Implemented collapsible sidebar navigation
- Enhanced theme support across all components
- Improved responsive design patterns

## Environment Setup

### Required Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `GEMINI_API_KEY` - Google Gemini API key (server-side)

### Development Commands
```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
npm run lint        # Run ESLint
```

## Deployment

The application is designed to work with the Lovable platform for streamlined deployment, with automatic builds and deployments triggered by git commits. The app can also be deployed to other platforms like Netlify or Vercel with minimal configuration.

## Future Enhancements

- URL-based audio processing (YouTube, podcasts)
- Advanced note organization features
- Collaborative note sharing
- Export functionality (PDF, Word)
- Integration with learning management systems
- Mobile app development