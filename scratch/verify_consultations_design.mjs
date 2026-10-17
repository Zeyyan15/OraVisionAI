import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(new URL('../mobile/package.json',import.meta.url));
const puppeteer=require('puppeteer-core');
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,pipe:true,args:['--no-sandbox']});
const future=new Date(Date.now()+86400000).toISOString();
const fixtures=[
 {id:'live',dentist_name:'Dr. Ayesha Khan',clinic_name:'Ora Dental Care',consultation_type:'video',session_status:'active',scheduled_start:new Date().toISOString()},
 {id:'next',dentist_name:'Dr. Hassan Ali',clinic_name:'Smile Dental Studio',consultation_type:'audio',session_status:'scheduled',scheduled_start:future},
 {id:'past',dentist_name:'Dr. Ayesha Khan',clinic_name:'Ora Dental Care',consultation_type:'video',session_status:'ended',scheduled_start:'2026-10-04T10:00:00Z',duration_seconds:1250},
 {id:'closed',dentist_name:'Dr. Sara Ahmed',clinic_name:'Dental Wellness Centre',consultation_type:'chat',session_status:'failed',scheduled_start:'2026-10-03T10:00:00Z'},
].map(item=>({appointment_id:'a1',patient_id:'p1',dentist_id:'d1',created_at:'2026-10-01T10:00:00Z',updated_at:'2026-10-01T10:00:00Z',duration_seconds:0,stream_call_id:'test-call',...item}));
let mode='normal';
try {
 const page=await browser.newPage();await page.setCacheEnabled(false);await page.setRequestInterception(true);
 page.on('request',async req=>{
  const url=new URL(req.url());
  if(url.pathname==='/src/context/AuthContext.tsx') return req.respond({contentType:'application/javascript',body:`import React from '/node_modules/.vite/deps/react.js';export const AuthContext=React.createContext(undefined);export function AuthProvider({children}){return React.createElement(AuthContext.Provider,{value:{firebaseUser:{uid:'test'},userProfile:{id:'test',role:'patient',is_active:true,is_email_verified:true,first_name:'Test',last_name:'Patient',email:'test@example.test'},loading:false,error:null,logout:async()=>{}}},children);}`});
  if(url.port==='8000') {
   const headers={'Access-Control-Allow-Origin':'http://localhost:5173','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'};
   if(req.method()==='OPTIONS') return req.respond({status:204,headers});
   let status=200,data={items:[],total:0,unread_count:0};
   if(url.pathname==='/api/consultations') {
    if(mode==='error') {status=503;data={detail:'Test service unavailable'};}
    else data={items:mode==='empty'?[]:fixtures,total:mode==='empty'?0:4};
   } else if(url.pathname==='/api/consultations/past') data=fixtures[2];
   else if(url.pathname.includes('stream-token')) {status=503;data={detail:'Not connected in UI verification'};}
   return req.respond({status,headers,contentType:'application/json',body:JSON.stringify(data)});
  }
  return req.continue();
 });
 const origin='http://localhost:5173/patient/consultations';
 await page.setViewport({width:1600,height:1050});await page.goto(origin,{waitUntil:'networkidle0'});
 await page.waitForSelector('article');assert.equal(await page.$$eval('article',els=>els.length),4);
 assert.ok((await page.$eval('[aria-label="Featured consultation"]',e=>e.textContent)).includes('Dr. Ayesha Khan'));
 await fs.mkdir('scratch/screenshots',{recursive:true});await page.screenshot({path:'scratch/screenshots/consultations-desktop.png',fullPage:true});
 await page.locator('[aria-label="Filter by session status"] button::-p-text(Scheduled)').click();
 assert.equal(await page.$$eval('article',els=>els.length),1);
 assert.ok((await page.$eval('article',e=>e.textContent)).includes('Dr. Hassan Ali'));
 await page.locator('[aria-label="Filter by session status"] button::-p-text(All sessions)').click();
 await page.locator('input[type=search]').fill('Smile');assert.equal(await page.$$eval('article',els=>els.length),1);
 await page.locator('input[type=search]').fill('missing');await page.waitForSelector('::-p-text(No matching sessions)');
 await page.locator('::-p-text(Clear filters)').click();assert.equal(await page.$$eval('article',els=>els.length),4);
 await page.locator('[aria-label="Filter by session status"] button::-p-text(Completed)').click();
 await page.locator('article button').click();await page.waitForFunction(()=>location.pathname.endsWith('/past'));
 await page.goto(origin,{waitUntil:'networkidle0'});
 for(const width of [1280,768,390]) {
  await page.setViewport({width,height:900});
  if(width<768) await page.waitForFunction(()=>document.querySelector('aside[aria-label="Sidebar navigation"]').getBoundingClientRect().right<=1);
  const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);
  if(scroll>width+1) console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,10).map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right}))));
  assert.ok(scroll<=width+1,`Overflow at ${width}: ${scroll}`);
  if(width===390) await page.screenshot({path:'scratch/screenshots/consultations-mobile.png',fullPage:true});
 }
 mode='empty';await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('::-p-text(Your consultations will appear here)');
 await page.locator('[aria-label="Featured consultation"] button').click();await page.waitForFunction(()=>location.pathname==='/patient/dentists');
 mode='error';await page.goto(origin,{waitUntil:'networkidle0'});
 console.log('Error-state check:',await page.$eval('main',el=>el.textContent.slice(0,650)));
 await page.waitForSelector('::-p-text(Could not load your sessions)');
 mode='normal';await page.locator('::-p-text(Try Again)').click();await page.waitForSelector('article');
 assert.equal(await page.$$eval('article',els=>els.length),4);
 console.log('PASS: session filters, search/reset, status counts, summary navigation, empty and error states, retry, desktop/tablet/mobile layout.');
} finally {await browser.close();}
