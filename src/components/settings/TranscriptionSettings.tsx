import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, Mic, Zap } from 'lucide-react';
import { transcriptionConfig, TranscriptionSettings } from '@/services/transcriptionConfig';
import { TranscriptionProviderType } from '@/types/transcription';
import { toast } from 'sonner';

const PROVIDER_INFO = {
  gemini: {
    name: 'Gemini AI',
    icon: <Zap className="h-4 w-4" />,
    description: 'Google\'s multimodal AI with advanced summarization',
    features: ['High accuracy', 'Detailed summaries', 'Note structuring'],
    badge: 'AI-Powered'
  },
  deepgram: {
    name: 'Deepgram',
    icon: <Mic className="h-4 w-4" />,
    description: 'Professional speech-to-text API service',
    features: ['Fast processing', 'High accuracy', 'Multiple languages'],
    badge: 'Professional'
  }
} as const;

export const TranscriptionSettings: React.FC = () => {
  const [settings, setSettings] = useState<TranscriptionSettings>(transcriptionConfig.getSettings());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load current settings
    const currentSettings = transcriptionConfig.getSettings();
    setSettings(currentSettings);
  }, []);

  const handleProviderChange = async (provider: TranscriptionProviderType) => {
    setIsLoading(true);
    try {
      transcriptionConfig.setDefaultProvider(provider);
      setSettings(prev => ({ ...prev, defaultProvider: provider }));
      toast.success(`Default provider changed to ${PROVIDER_INFO[provider].name}`);
    } catch (error) {
      toast.error('Failed to update provider setting');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFallbackChange = async (provider: TranscriptionProviderType | 'none') => {
    setIsLoading(true);
    try {
      const fallbackProvider = provider === 'none' ? undefined : provider as TranscriptionProviderType;
      transcriptionConfig.setFallbackProvider(fallbackProvider);
      setSettings(prev => ({ ...prev, fallbackProvider }));
      toast.success(fallbackProvider ? 
        `Fallback provider set to ${PROVIDER_INFO[fallbackProvider].name}` : 
        'Fallback provider disabled'
      );
    } catch (error) {
      toast.error('Failed to update fallback setting');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectionToggle = async (enabled: boolean) => {
    try {
      transcriptionConfig.toggleProviderSelection(enabled);
      setSettings(prev => ({ ...prev, allowProviderSelection: enabled }));
      toast.success(`Provider selection ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update selection setting');
    }
  };

  const resetToDefaults = async () => {
    setIsLoading(true);
    try {
      transcriptionConfig.resetToDefaults();
      const defaultSettings = transcriptionConfig.getSettings();
      setSettings(defaultSettings);
      toast.success('Settings reset to defaults');
    } catch (error) {
      toast.error('Failed to reset settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <CardTitle>Transcription Settings</CardTitle>
        </div>
        <CardDescription>
          Configure which AI service to use for audio transcription and summarization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Provider Selection */}
        <div className="space-y-3">
          <Label htmlFor="default-provider" className="text-base font-medium">
            Default Provider
          </Label>
          <Select
            value={settings.defaultProvider}
            onValueChange={handleProviderChange}
            disabled={isLoading}
          >
            <SelectTrigger id="default-provider">
              <SelectValue placeholder="Select default provider" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center space-x-3">
                    {info.icon}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span>{info.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {info.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Provider Features */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Provider Features</Label>
          <div className="grid gap-3">
            {Object.entries(PROVIDER_INFO).map(([key, info]) => (
              <div 
                key={key}
                className={`p-3 rounded-lg border ${
                  settings.defaultProvider === key ? 'border-primary bg-primary/5' : 'border-muted'
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  {info.icon}
                  <h4 className="font-medium">{info.name}</h4>
                  <Badge variant={settings.defaultProvider === key ? 'default' : 'outline'}>
                    {settings.defaultProvider === key ? 'Selected' : 'Available'}
                  </Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {info.features.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Fallback Provider */}
        <div className="space-y-3">
          <Label htmlFor="fallback-provider" className="text-base font-medium">
            Fallback Provider
          </Label>
          <Select
            value={settings.fallbackProvider || 'none'}
            onValueChange={handleFallbackChange}
            disabled={isLoading}
          >
            <SelectTrigger id="fallback-provider">
              <SelectValue placeholder="Select fallback provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No fallback</SelectItem>
              {Object.entries(PROVIDER_INFO)
                .filter(([key]) => key !== settings.defaultProvider)
                .map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center space-x-3">
                      {info.icon}
                      <span>{info.name}</span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used automatically if the primary provider fails
          </p>
        </div>

        {/* Allow Provider Selection */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="allow-selection" className="text-base font-medium">
              Allow Manual Provider Selection
            </Label>
            <p className="text-xs text-muted-foreground">
              Let users choose provider for individual recordings
            </p>
          </div>
          <Switch
            id="allow-selection"
            checked={settings.allowProviderSelection}
            onCheckedChange={handleSelectionToggle}
          />
        </div>

        {/* Reset Button */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            disabled={isLoading}
            className="w-full"
          >
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};