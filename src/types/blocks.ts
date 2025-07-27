/**
 * Block-based content types for LectureScribe
 * Defines the structure for storing lecture content as composable blocks
 */

// Block type enum - defines all supported block types in LectureScribe
export type BlockType = 
  | 'text'           // Regular paragraph
  | 'heading-1'      // Main section (h1)
  | 'heading-2'      // Subsection (h2)  
  | 'heading-3'      // Sub-subsection (h3)
  | 'transcription'  // AI transcribed text segment
  | 'summary'        // AI generated summary
  | 'key-point'      // Important highlight/callout
  | 'action-item'    // Todo item from lecture
  | 'audio-clip'     // Timestamped audio segment
  | 'slide-image'    // Lecture slide or image
  | 'annotation'     // User comment/note
  | 'quote'          // Important quote from lecture
  | 'code'           // Code snippet
  | 'table'          // Structured data table
  | 'divider'        // Section separator
  | 'video-embed'    // Embedded video player
  | 'video-timestamp'// Clickable video timestamp
  | 'video-caption'  // Video caption/subtitle
  | 'video-chapter'; // Video chapter marker

// Core block interface - matches database schema
export interface Block {
  id: string;
  user_id: string;
  note_id: string;
  parent_id: string | null;
  position: number;
  type: BlockType;
  props: BlockProps;
  created_at: string;
  updated_at: string;
  audio_timestamp: number | null;
  ai_generated: boolean;
  version: number;
}

// Base interface for all block props
export interface BaseBlockProps {
  created_by?: string;
  edited_by?: string;
  tags?: string[];
  locked?: boolean; // Prevent editing
  collapsed?: boolean; // For hierarchical content
}

// Formatting options for text content
export interface TextFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  highlight_color?: string;
  text_color?: string;
  font_size?: 'small' | 'normal' | 'large';
}

// Text block props
export interface TextBlockProps extends BaseBlockProps {
  text: string;
  formatting?: TextFormatting;
}

// Heading block props
export interface HeadingBlockProps extends BaseBlockProps {
  text: string;
  level: 1 | 2 | 3;
  collapsed?: boolean; // Can collapse child blocks
  formatting?: TextFormatting;
}

// Transcription block props - for AI-generated transcription content
export interface TranscriptionBlockProps extends BaseBlockProps {
  text: string;
  confidence?: number; // AI confidence score 0-1
  speaker?: string;
  audio_start?: number;
  audio_end?: number;
  language?: string;
  corrected?: boolean; // User has edited AI transcription
  original_text?: string; // Store original AI text if corrected
}

// Audio clip block props - for embedded audio segments
export interface AudioClipProps extends BaseBlockProps {
  audio_url: string;
  start_time: number;
  end_time: number;
  title?: string;
  description?: string;
  waveform_data?: number[]; // For visualization
  playback_speed?: number;
}

// Summary block props - for AI or user-generated summaries
export interface SummaryBlockProps extends BaseBlockProps {
  text: string;
  summary_type: 'ai-generated' | 'user-written' | 'key-points' | 'outline';
  source_blocks?: string[]; // IDs of blocks this summarizes
  model_used?: string; // AI model that generated this
  confidence?: number; // AI confidence if applicable
}

// Action item/todo block props
export interface ActionItemProps extends BaseBlockProps {
  text: string;
  completed?: boolean;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  assigned_to?: string;
  completion_date?: string;
}

// Key point/highlight block props
export interface KeyPointProps extends BaseBlockProps {
  text: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  category?: string; // Custom categorization
  source_reference?: string; // Reference to source material
}

