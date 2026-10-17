import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../mobile/package.json',import.meta.url));
const browser=await require('puppeteer-core').launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,pipe:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,768,390]) {
  await page.setViewport({width,height:1000});await page.goto('http://localhost:5173/register',{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>document.fonts.check('700 16px "Plus Jakarta Sans"')));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width}`);
 }
 const selected=await page.$('.auth-role-option.is-selected');assert.equal(await selected.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(18, 181, 166)');
 await page.click('.auth-role-option:not(.is-selected)');assert.equal(await page.$$eval('.auth-role-option.is-selected',els=>els.length),1);
 const input=await page.$('input[type="email"]');await input.focus();await new Promise(r=>setTimeout(r,250));assert.equal(await input.evaluate(el=>getComputedStyle(el).borderColor),'rgb(18, 181, 166)');
 const button=await page.$('button[type="submit"]');await page.mouse.move(0,0);await new Promise(r=>setTimeout(r,250));const before=await button.evaluate(el=>getComputedStyle(el).backgroundColor);await button.hover();await new Promise(r=>setTimeout(r,250));const after=await button.evaluate(el=>getComputedStyle(el).backgroundColor);assert.notEqual(before,after);
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);assert.equal(await button.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 assert.deepEqual(errors,[]);await page.screenshot({path:'scratch/screenshots/theme-register-mobile.png',fullPage:true});
 console.log('PASS: local font, responsive forms, turquoise role selection, field focus, animated button hover, reduced motion.');
} finally {await browser.close();}
