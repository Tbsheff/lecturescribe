import React, { useState, useRef, useEffect } from 'react';
import {
    EditorContent,
    EditorRoot,
    EditorCommand,
    EditorCommandEmpty,
    EditorCommandItem,
    EditorCommandList,
    EditorBubble,
} from "novel";
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Heading } from '@tiptap/extension-heading';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { Blockquote } from '@tiptap/extension-blockquote';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { CodeBlock } from '@tiptap/extension-code-block';
import { Link } from '@tiptap/extension-link';
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
    Bold as BoldIcon,
    Italic as ItalicIcon,
    Underline,
    Code as CodeIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Create a slash command extension
const createSlashCommand = (items: any[]) => {
    return {
        name: 'slashCommand',
        addKeyboardShortcuts() {
            return {
                '/': () => {
                    // This is just a basic trigger for our React-based slash command UI
                    // We'll handle the actual command functionality in the React component
                    return true;
                },
            };
        },
    };
};

// Create extensions array with document structure and formatting options
const extensions = [
    // Core required extensions
    Document,
    Paragraph,
    Text,
    // Formatting extensions
    Bold,
    Italic,
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
    Link.configure({
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

// Default content for new summaries with proper ProseMirror schema
const defaultContent = {
    type: "doc",
    content: [
        {
            type: "paragraph",
            content: [{ type: "text", text: "No summary available" }]
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

// Convert markdown to ProseMirror JSON structure
const markdownToProseMirror = (markdown: string) => {
    if (!markdown) return defaultContent;

    // For a real implementation, a proper markdown parser should be used.
    // This is a simplified version that handles basic markdown

    // Process the markdown to identify basic patterns
    const lines = markdown.split('\n');
    const content: any[] = [];

    let currentList: any = null;
    let currentListItems: any[] = [];
    let inCodeBlock = false;
    let codeContent = '';
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for code blocks
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeLanguage = line.slice(3).trim();
                codeContent = '';
            } else {
                inCodeBlock = false;
                content.push({
                    type: 'codeBlock',
                    attrs: { language: codeLanguage },
                    content: [{ type: 'text', text: codeContent }]
                });
            }
            continue;
        }

        if (inCodeBlock) {
            codeContent += line + '\n';
            continue;
        }

        // Headers
        if (line.startsWith('# ')) {
            content.push({
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: line.slice(2) }]
            });
        } else if (line.startsWith('## ')) {
            content.push({
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: line.slice(3) }]
            });
        } else if (line.startsWith('### ')) {
            content.push({
                type: 'heading',
                attrs: { level: 3 },
                content: [{ type: 'text', text: line.slice(4) }]
            });
        }
        // Bullet list
        else if (line.match(/^\s*[*\-+]\s/)) {
            const listItem = {
                type: 'listItem',
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: line.replace(/^\s*[*\-+]\s/, '') }]
                }]
            };

            if (currentList && currentList.type === 'bulletList') {
                currentListItems.push(listItem);
            } else {
                // Finish previous list if exists
                if (currentList) {
                    currentList.content = currentListItems;
                    content.push(currentList);
                }

                currentList = { type: 'bulletList', content: [] };
                currentListItems = [listItem];
            }
        }
        // Numbered list
        else if (line.match(/^\s*\d+\.\s/)) {
            const listItem = {
                type: 'listItem',
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: line.replace(/^\s*\d+\.\s/, '') }]
                }]
            };

            if (currentList && currentList.type === 'orderedList') {
                currentListItems.push(listItem);
            } else {
                // Finish previous list if exists
                if (currentList) {
                    currentList.content = currentListItems;
                    content.push(currentList);
                }

                currentList = { type: 'orderedList', content: [] };
                currentListItems = [listItem];
            }
        }
        // Blockquote
        else if (line.startsWith('> ')) {
            content.push({
                type: 'blockquote',
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: line.slice(2) }]
                }]
            });
        }
        // Horizontal rule
        else if (line.match(/^(\*\*\*|\-\-\-|___)\s*$/)) {
            content.push({ type: 'horizontalRule' });
        }
        // Empty line, finish list if we're in one
        else if (line.trim() === '') {
            if (currentList) {
                currentList.content = currentListItems;
                content.push(currentList);
                currentList = null;
                currentListItems = [];
            }

            // Don't add empty paragraphs for consecutive empty lines
            if (i > 0 && lines[i - 1].trim() !== '') {
                content.push({
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }]
                });
            }
        }
        // Regular paragraph
        else {
            // If we're in a list, finish it
            if (currentList) {
                currentList.content = currentListItems;
                content.push(currentList);
                currentList = null;
                currentListItems = [];
            }

            // Process inline formatting for this paragraph
            let paragraphText = line;

            content.push({
                type: 'paragraph',
                content: [{ type: 'text', text: paragraphText }]
            });
        }
    }

    // Don't forget to add the final list if there was one
    if (currentList) {
        currentList.content = currentListItems;
        content.push(currentList);
    }

    return {
        type: 'doc',
        content: content.length > 0 ? content : [{
            type: 'paragraph',
            content: [{ type: 'text', text: markdown }]
        }]
    };
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

