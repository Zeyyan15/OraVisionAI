/**
 * OraVisionAI - New Patient Screening Wizard Page (Phase 23)
 *
 * Guides patient through structured screening workflow:
 * 1. Clinical Notes & Symptoms
 * 2. Oral Photograph Selection & Client Validation
 * 3. Multipart Image Upload
 * 4. Dual-Stage AI Diagnostic Inference Execution
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScreening } from '../../hooks/useScreening';
import { ImageUploadZone } from '../../components/screening/ImageUploadZone';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import {
  FileText,
  UploadCloud,
  Cpu,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const NewScreeningPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    createSession,
    uploadImage,
    runInference,
    deleteSession,
    isCreating,
    isUploading,
    error,
  } = useScreening();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [createdScreeningId, setCreatedScreeningId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Step 1: Create Screening Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const res = await createSession({
      clinical_notes: clinicalNotes.trim() ? clinicalNotes.trim() : null,
    });

    if (res) {
      setCreatedScreeningId(res.id);
      setStep(2);
    } else {
      setActionError('Failed to initiate screening session. Please check your network connection.');
    }
  };

  // Step 2 -> 3: Upload Image & Run AI
  const handleUploadAndRunAI = async () => {
    if (!createdScreeningId || !selectedFile) return;
    setActionError(null);

    // 1. Upload
    const uploadRes = await uploadImage(createdScreeningId, selectedFile);
    if (!uploadRes) {
      setActionError('Failed to upload image photograph. Please verify file format and size.');
      return;
    }
    setStep(3);

    // 2. Run Inference
    const inferenceRes = await runInference(createdScreeningId);
    if (inferenceRes) {
      navigate('/patient/screenings/' + createdScreeningId);
    } else {
      setActionError('AI inference encountered an error. You may retry analysis from the session view.');
    }
  };

  // Discard / Soft-delete Session
  const handleDiscardSession = async () => {
    if (createdScreeningId) {
      await deleteSession(createdScreeningId);
    }
    navigate('/patient/dashboard');
  };

  return (
    <div className='max-w-3xl mx-auto space-y-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-slate-900'>
            New Oral Cavity Screening
          </h1>
          <p className='text-sm text-slate-500'>
            Capture patient notes, attach high-resolution oral photograph, and execute AI diagnostic analysis.
          </p>
        </div>

        {createdScreeningId && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleDiscardSession}
            className='text-rose-600 hover:bg-rose-50 border-rose-200 self-start sm:self-auto'
          >
            <Trash2 className='h-4 w-4 mr-1.5' />
            Discard Session
          </Button>
        )}
      </div>

      {/* Wizard Progress Steps */}
      <div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm' aria-label='Screening progress'>
        <div className='flex items-center justify-between'>
          {/* Step 1 */}
          <div className='flex items-center gap-2'>
            <div
              className={'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ' +
                (step === 1
                  ? 'bg-clinical-600 text-white'
                  : step > 1
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-400')
              }
            >
              {step > 1 ? <CheckCircle2 className='h-4 w-4' /> : '1'}
            </div>
            <span className={'text-xs font-medium hidden sm:inline ' + (step === 1 ? 'text-slate-900 font-bold' : 'text-slate-500')}>
              Clinical Symptoms
            </span>
          </div>

          <div className={'flex-1 h-0.5 mx-3 ' + (step > 1 ? 'bg-emerald-500' : 'bg-slate-200')} />

          {/* Step 2 */}
          <div className='flex items-center gap-2'>
            <div
              className={'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ' +
                (step === 2
                  ? 'bg-clinical-600 text-white'
                  : step > 2
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-400')
              }
            >
              {step > 2 ? <CheckCircle2 className='h-4 w-4' /> : '2'}
            </div>
            <span className={'text-xs font-medium hidden sm:inline ' + (step === 2 ? 'text-slate-900 font-bold' : 'text-slate-500')}>
              Photograph Selection
            </span>
          </div>

          <div className={'flex-1 h-0.5 mx-3 ' + (step > 2 ? 'bg-emerald-500' : 'bg-slate-200')} />

          {/* Step 3 */}
          <div className='flex items-center gap-2'>
            <div
              className={'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ' +
                (step === 3
                  ? 'bg-clinical-600 text-white'
                  : 'bg-slate-100 text-slate-400')
              }
            >
              <Cpu className='h-3.5 w-3.5' />
            </div>
            <span className={'text-xs font-medium hidden sm:inline ' + (step === 3 ? 'text-slate-900 font-bold' : 'text-slate-500')}>
              AI Analysis
            </span>
          </div>
        </div>
      </div>

      {/* Error Notices */}
      {(actionError || error) && (
        <Alert variant='danger' title='Operation Notice'>
          <div className='flex items-center gap-2'>
            <AlertCircle className='h-4 w-4 shrink-0' />
            <span>{actionError || error?.message || 'An unexpected error occurred.'}</span>
          </div>
        </Alert>
      )}

      {/* Step 1 Form */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <FileText className='h-5 w-5 text-clinical-600' />
              <CardTitle>Step 1: Patient-Reported Symptoms</CardTitle>
            </div>
            <CardDescription>
              Record any observable oral pain, mucosal changes, lesion duration, or relevant medical observations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSession} className='space-y-4'>
              <div>
                <label
                  htmlFor='clinical-notes'
                  className='block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5'
                >
                  Clinical Observations & Patient Notes (Optional)
                </label>
                <textarea
                  id='clinical-notes'
                  rows={4}
                  maxLength={2000}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder='e.g., White non-scrapable patch observed on the lateral left tongue for 3 weeks; mild discomfort when consuming spicy foods.'
                  className='w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 placeholder-slate-400 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500'
                />
                <div className='flex justify-between text-[11px] text-slate-400 mt-1'>
                  <span>Max 2,000 characters</span>
                  <span>{clinicalNotes.length}/2000</span>
                </div>
              </div>

              <div className='flex justify-end gap-3 pt-3 border-t border-slate-100'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => navigate('/patient/dashboard')}
                >
                  Cancel
                </Button>
                <Button type='submit' variant='primary' disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin mr-2' />
                      Initiating Session...
                    </>
                  ) : (
                    <>
                      Proceed to Image Selection
                      <ArrowRight className='h-4 w-4 ml-2' />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2 Form: Image Selection */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <UploadCloud className='h-5 w-5 text-clinical-600' />
                <CardTitle>Step 2: Select Oral Cavity Photograph</CardTitle>
              </div>
              <Badge variant='info'>Session Ready</Badge>
            </div>
            <CardDescription>
              Upload a clear photograph of the lesion or area of clinical interest.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <ImageUploadZone
              onFileSelected={(file) => setSelectedFile(file)}
              selectedFile={selectedFile}
              onClearFile={() => setSelectedFile(null)}
              isUploading={isUploading}
            />

            <div className='flex items-center justify-between pt-4 border-t border-slate-100'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setStep(1)}
                disabled={isUploading}
              >
                <ArrowLeft className='h-4 w-4 mr-2' />
                Back to Notes
              </Button>

              <Button
                type='button'
                variant='primary'
                onClick={handleUploadAndRunAI}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin mr-2' />
                    Uploading Image...
                  </>
                ) : (
                  <>
                    Upload & Run AI Analysis
                    <ArrowRight className='h-4 w-4 ml-2' />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: AI Processing Active */}
      {step === 3 && (
        <Card className='text-center p-8'>
          <CardContent className='space-y-4 max-w-md mx-auto'>
            <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-clinical-50 text-clinical-600 animate-pulse mb-2'>
              <Cpu className='h-8 w-8' />
            </div>
            <h3 className='text-lg font-bold text-slate-900'>
              Analyzing Oral Photograph
            </h3>
            <p className='text-xs text-slate-500 leading-relaxed'>
              The dual-stage deep learning pipeline is executing YOLO spatial localization and EfficientNetB0 7-class
              differential classification synchronously.
            </p>
            <div className='flex items-center justify-center gap-2 pt-2 text-xs font-semibold text-clinical-700'>
              <Loader2 className='h-4 w-4 animate-spin' />
              <span>Processing model activations...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewScreeningPage;
