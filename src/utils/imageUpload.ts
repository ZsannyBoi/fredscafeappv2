export async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch('http://localhost:3001/api/upload/image', {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Upload failed with status: ${response.status}`);
        }

        const data = await response.json();
        return data.url;
    } catch (err: any) {
        console.error('Error uploading image:', err);
        throw new Error(err.message || 'Failed to upload image');
    }
} 