// Slide/image block props
export interface SlideImageProps extends BaseBlockProps {
  image_url: string;
  alt_text?: string;
  caption?: string;
  slide_number?: number;
  extracted_text?: string; // OCR text from slide
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

// Annotation/comment block props
export interface AnnotationProps extends BaseBlockProps {
  text: string;
  annotation_type: 'comment' | 'question' | 'insight' | 'confusion' | 'clarification';
  references?: string[]; // Block IDs this annotates
  resolved?: boolean;
  thread_id?: string; // For comment threads
}

// Quote block props
export interface QuoteProps extends BaseBlockProps {
  text: string;
  source?: string;
  author?: string;
  citation?: string;
  timestamp?: number; // If from audio
}

// Code block props
export interface CodeBlockProps extends BaseBlockProps {
  code: string;
  language?: string;
  filename?: string;
  line_numbers?: boolean;
  theme?: 'light' | 'dark';
  copy_button?: boolean;
}

// Table block props
export interface TableBlockProps extends BaseBlockProps {
  headers: string[];
  rows: string[][];
  caption?: string;
  sortable?: boolean;
  striped?: boolean;
}

// Divider block props
export interface DividerProps extends BaseBlockProps {
  style?: 'line' | 'dots' | 'stars' | 'custom';
  thickness?: number;
  color?: string;
  margin?: number;
}

// Video embed block props - for embedded video players
export interface VideoEmbedProps extends BaseBlockProps {
  video_id: string;
  platform: 'youtube' | 'vimeo' | 'uploaded';
  start_time?: number;
  end_time?: number;
  autoplay?: boolean;
  muted?: boolean;
  title?: string;
}

// Video timestamp block props - clickable timestamps
export interface VideoTimestampProps extends BaseBlockProps {
  text: string;
  timestamp: number; // in seconds
  video_id?: string;
  label?: string;
}

// Video caption block props - for subtitles/captions
export interface VideoCaptionProps extends BaseBlockProps {
  text: string;
  start_time: number;
  end_time: number;
  speaker?: string;
  language?: string;
  auto_generated?: boolean;
}

// Video chapter block props - for chapter markers
export interface VideoChapterProps extends BaseBlockProps {
  title: string;
  timestamp: number;
  description?: string;
  thumbnail_url?: string;
}

// Union type for all possible block props
export type BlockProps = 
  | TextBlockProps
  | HeadingBlockProps
  | TranscriptionBlockProps
  | AudioClipProps
  | SummaryBlockProps
  | ActionItemProps
  | KeyPointProps
  | SlideImageProps
  | AnnotationProps
  | QuoteProps
  | CodeBlockProps
  | TableBlockProps
  | DividerProps
  | VideoEmbedProps
  | VideoTimestampProps
  | VideoCaptionProps
  | VideoChapterProps;

// Note interface - matches the enhanced notes table
export interface Note {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  audio_url: string | null;
  duration: number | null;
  created_at: string;
  updated_at: string;
  block_count: number;
  last_edit_by: string | null;
}

// Extended note with computed properties
export interface NoteWithMetadata extends Note {
  preview?: string;
  last_block_update?: string;
  block_count_calc?: number;
}

// Tree structure for hierarchical block display
export interface BlockTreeNode {
  id: string;
  note_id: string;
  parent_id: string | null;
  type: BlockType;
  props: BlockProps;
  position: number;
  depth: number;
  path: number[];
  sort_path: string;
  children?: BlockTreeNode[];
}

// Block creation/update interfaces
export interface CreateBlockRequest {
  note_id: string;
  parent_id?: string | null;
  position: number;
  type: BlockType;
  props: BlockProps;
  audio_timestamp?: number | null;
  ai_generated?: boolean;
}

export interface UpdateBlockRequest {
  type?: BlockType;
  props?: Partial<BlockProps>;
  position?: number;
  parent_id?: string | null;
  audio_timestamp?: number | null;
}

// Block operation types for real-time collaboration
export interface BlockOperation {
  type: 'insert' | 'update' | 'delete' | 'move';
  block_id: string;
  note_id: string;
  user_id: string;
  timestamp: string;
  data?: CreateBlockRequest | UpdateBlockRequest;
  version: number;
}

// Search result interface
export interface BlockSearchResult {
  block: Block;
  note: Note;
  snippet: string;
  highlight_ranges: Array<{ start: number; end: number }>;
  relevance_score: number;
}

// Export types for external systems
export interface ExportFormat {
  format: 'markdown' | 'html' | 'json' | 'pdf' | 'docx';
  include_metadata?: boolean;
  include_audio_links?: boolean;
  flatten_hierarchy?: boolean;
}

// Collaboration types (for future features)
export interface BlockComment {
  id: string;
  block_id: string;
  user_id: string;
  text: string;
  created_at: string;
  resolved: boolean;
  thread_id?: string;
}

export interface BlockShare {
  id: string;
  note_id: string;
  user_id: string;
  shared_with: string;
  permission: 'read' | 'write' | 'admin';
  created_at: string;
}