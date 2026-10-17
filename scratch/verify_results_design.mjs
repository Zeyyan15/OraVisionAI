import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(new URL('../mobile/package.json',import.meta.url));
const puppeteer=require('puppeteer-core');
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,pipe:true,args:['--no-sandbox']});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560"><rect width="800" height="560" fill="#cf9b96"/><path d="M0 120Q400 260 800 90V560H0Z" fill="#b47976"/><g fill="#f2e8d6" stroke="#decbb7" stroke-width="8"><rect x="80" y="180" width="140" height="230" rx="55"/><rect x="220" y="200" width="145" height="240" rx="50"/><rect x="365" y="210" width="145" height="245" rx="55"/><rect x="510" y="170" width="145" height="245" rx="50"/></g><text x="400" y="510" text-anchor="middle" font-size="20" fill="#fff" font-family="sans-serif">Synthetic layout test image</text></svg>';
const image='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
const codes=['MC','Gum','CaS','CoS','OC','OLP','OT'];
const names=['Mucocele','Gum Disease','Canker Sore','Cold Sore','Oral Cancer','Oral Lichen Planus','Oral Thrush'];
const fixture={screening_id:'test',patient_id:'p',patient_name:'Test Patient',screening_status:'completed',screening_created_at:'2026-10-11T10:00:00Z',total_images:1,images:[{id:'img',is_primary:true,storage_path:'photo',file_name:'oral.jpg',image_width:800,image_height:560}],primary_prediction:{id:'pred',predicted_class:'Mucocele',confidence:.999,inference_duration_ms:1670,probabilities:codes.map((c,i)=>({class_code:c,class_name:names[i],probability:i===0?.999:i===1?.001:0}))},yolo_detections:[],xai_results:[{id:'xai',method:'occlusion_sensitivity',is_primary_user_facing:true,target_layer:'block6a_expand_conv',heatmap_storage_path:'heat',overlay_image_storage_path:'overlay'}],dentist_assessments:[]};
let generated=0,requested=0,reports=0,downloads=0;
try {
 const page=await browser.newPage();
 await page.setRequestInterception(true);
 page.on('request',async req=>{
  const url=new URL(req.url());
  if(url.pathname==='/src/context/AuthContext.tsx') return req.respond({contentType:'application/javascript',body:`import React from '/node_modules/.vite/deps/react.js';export const AuthContext=React.createContext(undefined);export function AuthProvider({children}){return React.createElement(AuthContext.Provider,{value:{firebaseUser:{uid:'test'},userProfile:{id:'test',role:'patient',is_active:true,is_email_verified:true,first_name:'Test',last_name:'Patient',email:'test@example.test'},loading:false,error:null,logout:async()=>{}}},children);}`});
  if(url.port==='8000') {
   const headers={'Access-Control-Allow-Origin':'http://localhost:5173','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'};
   if(req.method()==='OPTIONS') return req.respond({status:204,headers});
   let data={items:[],total:0,unread_count:0};let status=200;
   if(url.pathname.endsWith('/review')) data=fixture;
   else if(url.pathname.endsWith('/artifacts/signed-url')) data={signed_url:image};
   else if(url.pathname.includes('/xai/')) { generated++; data={results:fixture.xai_results}; }
   else if(url.pathname==='/api/dentists') data=[{id:'d1',first_name:'Demo',last_name:'Dentist',clinic_name:'Test clinic'}];
   else if(url.pathname.endsWith('/request-review')) { requested++;data={success:true}; }
   else if(url.pathname.endsWith('/report')) {
    if(req.method()==='POST') {reports++;data={id:'r1',report_number:'TEST-001',created_at:'2026-10-11T10:00:00Z',report_title:'Test report'};}
    else {status=404;data={detail:'Not generated'};}
   }
   else if(url.pathname.endsWith('/download')) { downloads++;return req.respond({status:200,headers,contentType:'application/pdf',body:'%PDF-1.4\n%%EOF'}); }
   return req.respond({status,headers,contentType:'application/json',body:JSON.stringify(data)});
  }
  return req.continue();
 });
 await page.setViewport({width:1600,height:1050});
 await page.goto('http://localhost:5173/patient/screenings/test',{waitUntil:'networkidle0'});
 await page.waitForSelector('#explanations img');
 assert.equal(await page.$eval('body',e=>e.textContent.includes('Invalid Date')),false);
 const values=await page.$$eval('[role=meter]',els=>els.map(e=>e.getAttribute('aria-valuenow')));
 assert.deepEqual(values,['99.9','0.1','0','0','0','0','0']);
 await fs.mkdir('scratch/screenshots',{recursive:true});
 await page.screenshot({path:'scratch/screenshots/results-desktop.png',fullPage:true});
 await page.locator('::-p-text(Grad-CAM)').click();
 await page.waitForSelector('button[aria-pressed=true]');
 assert.equal(await page.$eval('button[aria-pressed=true]',e=>e.textContent),'Grad-CAM');
 await page.locator('::-p-text(Generate heatmap)').click();
 await page.waitForFunction(()=>document.querySelector('#explanations button[aria-pressed=true]')?.textContent==='Grad-CAM');
 await page.waitForNetworkIdle();
 assert.equal(generated,1);
 await page.locator('::-p-text(Request Clinical Review)').click();
 await page.waitForSelector('select');
 await page.locator('::-p-text(Send Request)').click();
 await page.waitForNetworkIdle();
 assert.equal(requested,1);
 await page.waitForSelector('[role=dialog]',{hidden:true});
 await page.locator('::-p-text(Generate PDF report)').click();
 await page.waitForNetworkIdle();
 assert.equal(reports,1);assert.equal(downloads,1);
 for(const width of [1280,768,390]) {
  await page.setViewport({width,height:900});
  await page.evaluate(()=>window.scrollTo(0,0));
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dimensions.scroll<=width+1,`Overflow at ${width}: ${dimensions.scroll}`);
  if(width===390) await page.screenshot({path:'scratch/screenshots/results-mobile.png',fullPage:true});
 }
 console.log('PASS: desktop/tablet/mobile layout, exact score values, missing dates, method selection, heatmap generation, dentist review request and PDF generation/download.');
} finally {await browser.close();}
