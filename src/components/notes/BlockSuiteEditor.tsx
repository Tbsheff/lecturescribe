
import React, { useEffect, useRef } from "react";
import { PageEditor } from "@blocksuite/presets";
import { Workspace } from "@blocksuite/store";
import * as Y from "yjs";

// Import CSS for BlockSuite editor
import "@blocksuite/presets/themes/affine.css";

interface BlockSuiteEditorProps {
  noteId: string;
  userId: string;
  initialContent?: string;
  onSave?: (content: string) => void;
}

const BlockSuiteEditor: React.FC<BlockSuiteEditorProps> = ({
  noteId,
  userId,
  initialContent,
  onSave,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const editorInstanceRef = useRef<PageEditor | null>(null);

  // Setup the editor
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Create a new workspace
    const workspace = new Workspace({
      id: `note-${noteId}`,
    });
    workspaceRef.current = workspace;
    
    // Create a page for this note
    const page = workspace.createPage({ id: `page:${noteId}` });
    
    if (initialContent) {
      try {
        // Try to parse initialContent as JSON if it's structured BlockSuite content
        const parsedContent = JSON.parse(initialContent);
        if (parsedContent && typeof parsedContent === 'object') {
          console.log("Found structured content");
          // If we have valid JSON, we could try to import it
          // This is placeholder - actual import would depend on BlockSuite version
        }
      } catch (e) {
        console.log("No valid JSON content, using as plain text");
        // Initialize with default content from the plain text
        page.load(() => {
          const pageBlockId = page.addBlock('affine:page');
          page.addBlock('affine:surface', {}, pageBlockId);
          const noteBlockId = page.addBlock('affine:note', {}, pageBlockId);
          page.addBlock('affine:paragraph', { 
            text: initialContent || 'Start writing here...'
          }, noteBlockId);
        });
      }
    } else {
      // Initialize with default structure for a new note
      page.load(() => {
        const pageBlockId = page.addBlock('affine:page');
        page.addBlock('affine:surface', {}, pageBlockId);
        const noteBlockId = page.addBlock('affine:note', {}, pageBlockId);
        page.addBlock('affine:paragraph', { 
          text: 'Start writing here...'
        }, noteBlockId);
      });
    }

    // Create and mount the editor using PageEditor instead of createEditor
    const editor = new PageEditor();
    editor.doc = page;
    
    editorRef.current.innerHTML = '';
    editorRef.current.appendChild(editor);
    editorInstanceRef.current = editor;

    // Set up auto-saving
    if (onSave) {
      const autoSave = setInterval(() => {
        try {
          // Use Y.Doc as a simple serialization format
          const yDoc = new Y.Doc();
          Y.encodeStateAsUpdate(page.spaceDoc);
          const serialized = JSON.stringify({
            content: Array.from(Y.encodeStateAsUpdate(page.spaceDoc))
          });
          onSave(serialized);
        } catch (error) {
          console.error("Error during auto-save:", error);
        }
      }, 3000);

      return () => {
        clearInterval(autoSave);
      };
    }

    return () => {
      if (editor) {
        editor.remove();
      }
      if (workspace) {
        workspace.destroy();
      }
    };
  }, [noteId, userId, initialContent, onSave]);

  return (
    <div className="blocksuite-editor-container" style={{ height: "100%", width: "100%" }}>
      <div ref={editorRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
};

export default BlockSuiteEditor;
