# Uploads Directory

This directory is used to store uploaded files for EspressoLane, particularly images for:
- User avatars
- Product images
- Category images
- Reward images

## Setup

1. Make sure this directory exists at the root of your project:
```bash
mkdir -p uploads
```

2. Add the following to your `.gitignore` file:
```
# Ignore all files in uploads except .gitkeep and this README
/uploads/*
!/uploads/.gitkeep
!/uploads/README.md
```

3. Create the .gitkeep file to preserve the directory in git:
```bash
touch uploads/.gitkeep
```

## Directory Structure

```
uploads/
├── .gitkeep
├── README.md
└── ... (uploaded files)
```

## File Management

- Files are automatically saved here when uploaded through the application
- Each file gets a unique name with timestamp and random string
- Old files are automatically deleted when replaced
- Default system images are stored in src/assets and not here

## File Types Allowed

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

## Size Limits

- Maximum file size: 5MB

## Security

- Only authenticated users can upload files
- File types are validated on both frontend and backend
- Files are served through the backend API
- Original file names are not preserved to prevent security issues

## Maintenance

The application automatically manages this directory:
- Creates it if missing
- Cleans up unused files
- Maintains unique filenames

## Troubleshooting

If you encounter issues:
1. Ensure the directory exists and is writable
2. Check file permissions (should be 755 for directory)
3. Verify the uploads directory is properly configured in your server settings
4. Check server logs for any file system errors 