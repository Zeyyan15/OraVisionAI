/**
 * OraVisionAI - YOLO Lesion Detector Overlay Component (Phase 23)
 *
 * Renders normalized bounding box coordinates for spatial localization evidence.
 * Preserves strict semantic boundary: localization is region-of-interest evidence,
 * not lesion severity, clinical staging, or disease diagnosis.
 */

import React from 'react';
import { DetectionItem } from '../../types/screening';
import { Crosshair, Info } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface YoloOverlayViewerProps {
  imageSrc?: string | null;
  detections: DetectionItem[];
  imageWidth?: number | null;
  imageHeight?: number | null;
  fileName?: string;
}

export const YoloOverlayViewer: React.FC<YoloOverlayViewerProps> = ({
  imageSrc,
  detections,
  imageWidth,
  imageHeight,
  fileName,
}) => {
  const hasDetections = detections && detections.length > 0;
  const [imgError, setImgError] = React.useState(false);

  // Reset imgError when imageSrc changes
  React.useEffect(() => {
    setImgError(false);
  }, [imageSrc]);

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100'>
        <div className='flex items-center gap-2'>
          <Crosshair className='h-5 w-5 text-clinical-600' />
          <div>
            <h3 className='text-base font-semibold text-slate-900'>
              Spatial Lesion Localization
            </h3>
            <p className='text-xs text-slate-500'>
              Automated region-of-interest findings from the YOLO lesion detector.
            </p>
          </div>
        </div>
        <Badge variant={hasDetections ? 'warning' : 'neutral'}>
          {hasDetections
            ? detections.length + (detections.length === 1 ? ' Region Detected' : ' Regions Detected')
            : 'No Lesions Localized'}
        </Badge>
      </div>

      {/* Visual Image & Bounding Box Overlay */}
      <div className='relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900 flex items-center justify-center min-h-[260px] max-h-[460px]'>
        {imageSrc && !imgError ? (
          <div className='relative w-full h-full flex items-center justify-center'>
            <img
              src={imageSrc}
              alt='Oral cavity screening photograph with lesion bounding boxes'
              className='max-h-[440px] w-auto max-w-full object-contain'
              onError={() => setImgError(true)}
            />
            {/* Normalized Bounding Boxes Container */}
            <div
              className='absolute inset-0 pointer-events-none'
              style={{
                width: '100%',
                height: '100%',
              }}
            >
              {detections.map((det, idx) => {
                const left = det.bbox.x_min * 100;
                const top = det.bbox.y_min * 100;
                const width = Math.max((det.bbox.x_max - det.bbox.x_min) * 100, 2);
                const height = Math.max((det.bbox.y_max - det.bbox.y_min) * 100, 2);

                return (
                  <div
                    key={idx}
                    className='absolute border-2 border-amber-400 bg-amber-400/15 rounded-sm transition-all'
                    style={{
                      left: left + '%',
                      top: top + '%',
                      width: width + '%',
                      height: height + '%',
                    }}
                  >
                    <span className='absolute -top-6 left-0 bg-amber-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap'>
                      {det.class_name}: {(det.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : imgError ? (
          <div className='p-8 text-center text-slate-300 space-y-2 max-w-md'>
            <div className='inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-amber-400 mb-2'>
              <Crosshair className='h-6 w-6' />
            </div>
            <h4 className='text-sm font-semibold text-slate-200'>
              Photograph Temporarily Unavailable
            </h4>
            <p className='text-xs text-slate-400 leading-relaxed'>
              Unable to display oral cavity photograph at this time. Spatial findings and coordinates remain verified below.
            </p>
            {fileName && (
              <p className='text-[11px] text-slate-500 font-mono pt-1'>
                Artifact reference: {fileName}
              </p>
            )}
          </div>
        ) : (
          <div className='p-8 text-center text-slate-300 space-y-2 max-w-md'>
            <div className='inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-slate-400 mb-2'>
              <Crosshair className='h-6 w-6' />
            </div>
            <h4 className='text-sm font-semibold text-slate-200'>
              Loading Photograph...
            </h4>
            <p className='text-xs text-slate-400 leading-relaxed'>
              Retrieving secure clinical artifact from storage.
            </p>
            {fileName && (
              <p className='text-[11px] text-slate-500 font-mono pt-1'>
                Artifact reference: {fileName}
                {imageWidth && imageHeight ? ' (' + imageWidth + 'x' + imageHeight + 'px)' : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Accessible Bounding Coordinates Table */}
      <div className='space-y-2 pt-1'>
        <h4 className='text-xs font-semibold text-slate-700 uppercase tracking-wider'>
          Detection Findings & Coordinates
        </h4>

        {hasDetections ? (
          <div className='overflow-x-auto rounded-lg border border-slate-100'>
            <table
              className='min-w-full divide-y divide-slate-100 text-xs text-left'
              summary='Detected oral cavity lesions, coordinates, and model confidence scores'
            >
              <thead className='bg-slate-50 text-slate-600 font-semibold'>
                <tr>
                  <th scope='col' className='py-2 px-3'>#</th>
                  <th scope='col' className='py-2 px-3'>Finding Label</th>
                  <th scope='col' className='py-2 px-3'>Confidence</th>
                  <th scope='col' className='py-2 px-3'>Bounding Box [x_min, y_min, x_max, y_max]</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100 font-mono'>
                {detections.map((det, idx) => (
                  <tr key={idx} className='hover:bg-slate-50/70'>
                    <td className='py-2 px-3 text-slate-500'>{idx + 1}</td>
                    <td className='py-2 px-3 font-medium text-slate-900'>{det.detected_class || det.class_name || 'Lesion'}</td>
                    <td className='py-2 px-3 text-amber-700 font-semibold'>
                      {(det.confidence * 100).toFixed(1)}%
                    </td>
                    <td className='py-2 px-3 text-slate-600 text-[11px]'>
                      [{det.bbox.x_min.toFixed(3)}, {det.bbox.y_min.toFixed(3)},{' '}
                      {det.bbox.x_max.toFixed(3)}, {det.bbox.y_max.toFixed(3)}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className='text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg'>
            No focal lesions or mucosal abnormalities were detected in this photograph by the YOLO lesion detector.
          </p>
        )}
      </div>

      <div className='flex items-start gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500'>
        <Info className='h-4 w-4 text-slate-400 shrink-0 mt-0.5' />
        <p>
          <span className='font-semibold text-slate-600'>Spatial Evidence Policy:</span> The YOLO lesion detector
          identifies localized regions of mucosal variation. Bounding boxes do not assess disease severity, cancer
          staging, or histopathology.
        </p>
      </div>
    </div>
  );
};

export default YoloOverlayViewer;
