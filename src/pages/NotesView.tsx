import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Download, Trash2 } from 'lucide-react';
import { fetchNoteById } from '@/services/transcription';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

// React-markdown related imports
import ReactMarkdown from 'react-markdown';

const NotesView = () => {
  const navigate = useNavigate();
  const { noteId } = useParams();
  const { user } = useAuth();
  const [note, setNote] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const loadNote = async () => {
      if (!noteId || !user) {
        navigate('/');
        return;
      }
      
      try {
        setIsLoading(true);
        const data = await fetchNoteById(noteId);
        if (!data) {
          toast.error('Note not found');
          navigate('/');
          return;
        }
        
        setNote(data);
      } catch (error: any) {
        console.error('Error loading note:', error);
        toast.error(`Failed to load note: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadNote();
  }, [noteId, navigate, user]);
  
  const handleDelete = async () => {
    if (!note || !user) return;
    
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }
    
    try {
      setIsDeleting(true);
      
      // Delete from the database
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', note.id);
      
      if (error) throw error;
      
      // Delete the audio file if it exists
      if (note.audio_url) {
        const path = note.audio_url.split('audio/')[1];
        if (path) {
          await supabase.storage
            .from('audio')
            .remove([path]);
        }
      }
      
      toast.success('Note deleted successfully');
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting note:', error);
      toast.error(`Failed to delete note: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleDownloadAudio = () => {
    if (!note?.audio_url) {
      toast.error('No audio available for this note');
      return;
    }
    
    window.open(note.audio_url, '_blank');
  };
  
  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }
  
  if (!note) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Note not found</h2>
          <p className="text-muted-foreground mt-2">The note you're looking for doesn't exist or you don't have access to it.</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </MainLayout>
    );
  }
  
  const formattedDate = note.created_at ? format(new Date(note.created_at), 'PP') : '';
  
  return (
    <MainLayout>
      <div className="container max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex gap-2">
            {note.audio_url && (
              <Button 
                variant="outline" 
                onClick={handleDownloadAudio}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Audio
              </Button>
            )}
            
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="gap-2"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </div>
        </div>
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{note.title}</h1>
          <p className="text-muted-foreground">{formattedDate}</p>
        </div>
        
        <Tabs 
          defaultValue="summary"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mb-8"
        >
          <TabsList className="mb-6">
            <TabsTrigger value="summary">AI Summary</TabsTrigger>
            <TabsTrigger value="transcript">Full Transcript</TabsTrigger>
            {note.audio_url && (
              <TabsTrigger value="audio">Audio Player</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="summary" className="min-h-[60vh]">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {note.structured_summary ? (
                  <div className="space-y-6">
                    {note.structured_summary.summary && (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>
                          {note.structured_summary.summary}
                        </ReactMarkdown>
                      </div>
                    )}
                    
                    {note.structured_summary.keyPoints && note.structured_summary.keyPoints.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium mb-2">Key Points</h3>
                        <ul className="list-disc pl-6 space-y-1">
                          {note.structured_summary.keyPoints.map((point: string, index: number) => (
                            <li key={index} className="prose prose-sm dark:prose-invert">
                              <ReactMarkdown>{point}</ReactMarkdown>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {note.structured_summary.sections && note.structured_summary.sections.length > 0 && (
                      <div className="space-y-6 pt-4">
                        {note.structured_summary.sections.map((section: any, index: number) => (
                          <div key={index} className="space-y-3">
                            <h3 className="text-lg font-medium">{section.title}</h3>
                            
                            {section.content && (
                              <div className="prose prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown>
                                  {section.content}
                                </ReactMarkdown>
                              </div>
                            )}
                            
                            {section.subsections && section.subsections.length > 0 && (
                              <div className="space-y-4 pl-4 border-l-2 border-muted mt-4">
                                {section.subsections.map((subsection: any, subIndex: number) => (
                                  <div key={subIndex} className="pl-4">
                                    <h4 className="text-base font-medium mb-2">{subsection.title}</h4>
                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                      <ReactMarkdown>
                                        {subsection.content}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : note.raw_summary ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>
                      {note.raw_summary}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No summary available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="transcript">
            <Card>
              <CardHeader>
                <CardTitle>Full Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh] rounded-md border p-4">
                  {note.content ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {note.content}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground">No transcript available</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          {note.audio_url && (
            <TabsContent value="audio">
              <Card>
                <CardHeader>
                  <CardTitle>Audio Recording</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center p-6">
                    <audio 
                      controls 
                      src={note.audio_url} 
                      className="w-full max-w-lg"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default NotesView;
