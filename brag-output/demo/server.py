"""Loopback-only synthetic video fixtures. Never loads .env or connects to a database.

Uses the repository's existing test snapshot, existing validation images, current
risk evaluator and actual PDF renderer. This is a UI demonstration, not live
inference or a medical assessment. No production routes/config are modified.
"""
import ast, asyncio, copy, json, sys, uuid
from pathlib import Path
from types import SimpleNamespace
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
ROOT=Path(__file__).resolve().parents[2]
ASSETS=ROOT/'brag-output/composition/assets'
sys.path.insert(0,str(ROOT/'backend'))
from app.services.pdf_report_renderer import PDFReportRenderer
from app.services.risk_assessment_service import RiskAssessmentService, TIER_TECHNICAL_INDEX

tree=ast.parse((ROOT/'scratch/validate_phase11.py').read_text(encoding='utf-8'))
node=next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='sample_snapshot' for t in n.targets))
# Evaluate only the selected repository fixture literal, not the validation suite.
fixture=eval(compile(ast.Expression(node),'<repository sample_snapshot>','eval'),{'uuid':uuid,'str':str,'__builtins__':{}})
actual=json.loads((ROOT/'brag-output/demo/actual-inference.json').read_text(encoding='utf-8'))
fixture['primary_prediction'].update(actual['classification'])
fixture['detections']=actual['detections']
SID='550e8400-e29b-41d4-a716-446655440000'
NOW='2026-10-02T09:00:00Z'
fixture.update(report_number='RPT-DEMO-001',report_title='Synthetic Demo — Oral Health AI Screening Report',total_images=1)
fixture['patient'].update(first_name='Demo',last_name='Patient',date_of_birth=None,gender=None)
fixture['screening']['id']=SID
fixture['primary_prediction']['inference_duration_ms']=actual['inference_duration_ms']
level,factors,summary,action=RiskAssessmentService.evaluate_clinical_context(SimpleNamespace(**fixture['primary_prediction']),[SimpleNamespace(**d) for d in fixture['detections']],None,None)
risk=dict(id='risk-demo',screening_id=SID,risk_level=level,risk_score=float(TIER_TECHNICAL_INDEX[level]),contributing_factors=factors,summary=summary,recommended_action=action,created_at=NOW,engine_version='v1.0',disclaimer='Ordinal urgency tier, not disease probability.')
fixture['risk_assessment']=risk
state={'created':False,'completed':False,'requested':False,'assessment':None,'report':None}
dentist=dict(id='dentist-demo',user_id='dentist',email='dentist@oravision.test',first_name='Demo',last_name='Dentist',license_number='DEMO-NOT-A-LICENSE',specialization='General Dentistry',clinic_name='Demo Clinical Workspace',verification_status='approved',created_at=NOW,updated_at=NOW)
image=dict(id='image-demo',screening_id=SID,storage_path='Mucocele.png',file_name='Mucocele.png',mime_type='image/png',file_size_bytes=(ROOT/'brag-output/images/Mucocele.png').stat().st_size,image_width=178,image_height=175,is_primary=True,created_at=NOW)
probabilities=copy.deepcopy(actual['classification']['probabilities'])
prediction=dict(id='prediction-demo',predicted_class=actual['classification']['predicted_class'],confidence=actual['classification']['confidence'],probabilities=probabilities)
xais=[dict(id='xai-'+x['method'],method=x['method'],target_layer=x['target_layer'],is_primary_user_facing=True,heatmap_storage_path=x['heatmap_storage_path'],overlay_image_storage_path=x['overlay_image_storage_path'],created_at=NOW) for x in actual['xai']]
def session(): return dict(id=SID,patient_id='patient-demo',created_by_id='patient',status='completed' if state['completed'] else 'pending',clinical_notes=fixture['screening']['clinical_notes'],is_deleted=False,created_at=NOW,updated_at=NOW,images=[image])
def review(): return dict(screening_id=SID,patient_id='patient-demo',patient_name='Demo Patient',patient_age=None,patient_gender=None,patient_notes=fixture['screening']['clinical_notes'],screening_status='completed',screening_created_at=NOW,total_images=1,images=[image],primary_prediction=prediction,yolo_detections=fixture['detections'],xai_results=xais,risk_assessment=risk,dentist_assessments=[state['assessment']] if state['assessment'] else [])
app=FastAPI(title='OraVisionAI isolated synthetic capture fixtures')
app.add_middleware(CORSMiddleware,allow_origins=['http://127.0.0.1:5173'],allow_methods=['*'],allow_headers=['*'])
@app.get('/assets/{name}')
def asset(name:str):
 if name=='Mucocele.png': return FileResponse(ROOT/'brag-output/images/Mucocele.png')
 if name not in [*(x['overlay_image_storage_path'] for x in xais),'demo-report.pdf']: raise HTTPException(404)
 return FileResponse(ASSETS/name)
