/**
 * OraVisionAI - Image Upload Dropzone Component (Phase 23)
 *
 * Supports drag-and-drop, accessible file browser input, client-side pre-flight validation
 * (15 MiB limit, JPEG/PNG/WebP), and immediate zero-latency local preview.
 */

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';

export interface ImageUploadZoneProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  isUploading?: boolean;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MiB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export const ImageUploadZone: React.FC<ImageUploadZoneProps> = ({
  onFileSelected,
  selectedFile,
  onClearFile,
  isUploading = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage preview object URL lifecycle
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const validateAndSelect = (file: File) => {
    setValidationError(null);

    // Empty file check
    if (file.size === 0) {
      setValidationError('Selected file is empty (0 bytes). Please choose a valid image.');
      return;
    }

    // Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError('File size exceeds the 15 MiB limit. Please select an image under 15 MiB.');
      return;
    }

    // MIME type & extension check
    const lowerName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

    if (!hasValidExt || !hasValidMime) {
      setValidationError('Unsupported format. Please select a JPEG, PNG, or WebP oral cavity photograph.');
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValidationError(null);
    onClearFile();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KiB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MiB';
  };

  return (
    <div className='space-y-3'>
      {validationError && (
        <Alert variant='danger' title='File Validation Error'>
          <div className='flex items-center gap-2'>
            <AlertCircle className='h-4 w-4 shrink-0' />
            <span>{validationError}</span>
          </div>
        </Alert>
      )}

      {selectedFile && previewUrl ? (
        <div className='relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
          <div className='flex flex-col sm:flex-row items-center gap-4'>
            <div className='relative h-36 w-36 sm:h-44 sm:w-44 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center'>
              <img
                src={previewUrl}
                alt='Selected oral cavity photograph preview'
                className='h-full w-full object-cover'
              />
            </div>
            <div className='flex-1 min-w-0 space-y-1 text-center sm:text-left'>
              <div className='flex items-center justify-between'>
                <h4 className='text-sm font-semibold text-slate-900 truncate' title={selectedFile.name}>
                  {selectedFile.name}
                </h4>
                {!isUploading && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={handleRemove}
                    aria-label='Remove selected image'
                    className='text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200'
                  >
                    <X className='h-4 w-4 mr-1' />
                    Remove
                  </Button>
                )}
              </div>
              <p className='text-xs text-slate-500'>
                Format: <span className='font-medium text-slate-700'>{selectedFile.type || 'image'}</span>
              </p>
              <p className='text-xs text-slate-500'>
                Size: <span className='font-medium text-slate-700'>{formatFileSize(selectedFile.size)}</span>
              </p>
              <p className='text-xs text-emerald-600 font-medium pt-1'>
                Ready for secure transmission and dual-stage AI inference.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ' +
            (isDragging
              ? 'border-clinical-500 bg-clinical-50/50 scale-[1.01]'
              : 'border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-50')
          }
        >
          <input
            ref={fileInputRef}
            type='file'
            id='oral-image-input'
            accept='image/jpeg,image/png,image/webp'
            onChange={handleFileInputChange}
            disabled={isUploading}
            className='sr-only'
            aria-describedby='upload-instructions'
          />

          <div className='rounded-full bg-clinical-100 p-3 text-clinical-600 mb-3'>
            <UploadCloud className='h-6 w-6' />
          </div>

          <label
            htmlFor='oral-image-input'
            className='cursor-pointer text-sm font-semibold text-clinical-700 hover:text-clinical-800 focus-within:outline-none focus-within:ring-2 focus-within:ring-clinical-500 focus-within:ring-offset-2 rounded px-2 py-1'
          >
            <span>Upload oral photograph</span>
            <span className='font-normal text-slate-600'> or drag and drop</span>
          </label>

          <p id='upload-instructions' className='text-xs text-slate-500 mt-1 max-w-sm'>
            Supported formats: JPEG, PNG, WebP. Maximum file size: 15 MiB. Ensure clear illumination and sharp focus
            of the mucosal region.
          </p>
        </div>
      )}
    </div>
  );
};

export default ImageUploadZone;
