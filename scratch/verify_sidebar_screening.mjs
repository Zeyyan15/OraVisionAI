import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');

const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,pipe:true,args:['--no-sandbox']});
try {
  const page = await browser.newPage();
  await page.setViewport({width:1280,height:720});
  await page.setRequestInterception(true);
  let inferenceCalls = 0;
  page.on('request', async req => {
    const url = new URL(req.url());
    if (url.pathname === '/src/context/AuthContext.tsx') return req.respond({contentType:'application/javascript',body:`import React from '/node_modules/.vite/deps/react.js'; export const AuthContext = React.createContext(undefined); export function AuthProvider({children}) { return React.createElement(AuthContext.Provider,{value:{firebaseUser:{uid:'test'},userProfile:{id:'test',role:'patient',is_active:true,is_email_verified:true,first_name:'Test',last_name:'Patient',email:'test@example.test'},loading:false,error:null,logout:async()=>{}}},children); }`});
    if (url.port === '8000') {
      const cors = {'Access-Control-Allow-Origin':'http://localhost:5173','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'};
      if (req.method() === 'OPTIONS') return req.respond({status:204,headers:cors});
      let data = {items:[],total:0,unread_count:0,page:1,page_size:20};
      let status = 200;
      if (url.pathname.endsWith('/run-ai')) { inferenceCalls++; status=503; data={detail:'Image storage is unreachable. Analysis cannot retrieve your photograph.'}; }
      else if (url.pathname.endsWith('/images')) data={id:'image',screening_id:'test-screening'};
      else if (url.pathname === '/api/screenings' && req.method() === 'POST') data={id:'test-screening',status:'pending'};
      else if (url.pathname.endsWith('/review')) data={screening_id:'test-screening',screening_status:'failed',screening_created_at:'2026-10-11T10:00:00Z',images:[],total_images:0,primary_prediction:null,yolo_detections:[],xai_results:[],dentist_assessments:[]};
      return req.respond({status,headers:cors,contentType:'application/json',body:JSON.stringify(data)});
    }
    return req.continue();
  });
  await page.goto('http://localhost:5173/patient/screenings/new',{waitUntil:'networkidle0'});
  await page.waitForSelector('aside a[aria-current="page"]');
  assert.deepEqual(await page.$$eval('aside a[aria-current="page"]',els=>els.map(e=>e.textContent)),['New Screening']);
  const top = await page.$eval('aside',e=>e.getBoundingClientRect().top);
  assert.equal(top,64);
  await page.evaluate(()=> { document.querySelector('main').style.minHeight='1800px'; window.scrollTo(0,500); });
  assert.equal(await page.$eval('aside',e=>e.getBoundingClientRect().top),top);
  await page.evaluate(()=>window.scrollTo(0,0));
  async function clickText(text) { const button=await page.waitForSelector(`::-p-text(${text})`); await button.click(); }
  await clickText('Proceed to Image Selection');
  const input = await page.waitForSelector('input[type=file]');
  await input.uploadFile('D:/ISSM/OravisionAI/image.png');
  await clickText('Upload & Run AI Analysis');
  await page.waitForSelector('::-p-text(Analysis could not finish)');
  assert.equal(await page.$('svg.animate-spin'),null);
  assert.ok((await page.$eval('body',e=>e.textContent)).includes('Image storage is unreachable'));
  await clickText('Retry Analysis');
  await page.waitForFunction(()=>document.body.textContent.includes('Analysis could not finish'));
  assert.equal(inferenceCalls,2);
  await page.goto('http://localhost:5173/patient/screenings/test-screening',{waitUntil:'networkidle0'});
  assert.deepEqual(await page.$$eval('aside a[aria-current="page"]',els=>els.map(e=>e.textContent)),['My Screenings']);
  console.log('PASS: single active link, stable sidebar, failure message, stopped spinner, retry without re-upload, detail navigation.');
} finally { await browser.close(); }
