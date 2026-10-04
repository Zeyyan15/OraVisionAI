// Uses synthetic accounts and intercepts every backend/auth request. No real records are modified.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
const types = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.ico':'image/x-icon','.json':'application/json' };
const server = http.createServer(async (req,res) => {
  try {
    let file = path.resolve(root,'dist',`.${decodeURIComponent(new URL(req.url,'http://localhost').pathname)}`);
    if (!file.startsWith(path.join(root,'dist'))) { res.writeHead(403);res.end();return; }
    let body; try { body=await fs.readFile(file); } catch { file=path.join(root,'dist/index.html');body=await fs.readFile(file); }
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream'});res.end(body);
  } catch { res.writeHead(500);res.end(); }
});
await new Promise((resolve) => server.listen(8091,'127.0.0.1',resolve));
const origin='http://127.0.0.1:8091';
const stamp='2026-10-04T09:00:00Z';
const doctor={id:'d1',user_id:'doctor-user',first_name:'Demo',last_name:'Dentist',email:'doctor@example.test',specialization:'General Dentistry',clinic_name:'Demo Clinic',license_number:'DEMO',years_of_experience:5,verification_status:'approved',bio:'Synthetic practice profile',created_at:stamp,updated_at:stamp};
const screening={id:'s1',patient_id:'p1',status:'completed',created_at:stamp,updated_at:stamp,clinical_notes:'Synthetic screening',is_deleted:false};
const appointment={id:'a1',patient_id:'p1',dentist_id:'d1',screening_id:'s1',scheduled_start:'2026-10-05T10:00:00Z',scheduled_end:'2026-10-05T10:30:00Z',appointment_type:'video_teleconsultation',status:'confirmed',patient_name:'Demo Patient',dentist_name:'Demo Dentist',clinic_name:'Demo Clinic',created_at:stamp,updated_at:stamp};
const conversation={id:'m1',patient_id:'p1',dentist_id:'d1',is_active:true,patient_name:'Demo Patient',dentist_name:'Demo Dentist',unread_count:0,created_at:stamp,updated_at:stamp};
const result={screening_id:'s1',patient_id:'p1',patient_name:'Demo Patient',screening_status:'completed',screening_created_at:stamp,images:[],total_images:0,primary_prediction:{predicted_class:'Healthy',confidence:.93,probabilities:[{class_code:'healthy',class_name:'Healthy',probability:.93}]},yolo_detections:[],xai_results:[],dentist_assessments:[]};
let checked=0;
async function checkButtons(page, location) {
  const clipped = await page.evaluate(() => [...document.querySelectorAll('[role="button"]')]
    .filter((button) => button.clientWidth > 0 && button.clientHeight > 0
      && (button.scrollWidth > button.clientWidth + 2 || button.scrollHeight > button.clientHeight + 2))
    .map((button) => button.getAttribute('aria-label') || button.textContent));
  assert.deepEqual(clipped, [], `Clipped buttons at ${location}`);
}
try {
  // Render the source vector to native-size PNG; no edits to user-provided images.
  const iconPage=await browser.newPage();await iconPage.setViewport({width:1024,height:1024});
  await iconPage.setContent(`<style>body{margin:0}</style>${await fs.readFile(path.join(root,'assets/app-icon.svg'),'utf8')}`);
  await iconPage.screenshot({path:path.join(root,'assets/app-icon.png')});await iconPage.close();
  await fs.mkdir(path.join(root,'.expo/verification'),{recursive:true});
  for (const role of ['patient','dentist']) {
    const context=await browser.createBrowserContext();const page=await context.newPage();const errors=[];const requests=[];page.on('pageerror',(e) => errors.push(e.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Unexpected text node')) errors.push(message.text());
    });
    const profile={id:role==='patient'?'patient-user':'doctor-user',firebase_uid:`demo-${role}`,email:`${role}@example.test`,role,first_name:'Demo',last_name:role==='patient'?'Patient':'Dentist',is_active:true,is_email_verified:true,created_at:stamp,updated_at:stamp};
    const token=`${Buffer.from(JSON.stringify({alg:'none'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:profile.firebase_uid,user_id:profile.firebase_uid,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'password'}})).toString('base64url')}.demo`;
    let session={id:'c1',appointment_id:'a1',patient_id:'p1',dentist_id:'d1',consultation_type:'video',session_status:'scheduled',patient_name:'Demo Patient',dentist_name:'Demo Dentist',scheduled_start:appointment.scheduled_start,created_at:stamp,updated_at:stamp};const messages=[];
    let createCount=0;let uploadCount=0;let workflowPolls=0;let cancelCount=0;let workflowState;
    await page.setRequestInterception(true);
    page.on('request',async (request) => {
      if (request.method()==='OPTIONS') { await request.respond({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':request.headers()['access-control-request-headers'] || 'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS'}}); return; }
      const url=new URL(request.url());let body;let status=200;
      if (url.origin!==origin) requests.push(`${request.method()} ${url.origin}${url.pathname}`);
      if (url.hostname==='identitytoolkit.googleapis.com') body=url.pathname.includes('lookup') ? {users:[{localId:profile.firebase_uid,email:profile.email,emailVerified:true,displayName:'Demo Account'}]} : {kind:'identitytoolkit#VerifyPasswordResponse',localId:profile.firebase_uid,email:profile.email,idToken:token,refreshToken:'synthetic-refresh',expiresIn:'3600',registered:true};
      else if(url.hostname==='securetoken.googleapis.com') body={access_token:token,id_token:token,refresh_token:'synthetic-refresh',expires_in:'3600',user_id:profile.firebase_uid};
      else if(url.pathname.startsWith('/api/')) {
        assert.equal(request.headers().authorization,`Bearer ${token}`);
        const p=url.pathname;
        if(p==='/api/users/me') body=profile;
        else if(p==='/api/appointments') body={items:[appointment],total:1};
        else if(p==='/api/appointments/a1') body=appointment;
        else if(p==='/api/consultations') body={items:[session],total:1};
        else if(p==='/api/consultations/c1') body=session;
        else if(p==='/api/consultations/c1/stream-token') {status=503;body={detail:'Synthetic call service unavailable. Please retry.'};}
        else if(p==='/api/consultations/c1/start') {session={...session,session_status:'active',started_at:new Date().toISOString()};body=session;}
        else if(p==='/api/consultations/c1/end') {session={...session,session_status:'ended',duration_seconds:30,clinical_summary:JSON.parse(request.postData()).clinical_summary};body=session;}
        else if(p==='/api/dentists/me') body=doctor;
        else if(p==='/api/dentists/me/availability' || p==='/api/dentists/d1/availability') {if(doctor.verification_status!=='approved') {status=403;body={detail:'Verification required for scheduling.'};}else body={items:[],total:0};}
        else if(p==='/api/dentists') body=[doctor];
        else if(p==='/api/screenings') {if(request.method()==='POST') {createCount++;body={...screening,id:'s2',status:'created'};}else body={items:[screening],total:1,page:1,page_size:50};}
        else if(p==='/api/screenings/s2/workflow/cancel') {cancelCount++;workflowState={...workflowState,status:'cancelled',description:'Screening cancelled. Saved results remain available.'};body=workflowState;}
        else if(p==='/api/screenings/s2/workflow') {
          if(request.method()==='POST') {uploadCount++;workflowPolls=0;workflowState={status:'running',completed_steps:1,description:'Image saved. Analysing your photo.',warnings:[]};}
          else if(workflowState.status==='running') {workflowPolls++;workflowState={status:workflowPolls===1?'running':'completed',completed_steps:workflowPolls===1?2:3,description:workflowPolls===1?'Analysis ready. Generating visual explanation.':'Screening finished.',warnings:workflowPolls===1?[]:['Visual explanation is unavailable. Other saved results are available.']};}
          body=workflowState;
        }
        else if(p==='/api/screenings/s2/report') {status=404;body={detail:'Report is not ready yet.'};}
        else if(p==='/api/screenings/s2/review') body={...result,screening_id:'s2',primary_prediction:workflowPolls>0?result.primary_prediction:null};
        else if(p==='/api/screenings/s1/review') body=result;
        else if(p==='/api/dentists/me/patient-cases') body={items:[{screening_id:'s1',patient_name:'Demo Patient',screening_date:stamp,review_status:'pending_review',ai_class:'Healthy'}],total:1};
        else if(p==='/api/conversations') body={items:[conversation],total:1};
        else if(p==='/api/conversations/m1') body=conversation;
        else if(p==='/api/conversations/m1/read') body={marked_read_count:0};
        else if(p==='/api/conversations/m1/messages') {if(request.method()==='POST') {const m={id:'msg1',sender_id:profile.id,sender_name:'Demo Account',content:JSON.parse(request.postData()).content,created_at:stamp};messages.push(m);body=m;}else body={items:messages,total:messages.length,offset:0,limit:100};}
        else if(p==='/api/notifications') body={items:[],total:0,unread_count:0,limit:50,offset:0};
        else {status=404;body={detail:`Unmocked endpoint: ${p}`};}
      }
      if(body!==undefined) await request.respond({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
      else if(url.origin===origin || url.protocol==='data:' || url.protocol==='blob:') await request.continue();
      else await request.abort();
    });
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await page.goto(origin,{waitUntil:'networkidle0'});
    await page.waitForSelector('[aria-label="Email address"]',{timeout:30000});
    await page.type('[aria-label="Email address"]',profile.email);await page.type('[aria-label="Password"]','DemoPassword8!');
    await page.click('[aria-label="Sign in to your account"]');
    try { await page.waitForFunction(() => document.body.innerText.includes('Coming up'),{timeout:15000}); }
    catch(e) {console.log('Login diagnostic:',await page.evaluate(() => ({text:document.body.innerText,fetch:fetch.toString().slice(0,100),secure:window.isSecureContext})),errors,requests);console.log('Fetch probe:',await page.evaluate(async () => {try {return await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup',{method:'POST',body:'{}'})).json();}catch(e){return e.message;}}));await page.screenshot({path:path.join(root,'.expo/verification/login-diagnostic.png'),fullPage:true});throw e;}
    await new Promise((resolve) => setTimeout(resolve,600));
    await page.screenshot({path:path.join(root,`.expo/verification/${role}-home.png`),fullPage:true});
    for(const route of ['/(tabs)/screenings','/(tabs)/consultations','/(tabs)/messages','/(tabs)/account','/appointments','/screening/s1','/conversation/m1','/notifications',...(role==='patient'?['/dentists','/dentist/d1','/screening/new']:[])]) {
      // Group segments aren't present in public URLs.
      const pathname=route.replace('/(tabs)','');await page.goto(`${origin}${pathname}`,{waitUntil:'networkidle0'});
      await page.waitForFunction(() => !document.body.innerText.includes('Loading your care space'),{timeout:15000});
      assert.ok(!await page.evaluate(() => document.body.innerText.includes('Unmocked endpoint')));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),`${role} overflow at ${pathname}`);checked++;
      await checkButtons(page, `${role} ${pathname}`);
    }
    await page.goto(`${origin}/consultation/c1`,{waitUntil:'networkidle0'});
    await page.waitForSelector('[aria-label="Open messages"]');
    await page.waitForSelector('[aria-label="Join video call"]');
    await page.click('[aria-label="Join video call"]');
    await page.waitForFunction(() => document.body.innerText.includes('Synthetic call service unavailable. Please retry.'));
    await page.waitForFunction(() => document.querySelector('[aria-label="Join video call"]').getAttribute('aria-disabled') !== 'true');
    if(role==='dentist') {
      await page.waitForSelector('[aria-label="Start consultation"]');await page.click('[aria-label="Start consultation"]');
      await page.waitForSelector('[aria-label="Clinical summary"]');await page.type('[aria-label="Clinical summary"]','Synthetic follow-up summary.');
      await page.click('[aria-label="Conclude consultation"]');await page.waitForSelector('[aria-label="Save and conclude"]');await page.click('[aria-label="Save and conclude"]');
      await page.waitForFunction(() => document.body.innerText.includes('Synthetic follow-up summary.'));
      assert.equal(session.session_status,'ended');assert.equal(session.clinical_summary,'Synthetic follow-up summary.');
    } else assert.equal(await page.$('[aria-label="Start consultation"]'),null);
    await new Promise((resolve) => setTimeout(resolve,600));
    await page.screenshot({path:path.join(root,`.expo/verification/${role}-consultation.png`),fullPage:true});
    await page.goto(`${origin}/conversation/m1`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Message"]');await page.type('[aria-label="Message"]','Hello from the mobile app.');await page.click('[aria-label="Send message"]');await page.waitForFunction(() => document.body.innerText.includes('Hello from the mobile app.'));
    if(role==='patient') {
      await page.goto(`${origin}/screening/new`,{waitUntil:'networkidle0'});
      const selected=page.waitForFileChooser();await page.click('[aria-label="Choose from photos"]');await (await selected).accept([path.join(root,'assets/app-icon.png')]);
      await page.waitForSelector('[aria-label="Selected oral image"]');await page.click('[aria-label="Upload & analyse"]');
      await page.waitForFunction(() => document.body.innerText.includes('1/3 steps done'));
      await page.waitForFunction(() => document.body.innerText.includes('2/3 steps done'));
      await page.waitForFunction(() => document.body.innerText.includes('AVAILABLE SCREENING FINDINGS'));
      await page.screenshot({path:path.join(root,'.expo/verification/screening-progress.png'),fullPage:true});
      await page.waitForFunction(() => document.body.innerText.includes('3/3 steps done'));
      await page.waitForFunction(() => !!document.querySelector('[aria-label="Start a new screening"]'));
      assert.equal(createCount,1);assert.equal(uploadCount,1);
      assert.ok(await page.evaluate(() => document.body.innerText.includes('Other saved results are available')));
      await checkButtons(page,'screening progress');
      await page.click('[aria-label="Start a new screening"]');
      await page.waitForFunction(() => document.body.innerText.includes('1/3 steps done'));
      await page.click('[aria-label="Cancel screening"]');
      await page.waitForFunction(() => document.body.innerText.includes('Screening cancelled.'));
      assert.equal(cancelCount,1);assert.equal(workflowState.status,'cancelled');
      assert.equal(createCount,2);assert.equal(uploadCount,2);
    }
    for(const width of [320,768]) {await page.setViewport({width,height:900});assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));await checkButtons(page, `${role} width ${width}`);}
    if(role==='dentist') {
      doctor.verification_status='pending';
      await page.goto(`${origin}/account`,{waitUntil:'networkidle0'});
      await page.waitForSelector('[aria-label="Submit for verification"]');
      assert.equal(await page.$('[aria-label="Add availability window"]'),null);
      doctor.verification_status='approved';checked++;
    }
    assert.deepEqual(errors,[],`${role} JavaScript errors`);await context.close();
    console.log(`${role}: shared login, navigation, consultation controls, messaging, responsive layout passed`);
  }
  console.log(`${checked} route checks passed. Synthetic data only.`);
} finally {await browser.close();await new Promise((resolve) => server.close(resolve));}
