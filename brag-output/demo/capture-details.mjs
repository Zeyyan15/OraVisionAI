import puppeteer from 'file:///D:/npm-cache/_npx/702923228c2ce1e6/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
const out=path.resolve('brag-output/composition/assets');
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
const page=await browser.newPage();
await page.setViewport({width:1440,height:1040,deviceScaleFactor:2});
await page.goto('http://127.0.0.1:5173/patient/screenings/550e8400-e29b-41d4-a716-446655440000',{waitUntil:'networkidle0'});
await page.evaluate(()=>document.fonts.ready);
for(const [name,heading] of [['localization-card','Spatial Lesion Localization'],['xai-card','Explainable AI (XAI) Feature Attribution'],['probability-card','Differential Class Distribution'],['risk-card','Clinical Context & Urgency Tier'],['prediction-card','Mucocele']]){
 const h=await page.evaluateHandle(heading=>{const h=[...document.querySelectorAll('h1,h2,h3,h4')].find(e=>e.textContent.trim()===heading);let p=h?.parentElement;while(p&&!(/rounded/.test(p.className)&&/border/.test(p.className)))p=p.parentElement;return p;},heading);
 await page.evaluate(()=>window.scrollTo(0,0));
 const box=await h.asElement().boundingBox();
 await page.screenshot({path:path.join(out,name+'.png'),clip:box,captureBeyondViewport:true});console.log('Captured',name);
}
await fetch('http://127.0.0.1:8000/api/screenings/550e8400-e29b-41d4-a716-446655440000/assessment',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_finalized:false})});
await page.goto('http://127.0.0.1:5173/dentist/screenings/550e8400-e29b-41d4-a716-446655440000/review',{waitUntil:'networkidle0'});
for(const [name,heading] of [['dentist-assessment','Professional Clinical Assessment'],['dentist-image','Oral Cavity Visual Inspection'],['report-card','Clinical Report (PDF)']]){
 if(name==='report-card'){
  await fetch('http://127.0.0.1:8000/api/screenings/550e8400-e29b-41d4-a716-446655440000/assessment',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_finalized:true})});
  await page.locator('::-p-text(Generate Clinical Report (PDF))').click();
  await page.waitForFunction(()=>document.body.innerText.includes('Report Available'));
 }
 const h=await page.evaluateHandle(heading=>{const h=[...document.querySelectorAll('h1,h2,h3,h4')].find(e=>e.textContent.trim()===heading);let p=h?.parentElement;while(p&&!(/rounded/.test(p.className)&&/border/.test(p.className)))p=p.parentElement;return p;},heading);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:path.join(out,name+'.png'),clip:await h.asElement().boundingBox(),captureBeyondViewport:true});console.log('Captured',name);
}
await fetch('http://127.0.0.1:8000/api/screenings/550e8400-e29b-41d4-a716-446655440000/assessment',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_finalized:true})});
}finally{await browser.close();}
