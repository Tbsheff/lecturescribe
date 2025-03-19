import React, { useState, useRef, useEffect } from 'react';
import {
  EditorContent,
  EditorRoot,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
} from "novel";
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Bold as BoldExtension } from '@tiptap/extension-bold';
import { Italic as ItalicExtension } from '@tiptap/extension-italic';
import { Heading } from '@tiptap/extension-heading';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { Blockquote } from '@tiptap/extension-blockquote';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { CodeBlock } from '@tiptap/extension-code-block';
import { Link as LinkExtension } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import debounce from 'lodash.debounce';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Image,
  Minus,
  Link as LinkIcon,
  Bold,
  Italic,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

// Create extensions array with document structure and formatting options
const extensions = [
  // Core required extensions
  Document,
  Paragraph,
  Text,
  // Formatting extensions
  BoldExtension,
  ItalicExtension,
  Heading.configure({
    levels: [1, 2, 3],
  }),
  // List extensions
  BulletList,
  OrderedList,
  ListItem,
  // Block extensions
  Blockquote,
  HorizontalRule,
  CodeBlock.configure({
    HTMLAttributes: {
      class: 'rounded-md bg-muted p-4 font-mono',
    },
  }),
  // Link extension
  LinkExtension.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'text-primary underline underline-offset-4',
    },
  }),
  // Placeholder extension
  Placeholder.configure({
    placeholder: 'Type / for commands...',
  }),
];

// Default content for new notes with proper ProseMirror schema
const defaultContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "" }]
    }
  ]
};

// Parse string content into valid ProseMirror doc
const parseContent = (content: string) => {
  try {
    // Try parsing as JSON first
    const parsed = JSON.parse(content);
    // Ensure the content has the required schema structure
    if (!parsed.type || parsed.type !== 'doc' || !Array.isArray(parsed.content)) {
      throw new Error('Invalid document structure');
    }
    return parsed;
  } catch (e) {
    // If parsing fails, convert plain text to a proper document structure
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: content || "" }]
        }
      ]
    };
  }
};

// Slash command suggestions
const suggestionItems = [
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: <Heading1 className="h-5 w-5" />,
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <Heading2 className="h-5 w-5" />,
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <Heading3 className="h-5 w-5" />,
  },
  {
    title: "Bullet List",
    description: "Create a bullet list",
    icon: <List className="h-5 w-5" />,
  },
  {
    title: "Numbered List",
    description: "Create a numbered list",
    icon: <ListOrdered className="h-5 w-5" />,
  },
  {
    title: "Task List",
    description: "Create a task list",
    icon: <CheckSquare className="h-5 w-5" />,
  },
  {
    title: "Code Block",
    description: "Add a code block",
    icon: <Code className="h-5 w-5" />,
  },
  {
    title: "Quote",
    description: "Add a quote",
    icon: <Quote className="h-5 w-5" />,
  },
  {
    title: "Horizontal Line",
    description: "Add a horizontal line",
    icon: <Minus className="h-5 w-5" />,
  },
  {
    title: "Link",
    description: "Add a link",
    icon: <LinkIcon className="h-5 w-5" />,
  },
];

interface NoteEditorProps {
  noteId: string;
  userId: string;
  initialContent: string;
}

