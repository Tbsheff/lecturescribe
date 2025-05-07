import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import EditorComponent from '@/components/editor/EnhancedEditor';
import CoverDisplay from '@/components/editor/CoverDisplay';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';

const EditorPage: React.FC = () => {
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

    const UNSPLASH_KEY = "KNMg2Q-6atgeLoedztfZzpZaFyMuUFAMzyepQ3KY1MQ"
    const setRandomUnsplashCover = async () => {
        // 1. build your API URL
        const apiUrl = new URL('https://api.unsplash.com/photos/random');
        apiUrl.searchParams.set('client_id', UNSPLASH_KEY);
        apiUrl.searchParams.set('orientation', 'landscape');
        // optional: request a specific size + crop
        apiUrl.searchParams.set('w', '1200');
        apiUrl.searchParams.set('h', '400');
        apiUrl.searchParams.set('fit', 'crop');

        try {
            // 2. fetch it
            const res = await fetch(apiUrl.toString());
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // 3. pull out the “regular” (or whatever size) URL
            const imageUrl = data.urls.regular;
            // 4. set your state
            setCoverImageUrl(imageUrl);
            console.log(`Set random Unsplash cover: ${imageUrl}`);
        } catch (err) {
            console.error('Failed to load Unsplash cover:', err);
        }
    };

    // This function is now primarily for the "Change cover" button on an existing cover
    const handleChangeCover = () => {
        const userProvidedUrl = prompt(
            "Enter new image URL for cover (or leave blank for a random Unsplash image):",
            coverImageUrl || "" // Suggest current or empty
        );

        if (userProvidedUrl) {
            setCoverImageUrl(userProvidedUrl);
        } else if (userProvidedUrl === "") {
            // If user explicitly clears the prompt, treat as wanting a new random one
            setRandomUnsplashCover();
        }
        // If user cancels prompt, do nothing (keeps existing image)
        console.log("Change Cover action triggered.");
    };

    const handleRemoveCover = () => {
        setCoverImageUrl(null);
        console.log("Remove Cover clicked. Implement backend removal logic here.");
    };

    return (
        <MainLayout>
            <div className="w-full h-full flex flex-col items-center">
                <div className="w-full max-w-5xl mb-4">
                    <CoverDisplay
                        url={coverImageUrl}
                        onChangeCover={handleChangeCover} // This is for the button on the cover itself
                        onRemoveCover={handleRemoveCover}
                    />
                    {!coverImageUrl && (
                        <div className="relative flex justify-center items-center -mt-10 ">
                            <Button variant="outline" size="sm" onClick={setRandomUnsplashCover} className="bg-white hover:bg-gray-100 text-xs">
                                <ImageIcon className="h-4 w-4 mr-2" />
                                Add Cover
                            </Button>
                        </div>
                    )}
                </div>

                <div className="w-full max-w-4xl h-full flex-grow">
                    <EditorComponent />
                </div>
            </div>
        </MainLayout>
    );
};

export default EditorPage; 