@app.api_route('/api/{route:path}',methods=['GET','POST','PATCH'])
async def api(route:str,request:Request):
 method=request.method
 if route=='notifications/unread-count': return {'unread_count':0}
 if route=='notifications': return {'items':[],'total':0,'unread_count':0}
 if route=='appointments': return {'items':[],'total':0}
 if route=='dentists': return [dentist]
 if route=='dentists/me': return dentist
 if route=='dentists/me/verification': return dict(id='demo-verification',dentist_id='dentist-demo',status='approved',document_type='Synthetic demo',document_url='',file_name='demo',submitted_at=NOW)
 if route in ['dentists/me/reviews','dentists/me/patient-cases']:
  item=dict(assessment_id='assessment-demo',screening_id=SID,patient_id='patient-demo',patient_name='Demo Patient',screening_date=NOW,requested_at=NOW,status='completed',clinical_notes=fixture['screening']['clinical_notes'],ai_class=prediction['predicted_class'],risk_level=level,risk_score=risk['risk_score'],review_status='finalized' if state['assessment'] and state['assessment']['is_finalized'] else 'pending_review')
  return {'items':[item] if state['requested'] else [],'total':int(state['requested'])}
 if route=='screenings':
  if method=='POST':
   state['created']=True
   fixture['screening']['clinical_notes']=(await request.json()).get('clinical_notes')
   return session()
  return {'items':[session()] if state['created'] else [],'total':int(state['created']),'page':1,'page_size':20}
 if route==f'screenings/{SID}/images': return image
 if route==f'screenings/{SID}/run-ai':
  await asyncio.sleep(3)
  state['completed']=True
  return dict(screening_id=SID,status='completed',total_images_processed=1,results=[dict(screening_image_id=image['id'],classification=prediction,detections=fixture['detections'])])
 if route==f'screenings/{SID}/review': return review()
 if route==f'screenings/{SID}': return session()
 if route==f'screenings/{SID}/artifacts/signed-url':
  name=request.query_params['path']
  if name not in [image['storage_path'],*(x['overlay_image_storage_path'] for x in xais)]: raise HTTPException(404)
  return {'signed_url':'http://127.0.0.1:8000/assets/'+name,'storage_path':name,'expires_in':3600}
 if route==f'screenings/{SID}/request-review':
  state['requested']=True
  state['assessment']=dict(id='assessment-demo',screening_id=SID,dentist_id='dentist-demo',clinical_observations='',diagnosis_notes='',treatment_recommendation='',referral_needed=False,is_finalized=False,dentist_name='Demo Dentist',dentist_clinic='Demo Clinical Workspace',created_at=NOW,updated_at=NOW)
  return state['assessment']
 if route==f'screenings/{SID}/assessment':
  if method in ['POST','PATCH']:
   state['assessment'].update(await request.json())
   if state['assessment']['is_finalized']: state['assessment']['finalized_at']=NOW
  if not state['assessment']: raise HTTPException(404)
  return state['assessment']
 if route==f'screenings/{SID}/risk-assessment': return risk
 if route.startswith(f'screenings/{SID}/xai'): return {'screening_id':SID,'results':xais,'total_results':len(xais)}
 if route==f'screenings/{SID}/report':
  if method=='POST':
   snapshot=copy.deepcopy(fixture)
   snapshot['dentist_assessments']=[state['assessment']] if state['assessment'] else []
   snapshot['xai_results']=xais
   (ASSETS/'demo-report.pdf').write_bytes(PDFReportRenderer.render_pdf(snapshot))
   state['report']=dict(id='report-demo',screening_id=SID,report_number='RPT-DEMO-001',report_title=fixture['report_title'],created_at=NOW,updated_at=NOW,report_data=snapshot)
  if not state['report']: raise HTTPException(404)
  return state['report']
 if route=='reports/report-demo/download': return FileResponse(ASSETS/'demo-report.pdf',media_type='application/pdf',filename='OraVisionAI-Synthetic-Demo.pdf')
 raise HTTPException(404,detail='Not part of the isolated demo fixture')
if __name__=='__main__':
 import uvicorn
 uvicorn.run(app,host='127.0.0.1',port=8000,log_level='warning')
