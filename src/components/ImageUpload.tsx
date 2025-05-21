import React, { useState, useRef, useEffect } from 'react';

interface ImageUploadProps {
    currentImageUrl: string;
    defaultImageUrl: string;
    onImageChange: (file: File | null, previewUrl: string) => void;
    className?: string;
    disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
    currentImageUrl,
    defaultImageUrl,
    onImageChange,
    className = '',
    disabled = false
}) => {
    const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl || defaultImageUrl);
    const [imgError, setImgError] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Update previewUrl when currentImageUrl changes
    useEffect(() => {
        if (currentImageUrl && currentImageUrl !== previewUrl) {
            setPreviewUrl(currentImageUrl);
            setImgError(false); // Reset error state when URL changes
        }
    }, [currentImageUrl]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onloadend = () => {
                const previewUrl = reader.result as string;
                setPreviewUrl(previewUrl);
                setImgError(false);
                onImageChange(file, previewUrl);
            };

            reader.readAsDataURL(file);
        } else {
            setPreviewUrl(defaultImageUrl);
            setImgError(false);
            onImageChange(null, defaultImageUrl);
        }
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = () => {
        setPreviewUrl(defaultImageUrl);
        setImgError(false);
        onImageChange(null, defaultImageUrl);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleImageError = () => {
        console.error(`Failed to load image: ${previewUrl}`);
        setImgError(true);
    };

    return (
        <div className={`relative ${className}`}>
            {imgError ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 rounded-lg text-gray-500 text-sm">
                    <div className="text-center p-2">
                        <p>Failed to load image</p>
                        <p className="text-xs mt-1 text-gray-400 break-all">{previewUrl.substring(0, 30)}...</p>
                    </div>
                </div>
            ) : (
                <img
                    src={previewUrl}
                    alt="Upload preview"
                    className="w-full h-full object-cover rounded-lg"
                    onError={handleImageError}
                />
            )}
            {!disabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                    <div className="flex flex-col items-center space-y-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-white text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                        >
                            Change Image
                        </button>
                        {previewUrl !== defaultImageUrl && (
                            <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                </div>
            )}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={disabled}
            />
        </div>
    );
};

export default ImageUpload; 