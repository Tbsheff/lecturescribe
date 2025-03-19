import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, ArrowLeft, PenSquare } from 'lucide-react';
import { toast } from 'sonner';
import AIGeneratedNotesView from './AIGeneratedNotesView';
import NoteEditor from './NoteEditor';
import { useAuth } from '@/hooks/useAuth';

const AINotesPage = () => {
    const { noteId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [note, setNote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('original'); // 'original' or 'ai-notes'

    // This would be triggered when AI generates notes
    const [aiGeneratedContent, setAiGeneratedContent] = useState('');
    const [showAITab, setShowAITab] = useState(false);

    useEffect(() => {
        if (!noteId || !user) return;

        const fetchNote = async () => {
            try {
                setLoading(true);

                // Fetch the note data
                const { data, error } = await supabase
                    .from('notes')
                    .select('*')
                    .eq('id', noteId)
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;

                setNote(data);

                // If there's a raw_summary, show the AI tab
                if (data.raw_summary) {
                    setAiGeneratedContent(data.raw_summary);
                    setShowAITab(true);
                }
            } catch (error) {
                console.error('Error fetching note:', error);
                toast.error('Failed to load note');
            } finally {
                setLoading(false);
            }
        };

        fetchNote();
    }, [noteId, user]);

    const handleGenerateAINotes = async () => {
        try {
            setLoading(true);

            // This would be replaced with an actual API call to generate AI notes
            // For example, using the transcription stored in the note
            const transcription = note?.transcription || '';

            if (!transcription) {
                toast.error('No transcription available to generate notes from');
                return;
            }

            // In a real implementation, you would send the transcription to an API
            // and get back AI-generated notes
            const mockAIGeneratedContent = `# AI Generated Notes for ${note.title}

## Key Points:
- First important point from the lecture
- Second important point
- Third important point

## Summary:
This lecture covered several important concepts...`;

            // Save the AI notes and update UI
            setAiGeneratedContent(mockAIGeneratedContent);
            setShowAITab(true);
            setActiveTab('ai-notes');

            toast.success('AI notes generated successfully');
        } catch (error) {
            console.error('Error generating AI notes:', error);
            toast.error('Failed to generate AI notes');
        } finally {
            setLoading(false);
        }
    };

    const handleDiscardAINotes = async () => {
        try {
            // Clear AI notes from database
            const { error } = await supabase
                .from('notes')
                .update({
                    raw_summary: null,
                    structured_summary: null
                })
                .eq('id', noteId)
                .eq('user_id', user.id);

            if (error) throw error;

            // Update UI
            setAiGeneratedContent('');
            setShowAITab(false);
            setActiveTab('original');

            toast.success('AI notes discarded');
        } catch (error) {
            console.error('Error discarding AI notes:', error);
            toast.error('Failed to discard AI notes');
        }
    };

    const handleSaveComplete = () => {
        // Refresh the note data after saving
        if (noteId && user) {
            const fetchUpdatedNote = async () => {
                const { data } = await supabase
                    .from('notes')
                    .select('*')
                    .eq('id', noteId)
                    .eq('user_id', user.id)
                    .single();

                if (data) {
                    setNote(data);
                }
            };

            fetchUpdatedNote();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!note) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <p className="text-lg mb-4">Note not found</p>
                <Button onClick={() => navigate('/notes')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Notes
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Button variant="outline" onClick={() => navigate('/notes')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <h1 className="text-2xl font-bold">{note.title}</h1>
                </div>

                {!showAITab && (
                    <Button onClick={handleGenerateAINotes} disabled={loading}>
                        <PenSquare className="h-4 w-4 mr-2" />
                        Generate AI Notes
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader className="px-6 pt-6 pb-3">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid grid-cols-2">
                            <TabsTrigger value="original">Original Notes</TabsTrigger>
                            <TabsTrigger value="ai-notes" disabled={!showAITab}>
                                AI Notes
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>

                <CardContent className="px-6 pt-2 pb-6">
                    <TabsContent value="original" className="mt-0">
                        {note && (
                            <NoteEditor
                                noteId={note.id}
                                userId={user.id}
                                initialContent={note.transcription || ''}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="ai-notes" className="mt-0">
                        {showAITab && (
                            <AIGeneratedNotesView
                                noteId={note.id}
                                userId={user.id}
                                aiGeneratedContent={aiGeneratedContent}
                                onSaveComplete={handleSaveComplete}
                                onDiscardAINotes={handleDiscardAINotes}
                            />
                        )}
                    </TabsContent>
                </CardContent>
            </Card>
        </div>
    );
};

export default AINotesPage; 