interface SummaryEditorProps {
    noteId: string;
    userId: string;
    summary: string;
}

const SummaryEditor = ({ noteId, userId, summary }: SummaryEditorProps) => {
    const [content, setContent] = useState(() => {
        if (!summary) return defaultContent;
        try {
            // Try to parse as JSON first in case it's already in ProseMirror format
            return parseContent(summary);
        } catch (error) {
            // If that fails, treat it as markdown and convert
            return markdownToProseMirror(summary);
        }
    });

    const [saveStatus, setSaveStatus] = useState("Saved");
    const [showCommands, setShowCommands] = useState(false);
    const [commandFilter, setCommandFilter] = useState("");
    const editorRef = useRef<any>(null);

    // Enhanced keyboard event handler for slash command
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
            // Parse the JSON to extract plain text for markdown conversion if needed
            const parsedContent = JSON.parse(newContent);

            // For now, we'll save in both formats - the structured JSON and a markdown representation
            // This ensures backward compatibility
            let markdownContent = "";

            // Extract markdown-like text from JSON structure (simplified conversion)
            const extractMarkdown = (node: any, depth = 0, index?: number): string => {
                if (!node) return '';

                // Text nodes
                if (node.type === 'text') {
                    let text = node.text || '';
                    if (node.marks) {
                        for (const mark of node.marks) {
                            if (mark.type === 'bold') text = `**${text}**`;
                            else if (mark.type === 'italic') text = `*${text}*`;
                            else if (mark.type === 'code') text = `\`${text}\``;
                        }
                    }
                    return text;
                }

                // Container nodes with content
                if (node.content && Array.isArray(node.content)) {
                    let result = '';

                    // Handle specific node types
                    if (node.type === 'heading') {
                        const level = node.attrs?.level || 1;
                        const prefix = '#'.repeat(level) + ' ';
                        result = prefix + node.content.map(n => extractMarkdown(n)).join('') + '\n\n';
                    }
                    else if (node.type === 'paragraph') {
                        result = node.content.map(n => extractMarkdown(n)).join('') + '\n\n';
                    }
                    else if (node.type === 'bulletList') {
                        result = node.content.map(n => extractMarkdown(n, depth)).join('') + '\n';
                    }
                    else if (node.type === 'orderedList') {
                        result = node.content.map((n, i) => extractMarkdown(n, depth, i + 1)).join('') + '\n';
                    }
                    else if (node.type === 'listItem') {
                        const prefix = depth > 0 ? '  '.repeat(depth) : '';
                        const marker = index ? `${index}. ` : '* ';
                        result = prefix + marker + node.content.map(n => extractMarkdown(n)).join('').trim() + '\n';
                    }
                    else if (node.type === 'codeBlock') {
                        const language = node.attrs?.language || '';
                        result = '```' + language + '\n' +
                            node.content.map(n => extractMarkdown(n)).join('') +
                            '```\n\n';
                    }
                    else if (node.type === 'blockquote') {
                        result = '> ' + node.content.map(n => extractMarkdown(n)).join('').split('\n').join('\n> ').trim() + '\n\n';
                    }
                    else if (node.type === 'horizontalRule') {
                        result = '---\n\n';
                    }
                    else if (node.type === 'doc') {
                        result = node.content.map(n => extractMarkdown(n)).join('');
                    }
                    else {
                        // Default for other node types
                        result = node.content.map(n => extractMarkdown(n)).join('');
                    }

                    return result;
                }

                return '';
            };

            // Generate markdown representation
            markdownContent = extractMarkdown(parsedContent);

            // Update both the structured ProseMirror format and plain markdown
            const { error } = await supabase
                .from('notes')
                .update({
                    raw_summary: markdownContent,  // Store as markdown for compatibility
                    structured_summary: parsedContent  // Store the full ProseMirror structure
                })
                .eq('id', noteId)
                .eq('user_id', userId);

            if (error) {
                console.error('Error saving summary:', error);
                toast.error('Failed to save summary');
                return;
            }

            setSaveStatus("Saved");
            console.log('Summary saved successfully');
        } catch (error) {
            console.error('Error in save:', error);
            toast.error('Failed to save summary');
        }
    };

    const debouncedSave = debounce(handleSave, 500);

    // Create toolbar with formatting buttons
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
                            <BoldIcon className="h-4 w-4" />
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
                            <ItalicIcon className="h-4 w-4" />
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
                            <CodeIcon className="h-4 w-4" />
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
                                                        const url = prompt("URL", "https://");
                                                        if (url) {
                                                            editor.chain().focus().setLink({ href: url }).run();
                                                        }
                                                        break;
                                                    default:
                                                        break;
                                                }
                                            }
                                            setShowCommands(false);
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

export default SummaryEditor; 