const NoteEditor = ({ noteId, userId, initialContent }: NoteEditorProps) => {
  const [content, setContent] = useState(() => {
    if (!initialContent) return defaultContent;
    try {
      return parseContent(initialContent);
    } catch (error) {
      console.error('Error parsing initial content:', error);
      return defaultContent;
    }
  });

  const [saveStatus, setSaveStatus] = useState("Saved");
  const [showCommands, setShowCommands] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const editorRef = useRef<any>(null);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !showCommands && document.activeElement === editorRef.current?.querySelector('.ProseMirror')) {
        setShowCommands(true);
        setCommandFilter("");
        // We don't preventDefault here because we want the "/" to appear in the editor
      } else if (e.key === 'Escape' && showCommands) {
        setShowCommands(false);
        setCommandFilter("");
      } else if (showCommands && /^[a-zA-Z]$/.test(e.key)) {
        setCommandFilter(prev => prev + e.key.toLowerCase());
      } else if (showCommands && e.key === 'Backspace') {
        setCommandFilter(prev => prev.slice(0, -1));
      } else if (showCommands && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
        // Let the command menu handle these keys
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCommands]);

  // Filter suggestions based on input
  const filteredItems = suggestionItems.filter(item =>
    item.title.toLowerCase().includes(commandFilter.toLowerCase()) ||
    item.description.toLowerCase().includes(commandFilter.toLowerCase())
  );

  // Save content to Supabase
  const handleSave = async (newContent: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ transcription: newContent })
        .eq('id', noteId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error saving note:', error);
        toast.error('Failed to save note');
        return;
      }

      setSaveStatus("Saved");
      console.log('Note saved successfully');
    } catch (error) {
      console.error('Error in save:', error);
      toast.error('Failed to save note');
    }
  };

  const debouncedSave = debounce(handleSave, 500);

  // Create toolbar with formatting options
  const toolbar = (
    <div className="border border-input bg-transparent rounded-t-md px-2 py-1 flex flex-wrap items-center gap-1 mb-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (editorRef.current) {
                  const editor = editorRef.current.getEditor();
                  editor.chain().focus().toggleBold().run();
                }
              }}
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bold</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (editorRef.current) {
                  const editor = editorRef.current.getEditor();
                  editor.chain().focus().toggleItalic().run();
                }
              }}
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Italic</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (editorRef.current) {
                  const editor = editorRef.current.getEditor();
                  editor.chain().focus().toggleCode().run();
                }
              }}
            >
              <Code className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Inline Code</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="w-px h-6 bg-border mx-1"></div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (editorRef.current) {
                  const editor = editorRef.current.getEditor();
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                }
              }}
            >
              <Heading1 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 1</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (editorRef.current) {
                  const editor = editorRef.current.getEditor();
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                }
              }}
            >
              <Heading2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 2</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="w-px h-6 bg-border mx-1"></div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (editorRef.current) {
                  const editor = editorRef.current.getEditor();
                  editor.chain().focus().toggleBulletList().run();
                }
              }}
            >
              <List className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bullet List</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (editorRef.current) {
                  const editor = editorRef.current.getEditor();
                  editor.chain().focus().toggleOrderedList().run();
                }
              }}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Numbered List</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="w-px h-6 bg-border mx-1"></div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (editorRef.current) {
                  const editor = editorRef.current.getEditor();
                  editor.chain().focus().toggleBlockquote().run();
                }
              }}
            >
              <Quote className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Quote</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (editorRef.current) {
                  const editor = editorRef.current.getEditor();
                  const url = window.prompt("Enter link URL");
                  if (url) {
                    editor.chain().focus().setLink({ href: url }).run();
                  }
                }
              }}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Link</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="relative w-full">
      <div className="flex absolute right-5 top-5 z-10 mb-5">
        <div className="rounded-lg bg-accent px-2 py-1 text-sm text-muted-foreground">
          {saveStatus}
        </div>
      </div>

      <EditorRoot>
        {toolbar}

        <EditorContent
          ref={editorRef}
          initialContent={content}
          className="relative min-h-[500px] w-full border-muted bg-background sm:mb-[calc(20vh)] sm:rounded-b-lg sm:border sm:border-t-0 sm:shadow-lg"
          extensions={extensions}
          editorProps={{
            attributes: {
              class: "prose-lg prose-stone dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full p-4",
            },
          }}
          onUpdate={({ editor }) => {
            setSaveStatus("Unsaved");
            const json = editor.getJSON();
            debouncedSave(JSON.stringify(json));

            // Check if the current content contains a slash
            const selection = editor.state.selection;
            const currentLine = editor.state.doc.textBetween(
              selection.$from.start(),
              selection.$from.pos,
              "\n"
            );

            if (currentLine.endsWith('/') && !showCommands) {
              setShowCommands(true);
              setCommandFilter("");
            }
          }}
        >
          {showCommands && (
            <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md transition-all">
              <EditorCommandEmpty className="px-2 text-muted-foreground">
                No matching commands found
              </EditorCommandEmpty>
              <EditorCommandList>
                {filteredItems.map((item) => (
                  <EditorCommandItem
                    key={item.title}
                    value={item.title}
                    onCommand={() => {
                      if (editorRef.current) {
                        const editor = editorRef.current.getEditor();

                        // First, remove the slash character
                        editor.commands.deleteRange({
                          from: editor.state.selection.from - 1,
                          to: editor.state.selection.from
                        });

                        switch (item.title) {
                          case "Heading 1":
                            editor.chain().focus().toggleHeading({ level: 1 }).run();
                            break;
                          case "Heading 2":
                            editor.chain().focus().toggleHeading({ level: 2 }).run();
                            break;
                          case "Heading 3":
                            editor.chain().focus().toggleHeading({ level: 3 }).run();
                            break;
                          case "Bullet List":
                            editor.chain().focus().toggleBulletList().run();
                            break;
                          case "Numbered List":
                            editor.chain().focus().toggleOrderedList().run();
                            break;
                          case "Task List":
                            editor.chain().focus().toggleTaskList().run();
                            break;
                          case "Code Block":
                            editor.chain().focus().toggleCodeBlock().run();
                            break;
                          case "Quote":
                            editor.chain().focus().toggleBlockquote().run();
                            break;
                          case "Horizontal Line":
                            editor.chain().focus().setHorizontalRule().run();
                            break;
                          case "Link":
                            const url = window.prompt('Enter URL');
                            if (url) {
                              editor.chain().focus().setLink({ href: url }).run();
                            }
                            break;
                        }
                        setShowCommands(false);
                        setCommandFilter("");
                      }
                    }}
                    className="flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-selected:bg-accent"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-muted bg-background">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </EditorCommandItem>
                ))}
              </EditorCommandList>
            </EditorCommand>
          )}
        </EditorContent>
      </EditorRoot>
    </div>
  );
};

export default NoteEditor;
