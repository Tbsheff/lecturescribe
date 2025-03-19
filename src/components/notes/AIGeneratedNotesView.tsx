import { useState, useEffect } from 'react';
import AIPageEditor from './pageEditor';
import { JSONContent } from 'novel';
import { Button } from '@/components/ui/button';
import { Trash2, Download, Edit2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AIGeneratedNotesViewProps {
    userId: string;
    noteId: string;
    aiGeneratedContent: string; // This can be HTML or markdown that will be converted
    onSaveComplete?: () => void;
    onDiscardAINotes?: () => void;
}

const AIGeneratedNotesView = ({
    userId,
    noteId,
    aiGeneratedContent,
    onSaveComplete,
    onDiscardAINotes
}: AIGeneratedNotesViewProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [initialContent, setInitialContent] = useState<JSONContent | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Convert AI generated content to JSON for the editor
    useEffect(() => {
        // Simple conversion function - in practice you might need a more robust conversion
        // depending on the format of aiGeneratedContent
        const convertToEditorJSON = async () => {
            try {
                setIsLoading(true);

                // This is a simple representation - you may need more complex conversion
                // depending on your AI content format
                const content: JSONContent = {
                    type: 'doc',
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                {
                                    type: 'text',
                                    text: aiGeneratedContent
                                }
                            ]
                        }
                    ]
                };

                setInitialContent(content);
            } catch (error) {
                console.error('Error converting AI content:', error);
                toast.error('Failed to load AI generated content');
            } finally {
                setIsLoading(false);
            }
        };

        convertToEditorJSON();
    }, [aiGeneratedContent]);

    const handleSaveNotes = async (html: string, json: JSONContent, markdown: string) => {
        try {
            // Save the AI-generated notes to the database
            const { error } = await supabase
                .from('notes')
                .update({
                    raw_summary: markdown,
                    structured_summary: json,
                    updated_at: new Date().toISOString()
                })
                .eq('id', noteId)
                .eq('user_id', userId);

            if (error) throw error;

            toast.success('AI notes saved successfully');
            setIsEditing(false);
            if (onSaveComplete) onSaveComplete();
        } catch (error) {
            console.error('Error saving notes:', error);
            toast.error('Failed to save notes');
        }
    };

    const handleDiscardNotes = () => {
        if (onDiscardAINotes) onDiscardAINotes();
        else toast.info('AI generated notes discarded');
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-64">Loading AI generated notes...</div>;
    }

    if (!initialContent) {
        return <div className="text-center p-4">Failed to load AI generated content</div>;
    }

    return (
        <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">AI Generated Notes</h2>
                <div className="flex space-x-2">
                    {isEditing ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(false)}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            Done
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                        >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDiscardNotes}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Discard
                    </Button>
                </div>
            </div>

            <AIPageEditor
                initialAIContent={initialContent}
                onSave={isEditing ? handleSaveNotes : undefined}
                readOnly={!isEditing}
            />
        </div>
    );
};

export default AIGeneratedNotesView; 