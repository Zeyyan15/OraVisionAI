import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, ChevronDown, Info, Image as ImageIcon } from 'lucide-react';
import { XaiMethod } from '../../types/domain';
import { XAIResultResponse } from '../../types/screening';
import { Button } from '../ui/Button';
import { getArtifactSignedUrl } from '../../api/screeningEndpoints';

export interface XaiSectionProps {
  xaiResults: Array<Pick<XAIResultResponse, 'id' | 'target_layer' | 'is_primary_user_facing' | 'heatmap_storage_path' | 'overlay_image_storage_path'> & { method: string; created_at?: string }>;
  isGenerating?: boolean;
  onGenerateMethod: (method: string) => Promise<void>;
  screeningId?: string;
}
const methods: { id: XaiMethod; name: string; description: string; advanced?: boolean }[] = [
  { id:'occlusion_sensitivity', name:'Occlusion Sensitivity', description:'Highlights the patches that most influenced the model when parts of the photograph were hidden.' },
  { id:'grad_cam', name:'Grad-CAM', description:'Highlights image regions that contributed to the model’s selected class.' },
  { id:'grad_cam_plus_plus', name:'Grad-CAM++', description:'An alternative gradient-based view of the regions that influenced the model.', advanced:true },
  { id:'layer_cam', name:'LayerCAM', description:'Explores model attention through local feature activations.', advanced:true },
  { id:'score_cam', name:'Score-CAM', description:'Uses changes in model scores to visualize influential regions.', advanced:true },
  { id:'integrated_gradients', name:'Integrated Gradients', description:'Compares image features with a baseline to estimate their contribution.', advanced:true },
];

export const XaiSection: React.FC<XaiSectionProps> = ({xaiResults,isGenerating=false,onGenerateMethod,screeningId}) => {
  const [selected, setSelected] = useState<XaiMethod>('occlusion_sensitivity');
  const [advanced, setAdvanced] = useState(false);
  const [computing, setComputing] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);
  const current = xaiResults.find(result => result.method === selected);
  const method = methods.find(item => item.id === selected)!;
  useEffect(() => {
    let active = true;
    setUrl(null); setImageFailed(false);
    const path = current?.overlay_image_storage_path || current?.heatmap_storage_path;
    if (screeningId && path) {
      setLoadingImage(true);
      getArtifactSignedUrl(screeningId,path).then(result => { if(active) setUrl(result.signed_url); })
        .catch(() => { if(active) setImageFailed(true); })
        .finally(() => { if(active) setLoadingImage(false); });
    } else setLoadingImage(false);
    return () => { active=false; };
  },[screeningId,current?.overlay_image_storage_path,current?.heatmap_storage_path]);
  const generate = async () => {
    setComputing(true); setComputeError(null);
    try { await onGenerateMethod(selected); }
    catch(error) { setComputeError(error instanceof Error ? error.message : 'Could not generate the heatmap. Please try again.'); }
    finally { setComputing(false); }
  };
  const recorded = current?.created_at ? new Date(current.created_at) : null;
  const validDate = recorded && !Number.isNaN(recorded.getTime());
  return <section className='results-panel' aria-label='Visual explanations'>
    <div className='results-panel-heading'>
      <span className='results-icon'><Sparkles className='h-5 w-5' /></span>
      <div><h3>What influenced the model?</h3><p>Explore the visual explanation behind your result.</p></div>
      <span className='results-chip ml-auto hidden sm:inline-flex'>Explainable AI</span>
    </div>
    <div className='grid gap-6 pt-6 lg:grid-cols-[260px_minmax(0,1fr)]'>
      <div className='space-y-5'>
        <div><p className='results-eyebrow mb-3'>Explanation method</p>
          <div className='space-y-2' aria-label='Explanation methods'>
            {methods.filter(item => !item.advanced || advanced).map(item => <button key={item.id} type='button' aria-pressed={selected===item.id} onClick={() => {setSelected(item.id);setComputeError(null);}} className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${selected===item.id ? 'border-[#087f70] bg-emerald-50 font-semibold text-emerald-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {item.name}{xaiResults.some(result=>result.method===item.id) && <CheckCircle2 className='h-4 w-4 shrink-0 text-emerald-600' />}
            </button>)}
          </div>
          <button type='button' aria-expanded={advanced} onClick={()=>setAdvanced(!advanced)} className='mt-3 flex items-center gap-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-900'>Advanced methods<ChevronDown className={`h-3.5 w-3.5 ${advanced ? 'rotate-180' : ''}`} /></button>
        </div>
        <div className='rounded-xl bg-slate-50 p-4'><h4 className='text-sm font-semibold text-slate-800'>{method.name}</h4><p className='mt-2 text-sm leading-relaxed text-slate-500'>{method.description}</p></div>
        <Button type='button' size='sm' onClick={generate} disabled={isGenerating || computing} loading={computing} className='w-full !h-auto min-h-10 py-2'>{computing ? 'Generating explanation…' : current ? 'Regenerate heatmap' : 'Generate heatmap'}</Button>
        {computeError && <p role='alert' className='text-sm text-rose-700'>{computeError}</p>}
      </div>
      <div className='min-w-0 space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2 text-xs'><span className='font-semibold text-slate-700'>{method.name} · Overlay</span><span className={current ? 'text-emerald-700' : 'text-slate-400'}>{current ? 'Explanation generated' : 'Not generated yet'}</span></div>
        <div className='flex min-h-64 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[#edf2f0] lg:min-h-80'>
          {url && !imageFailed ? <img src={url} alt={`${method.name} feature attribution`} onError={()=>setImageFailed(true)} className='block max-h-[480px] w-full object-contain' /> : <div className='max-w-sm space-y-3 px-6 py-12 text-center'><ImageIcon className='mx-auto h-8 w-8 text-slate-400' /><p className='text-sm font-medium text-slate-600'>{loadingImage ? 'Loading your explanation…' : current ? 'Heatmap preview unavailable' : 'Your heatmap will appear here'}</p><p className='text-xs leading-relaxed text-slate-500'>{current ? 'The saved explanation could not be displayed. Try refreshing the screening.' : 'Choose a method and generate a heatmap to see which regions influenced the model.'}</p></div>}
        </div>
        <div className='flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500'><span>Color intensity indicates influence on model output.</span>{validDate && <time dateTime={current!.created_at}>Generated {recorded.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</time>}</div>
      </div>
    </div>
    <div className='results-footnote mt-6'><Info className='h-4 w-4 shrink-0' /><p>A heatmap explains model attention. It does not identify disease boundaries or establish a diagnosis.</p></div>
  </section>;
};
export default XaiSection;
