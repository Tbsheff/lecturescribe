import React from 'react';
import { ImageIcon, X } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CoverDisplayProps {
    url: string | null | undefined;
    preview?: boolean;
    onChangeCover: () => void;
    onRemoveCover: () => void;
}

const CoverDisplay: React.FC<CoverDisplayProps> & { Skeleton: React.FC } = ({
    url,
    preview,
    onChangeCover,
    onRemoveCover,
}) => {
    return (
        <div
            className={cn(
                "relative w-full h-[35vh] group",
                !url && "h-[12vh]", // Shorter if no URL (e.g., showing an "Add Cover" button)
                url && "bg-muted"
            )}
        >
            {url && (
                <img
                    src={url}
                    alt="Cover"
                    className="object-cover w-full h-full"
                />
            )}
            {url && !preview && (
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-5 right-5 flex items-center gap-x-2">
                    <Button
                        onClick={onChangeCover}
                        className="text-muted-foreground text-xs"
                        variant="outline"
                        size="sm"
                    >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Change cover
                    </Button>
                    <Button
                        onClick={onRemoveCover}
                        className="text-muted-foreground text-xs"
                        variant="outline"
                        size="sm"
                    >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                    </Button>
                </div>
            )}
        </div>
    );
};

CoverDisplay.Skeleton = function CoverSkeleton() {
    return <Skeleton className="w-full h-[12vh]" />;
};

export default CoverDisplay; 