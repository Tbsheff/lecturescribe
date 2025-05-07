import React from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { Block } from "@blocknote/core"; // Import Block type
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

/**
 * A reusable React component that initializes BlockNote as a WYSIWYG editor,
 * styled to emulate a Notion-like experience, with autosave functionality.
 */
export default function EditorJSComponent() { // Keeping component name as is for now
    // Creates a new editor instance.
    const editor = useCreateBlockNote({
        initialContent: [
            {
                type: "paragraph",
                // content: "Welcome to your Notion-like editor! Type '/' for commands. Content autosaves to console."
                // An empty paragraph block, or a paragraph with empty content, will allow immediate typing.
                // BlockNote will show its default placeholder like "Type '/' for commands" if the block is empty.
            },
        ]
    });

    const handleChange = () => {
        if (!editor) return;
        try {
            const content: Block[] = editor.document;
            console.log('Autosaving content:', content); // Changed log message for clarity
            // TODO: Implement actual backend autosave logic here
        } catch (error) {
            console.error('Error during autosave:', error);
        }
    };

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-grow h-full"> {/* Ensure this div also allows BlockNoteView to use full height */}
                <BlockNoteView
                    editor={editor}
                    onChange={handleChange}
                    theme="light"
                    formattingToolbar={true}
                    linkToolbar={true}
                    sideMenu={true}
                    slashMenu={true}
                    className="h-full" // Ensure BlockNoteView takes up available space
                />
            </div>
        </div>
    );
}
