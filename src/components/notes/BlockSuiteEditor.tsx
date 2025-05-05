
import React, { useEffect, useRef, useState } from "react";
import { AffineEditorContainer } from "@blocksuite/editor";
import { DocCollection, DocCollectionOptions } from "@blocksuite/store";
import { PageManager } from "@blocksuite/store";
import * as Y from "yjs";

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
  const [editor, setEditor] = useState<AffineEditorContainer | null>(null);
  const [docCollection, setDocCollection] = useState<DocCollection | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);

  // Setup the editor
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Create a new doc collection with the appropriate ID
    const options: DocCollectionOptions = {
      id: `note-${noteId}`,
      idGenerator() {
        return `note-${noteId}-${Date.now()}`;
      },
    };
    
    const collection = new DocCollection(options);
    setDocCollection(collection);

    // Register the required blocks
    import('@blocksuite/blocks').then(({ PageBlockSchema, registerAffineSchemas }) => {
      registerAffineSchemas(collection);
      
      // Create a page for this note
      const page = collection.createDoc({ id: `page:${noteId}` });
      setPageId(page.id);
      
      if (page) {
        // Initialize with default content if it's a new page
        if (!initialContent) {
          PageBlockSchema.createAndInsert(page);
        } else {
          // TODO: Convert markdown to BlockSuite content
          // For now, just create a default page
          PageBlockSchema.createAndInsert(page);
          
          // In the future, implement markdown to blocksuite conversion
          console.log("Need to convert markdown to BlockSuite content:", initialContent);
        }

        // Create and mount the editor
        const editorContainer = new AffineEditorContainer();
        editorContainer.page = page;
        editorRef.current.innerHTML = '';
        editorRef.current.appendChild(editorContainer);
        setEditor(editorContainer);

        // Set up auto-saving
        const autoSave = setInterval(() => {
          if (onSave && page) {
            // For now, we're just converting to JSON
            // In a real implementation, you'd want a proper serialization format
            const content = JSON.stringify(page.toJSON());
            onSave(content);
          }
        }, 3000);

        return () => {
          clearInterval(autoSave);
          if (editorContainer) {
            editorContainer.remove();
          }
        };
      }
    });
    
    return () => {
      if (collection) {
        // Clean up collection
      }
    };
  }, [noteId, initialContent]);

  return (
    <div className="blocksuite-editor-container" style={{ height: "100%", width: "100%" }}>
      <div ref={editorRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
};

export default BlockSuiteEditor;
