"""Local-only inference for the user-supplied demo image; no database or .env."""
import json, sys
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'backend'))
from app.services.ai_inference_service import AIInferenceService, AIModelManager
from app.services.xai_service import XAIAlgorithms, render_heatmap_and_overlay
from tensorflow.keras.models import load_model
from ultralytics import YOLO

source=ROOT/'brag-output/images/Mucocele.png'
data=source.read_bytes()
AIModelManager._classifier_model=load_model(ROOT/'ai_models/best_7teeth_efficientnetb0_verified.keras',compile=False)
AIModelManager._yolo_model=YOLO(ROOT/'ai_models/oravisionai_yolo.pt')
classification,duration=AIInferenceService.classify_image(data)
detections=AIInferenceService.detect_lesions(data)
print('Classification:',classification.predicted_class,classification.confidence,'detections:',len(detections),flush=True)
class_idx=next(i for i,p in enumerate(classification.probabilities) if p.class_name==classification.predicted_class)
assets=ROOT/'brag-output/composition/assets'
xai=[]
for method in ['grad_cam','occlusion_sensitivity']:
 try:
  if method=='grad_cam': heat,layer=XAIAlgorithms.grad_cam(AIModelManager._classifier_model,data,class_idx)
  else: heat=XAIAlgorithms.occlusion_sensitivity(AIModelManager._classifier_model,data,class_idx,patch_size=32,stride=32);layer=''
  raw,overlay=render_heatmap_and_overlay(heat,Image.open(source))
  (assets/(method+'-heat.png')).write_bytes(raw)
  (assets/(method+'-overlay.png')).write_bytes(overlay)
  xai.append({'method':method,'target_layer':layer,'heatmap_storage_path':method+'-heat.png','overlay_image_storage_path':method+'-overlay.png'})
  print('XAI:',method,flush=True)
 except Exception as exc: print('XAI unavailable:',method,repr(exc),flush=True)
out={'classification':classification.model_dump(),'detections':[d.model_dump() for d in detections],'xai':xai,'inference_duration_ms':duration}
(ROOT/'brag-output/demo/actual-inference.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('Wrote actual-inference.json',flush=True)
