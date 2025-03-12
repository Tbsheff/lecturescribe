import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const [noteFormat, setNoteFormat] = useState('structured');
  const [autoSave, setAutoSave] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [defaultExportFormat, setDefaultExportFormat] = useState('pdf');
  
  const handleSaveSettings = () => {
    // In a real app, this would save settings to backend or localStorage
    toast.success('Settings saved successfully');
  };
  
  const handleClearData = () => {
    // In a real app, this would clear user data
    toast.success('All data cleared successfully');
  };
  
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 gradient-text">Settings</h1>
        <p className="text-muted-foreground mb-8">
          Customize your LectureScribe experience
        </p>
        
        <div className="bg-card border border-border/50 rounded-lg overflow-hidden shadow-sm">
          <div className="p-6">
            <h2 className="text-xl font-medium mb-4">Appearance</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose between light and dark mode
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    id="theme"
                    checked={theme === 'dark'}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  />
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="p-6">
            <h2 className="text-xl font-medium mb-4">Note Generation</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="note-format">Default Note Format</Label>
                  <Select value={noteFormat} onValueChange={setNoteFormat}>
                    <SelectTrigger id="note-format">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="structured">Structured with Headings</SelectItem>
                      <SelectItem value="outline">Outline Format</SelectItem>
                      <SelectItem value="bullet">Bullet Points Only</SelectItem>
                      <SelectItem value="detailed">Detailed Paragraphs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="export-format">Default Export Format</Label>
                  <Select value={defaultExportFormat} onValueChange={setDefaultExportFormat}>
                    <SelectTrigger id="export-format">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="docx">Microsoft Word</SelectItem>
                      <SelectItem value="txt">Plain Text</SelectItem>
                      <SelectItem value="markdown">Markdown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-save">Auto Save</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically save notes after processing
                  </p>
                </div>
                <Switch
                  id="auto-save"
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications">Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when processing is complete
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={notificationEnabled}
                  onCheckedChange={setNotificationEnabled}
                />
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="p-6">
            <h2 className="text-xl font-medium mb-4">Data Management</h2>
            
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto"
                  onClick={handleClearData}
                >
                  Clear All Data
                </Button>
                <p className="text-xs text-muted-foreground">
                  This will delete all your notes and recordings permanently
                </p>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="p-6 flex justify-end">
            <Button 
              className="bg-brand hover:bg-brand-dark text-white"
              onClick={handleSaveSettings}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;
