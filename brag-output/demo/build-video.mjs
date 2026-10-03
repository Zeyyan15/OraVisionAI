// Builds the editable HyperFrames artifact from real UI captures and measured speech times.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('brag-output');
const img=(file,style='',cls='')=>`<img class="${cls}" src="assets/${file}.png" alt="OraVisionAI synthetic demo interface" data-layout-allow-overflow style="${style}">`;
const frame=(id,style,content)=>`<div id="${id}" class="screen" style="${style}"><div class="camera" data-layout-allow-overflow>${content}</div></div>`;
const title=(n,kicker,text)=>`<div class="heading"><p class="eyebrow">${n} / ${kicker}</p><h1>${text}</h1></div>`;
const note=(text,style='')=>`<p class="note" style="${style}">${text}</p>`;
const shot=(id,start,end,body)=>`<section id="${id}" class="clip shot" data-start="${start}" data-duration="${(end-start).toFixed(3)}" data-track-index="0"><div class="scene">${body}</div></section>`;
const shots=[];
shots.push(shot('intro',0,6.15,`
 <div class="intro-rule"></div><p class="intro-kicker">AI-ASSISTED ORAL HEALTH SCREENING</p>
 ${img('logo','left:90px;top:234px;width:910px','hero-logo')}
 <h1 class="intro-title"><span>Preliminary screening.</span><span>Professional oversight.</span></h1>
 <div class="intro-path"><span>Patient</span><i></i><span>AI evidence</span><i></i><span>Dentist</span></div>
 ${frame('intro-ui','left:1120px;top:222px;width:790px;height:656px;',img('patient-results','width:1670px;left:-322px;top:-310px;'))}
 ${note('Actual OraVisionAI application','left:90px;top:863px;')}
`));
const patientTitle=title('01','PATIENT SCREENING','Start with an oral photograph.');
shots.push(shot('dashboard',6.15,7.2,`${patientTitle}${frame('dashboard-ui','left:90px;top:265px;width:1740px;height:660px;',img('patient-dashboard','width:1740px;top:-15px;'))}`));
shots.push(shot('notes',7.2,8.65,`${patientTitle}<div class="side-copy"><p class="big-copy">Add context.</p><p>Record symptoms and clinical notes for the screening case.</p></div>${frame('notes-ui','left:610px;top:265px;width:1220px;height:660px;',img('patient-notes','width:2200px;left:-688px;top:-133px;'))}<div class="small-tag" style="left:90px;top:811px;">Patient-provided notes</div>`));
shots.push(shot('upload',8.65,12.3,`${patientTitle}<div class="side-copy"><p class="big-copy">Select. Preview.</p><p>Submit the image for preliminary AI-assisted screening.</p></div>${frame('upload-ui','left:610px;top:265px;width:1220px;height:660px;',img('upload-preview','width:2200px;left:-688px;top:-300px;'))}<div class="small-tag" style="left:90px;top:811px;">Oral photograph selected</div>`));
const pipeline=`<div class="pipeline"><div class="model" id="classifier"><p class="eyebrow">IMAGE CLASSIFICATION</p><h2>EfficientNetB0</h2><p>Seven oral-condition categories</p><div class="line-marks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="parallel"><span>Independent model roles</span></div><div class="model" id="localizer"><p class="eyebrow">SPATIAL LOCALIZATION</p><h2>YOLO</h2><p>Bounding boxes around visible findings</p></div></div>`;
shots.push(shot('analysis',12.3,17.2,`${title('02','AI ANALYSIS','One image. Complementary evidence.')}${frame('loading-ui','left:90px;top:280px;width:980px;height:570px;',img('analysis-loading','width:1850px;left:-578px;top:-245px;')+'<div class="scan"></div>')}${pipeline}${note('Image-based analysis · Notes remain separate context','left:90px;top:883px;')}`));
shots.push(shot('localize',17.2,20.95,`${title('02','AI ANALYSIS','Classification + localization check.')}${frame('localize-ui','left:90px;top:265px;width:980px;height:625px;',img('localization-card','width:980px;top:-20px;'))}${pipeline.replace('id="classifier"','id="classifier-b"').replace('id="localizer"','id="localizer-b"')}${note('No bounding box detected for this demo image.','left:90px;top:913px;')}`));
shots.push(shot('scores',20.95,24.8,`${title('03','EXPLAINABLE RESULTS','Review the image. Understand the evidence.')}
 ${frame('prediction-ui','left:90px;top:277px;width:1010px;height:151px;',img('prediction-card','width:1010px;top:10px;'))}
 ${frame('evidence-ui','left:90px;top:452px;width:1010px;height:426px;',img('localization-card','width:910px;left:50px;top:-163px;'))}
 ${frame('probability-ui','left:1140px;top:225px;width:690px;height:690px;',img('probability-card','width:640px;left:25px;top:0;'))}
 ${note('Model confidence is not clinical accuracy.','left:90px;top:911px;')}`));
shots.push(shot('explain',24.8,28.3,`${title('03','EXPLAINABLE RESULTS','Visual explanation. Clinical prioritization.')}
 ${frame('xai-ui','left:90px;top:273px;width:870px;height:618px;',img('xai-card','width:860px;left:5px;top:-327px;'))}
 ${frame('risk-ui','left:1000px;top:273px;width:830px;height:618px;',img('risk-card','width:830px;top:0;'))}
 ${note('Feature attribution: regions influencing the model','left:90px;top:916px;')}
 ${note('Urgency tier ≠ disease probability','left:1000px;top:916px;')}`));
shots.push(shot('support',28.3,32.25,`${title('03','CLINICAL DECISION SUPPORT','Screening findings require clinical review.')}
 <div class="support-copy"><p class="big-copy">Preliminary information.</p><p class="big-copy teal">Professional interpretation.</p><p class="support-body">AI results support assessment and follow-up prioritization.</p></div>
 ${frame('support-ui','left:1040px;top:280px;width:790px;height:600px;',img('risk-card','width:790px;top:0;'))}
 <div class="notice">Not a confirmed diagnosis</div>`));
shots.push(shot('request',32.25,35.3,`${title('04','DENTIST REVIEW','Bring a professional into the case.')}
 <div class="side-copy"><p class="big-copy">Request review.</p><p>Select an approved dentist from the application.</p><div class="small-tag" style="position:relative;margin-top:48px;">AI + clinical expertise</div></div>
 ${frame('request-ui','left:850px;top:270px;width:815px;height:665px;',img('review-modal-focus','width:760px;left:27px;top:0;'))}`));
shots.push(shot('queue',35.3,36.65,`${title('04','DENTIST REVIEW','The case enters the clinical workspace.')}${frame('queue-ui','left:90px;top:270px;width:1740px;height:650px;',img('dentist-queue','width:1740px;'))}`));
shots.push(shot('assessment',36.65,43.5,`${title('04','DENTIST REVIEW','AI evidence. A separate clinical assessment.')}
 ${frame('dentist-image-ui','left:90px;top:281px;width:845px;height:594px;',img('dentist-image','width:845px;top:0;'))}
 ${frame('assessment-ui','left:975px;top:281px;width:855px;height:594px;',img('dentist-assessment','width:855px;top:0;'))}
 ${note('Original image and model evidence','left:90px;top:910px;')}${note('Dentist-authored observations and recommendations','left:975px;top:910px;')}`));
shots.push(shot('report',43.5,47.6,`${title('05','CLINICAL REPORT','Bring the reviewed findings together.')}
 <div class="report-copy"><h2>A consolidated<br class="title-break">clinical report.</h2><p>AI findings and the professional assessment, in one downloadable PDF.</p></div>
 ${frame('report-action-ui','left:90px;top:590px;width:960px;height:315px;',img('report-card','width:960px;top:-150px;'))}
 ${frame('pdf-ui','left:1120px;top:245px;width:650px;height:720px;',img('report-page-1','width:650px;'))}`));
shots.push(shot('closing',47.6,53,`
 <div class="closing-mark">${img('logo','width:870px;position:relative;')}</div>
 <h1 class="closing-title">AI-Assisted Oral Health Screening<span>&amp; Clinical Decision Support</span></h1>
 <div class="closing-rule"></div>
 <div class="credits"><p class="credit-project">Final Year Project · BSAI F23-B · Air University, Islamabad</p><h2>BS Artificial Intelligence Students</h2><p>Muhammad Mursaleen · 231213 &nbsp; | &nbsp; Muhammad Zeyyan Butt · 231221</p><p>Talha Iqbal · 231223</p></div>
 <p class="disclaimer">For preliminary screening and clinical decision support.<span>Not a definitive medical diagnosis.</span></p>`));
shots.push(shot('acknowledgment',53,60,`
 <div class="ack-mark">${img('logo','width:700px;position:relative;')}</div>
 <p class="ack-kicker">CLOSING ACKNOWLEDGMENT</p>
 <p class="ack-line">OraVisionAI will be provided to</p>
 <h2 class="ack-name">Dr. Tamsila</h2>
 <p class="ack-role">Dentist · Pakistan Dental Clinic and CMH</p>
 <p class="ack-period">for evaluation and use until December.</p>
 <p class="ack-disclaimer">For preliminary screening and clinical decision support.<span>Not a definitive medical diagnosis.</span></p>`));

const offset=.35;
const cues=[
 [0,3.26,'OraVisionAI supports preliminary oral-health screening,'],[3.26,5.55,'with professional clinical oversight.'],
 [5.82,7.98,'Patients begin by recording notes'],[7.98,9.66,'and uploading an oral photograph'],[9.66,11.65,'for AI-assisted image analysis.'],
 [11.96,14.5,'EfficientNetB0 classifies the image'],[14.5,16.5,'across seven oral conditions.'],[16.88,20.2,'Independently, YOLO localizes visible findings.'],
 [20.6,23.04,'Results bring together model confidence,'],[23.04,25.94,'class probabilities, explainable heatmaps,'],[25.94,27.7,'and clinical-risk prioritization.'],
 [28,29.68,'These are screening findings,'],[29.68,31.5,'not a confirmed diagnosis.'],
 [31.94,34.65,"Patients request an approved dentist’s review."],[35,37.3,'The dentist examines the original image'],[37.3,39.14,'and AI evidence,'],[39.14,41.44,'then records a separate professional assessment'],[41.44,42.8,'and recommendations.'],
 [43.18,46.5,'A consolidated report brings the findings together.'],[46.96,49.98,'OraVisionAI combines artificial intelligence'],[49.98,51.74,'with clinical oversight,'],[51.74,54.15,'supporting structured oral-health assessment.']
];
const esc=t=>t.replaceAll('&','&amp;').replaceAll('<','&lt;');
const captions=cues.map(([a,b,t],i)=>`<div id="caption-${i}" class="clip caption" data-start="${(a+offset).toFixed(2)}" data-duration="${(b-a).toFixed(2)}" data-track-index="2"><p>${esc(t)}</p></div>`).join('\n');
const time=t=>{const n=Math.round(t*1000);return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')},${String(n%1000).padStart(3,'0')}`;};
fs.writeFileSync(path.join(root,'captions.srt'),cues.map(([a,b,t],i)=>`${i+1}\n${time(a+offset)} --> ${time(b+offset)}\n${t}\n`).join('\n'));
const html=`<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1920,height=1080"><title>OraVisionAI — Product Explainer</title><script src="assets/gsap.min.js"></script>
<style>
@font-face{font-family:Inter;src:url('assets/Inter-Regular.ttf') format('truetype');font-weight:400;font-display:block}
@font-face{font-family:Inter;src:url('assets/Inter-Bold.ttf') format('truetype');font-weight:600 900;font-display:block}
*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:#f8fafc}#root{width:100%;height:100%;position:relative;overflow:hidden;font-family:Inter,sans-serif;color:#0f172a}
.backdrop{position:absolute;inset:0;background:#f8fafc}.wash{position:absolute;width:1100px;height:1100px;right:-450px;top:-520px;border-radius:50%;background:radial-gradient(circle,#bae6fd 0%,#e0f2fe 32%,transparent 68%);opacity:.7}.grid{position:absolute;inset:0;background-image:radial-gradient(#7dd3fc 1px,transparent 1px);background-size:32px 32px;opacity:.15}.base-line{position:absolute;left:90px;right:90px;top:126px;height:1px;background:#cbd5e1}
.clip{position:absolute;inset:0}.shot{z-index:2}.scene{position:absolute;inset:0;background:#f8fafc;background-image:radial-gradient(ellipse at 96% 0%,#e0f2fe,transparent 48%)}
.header{position:absolute;left:90px;top:38px;width:1740px;height:70px;display:flex;align-items:center;justify-content:space-between;z-index:30}.header img{position:relative;width:245px;height:auto}.demo{font-size:21px;font-weight:700;letter-spacing:1.1px;color:#075985;background:#e0f2fe;border:1px solid #bae6fd;border-radius:40px;padding:12px 22px}.header .project{position:absolute;left:300px;font-size:21px;color:#475569}.header .line{position:absolute;top:88px;width:100%;height:1px;background:#cbd5e1}
.heading{position:absolute;left:90px;top:151px;width:1740px}.eyebrow{font-size:21px;line-height:1.3;font-weight:700;letter-spacing:2.8px;color:#0369a1}.heading h1{font-size:52px;line-height:1.16;letter-spacing:-1.9px;font-weight:700;margin-top:14px}.screen{position:absolute;overflow:hidden;border:1px solid #cbd5e1;border-radius:22px;background:white;box-shadow:0 18px 46px rgba(8,47,73,.1)}.camera{position:absolute;inset:0;transform-origin:50% 50%}.screen img,img.hero-logo{position:absolute;height:auto;max-width:none}.note{position:absolute;font-size:22px;line-height:1.4;color:#475569}.small-tag{position:absolute;font-size:23px;color:#075985;line-height:1.45;max-width:440px}.side-copy{position:absolute;left:90px;top:393px;width:455px}.big-copy{font-size:44px;line-height:1.17;letter-spacing:-1.3px;font-weight:700}.side-copy>p+p{font-size:28px;line-height:1.55;color:#475569;margin-top:26px}.teal{color:#047857}
.intro-rule{position:absolute;left:90px;top:199px;width:82px;height:5px;background:#0d9488}.intro-kicker{position:absolute;left:200px;top:190px;font-size:22px;font-weight:700;letter-spacing:2px;color:#0369a1}.intro-title{position:absolute;left:90px;top:525px;font-size:62px;line-height:1.18;letter-spacing:-2.5px}.intro-title span{display:block}.intro-path{position:absolute;left:90px;top:747px;display:flex;gap:24px;align-items:center;font-size:25px;color:#075985}.intro-path i{height:2px;width:55px;background:#0d9488}
.pipeline{position:absolute;left:1130px;top:292px;width:700px}.model{background:#fff;border:1px solid #bae6fd;border-radius:22px;padding:36px 40px;box-shadow:0 14px 40px rgba(8,47,73,.055)}.model h2{font-size:47px;letter-spacing:-1.8px;margin-top:14px}.model>p:last-of-type{font-size:26px;line-height:1.4;margin-top:13px;color:#475569}.line-marks{display:flex;gap:10px;margin-top:28px}.line-marks i{width:58px;height:5px;background:#0d9488}.parallel{height:78px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:21px}.scan{position:absolute;left:0;top:0;width:100%;height:4px;background:#0d9488;box-shadow:0 0 30px #5eead4;opacity:.55}
.support-copy{position:absolute;left:90px;top:380px;width:880px}.support-copy .big-copy{font-size:53px;line-height:1.2;margin-bottom:18px}.support-body{font-size:31px;line-height:1.55;color:#475569;max-width:720px;margin-top:35px}.notice{position:absolute;left:90px;top:785px;padding:22px 30px;border-radius:14px;border:1px solid #bae6fd;background:#e0f2fe;color:#075985;font-size:29px;font-weight:700}
.report-copy{position:absolute;left:90px;top:308px;width:920px}.report-copy h2{font-size:59px;line-height:1.08;letter-spacing:-2px}.report-copy>p{font-size:29px;line-height:1.45;max-width:860px;margin-top:28px;color:#475569}
.closing-mark{position:absolute;left:0;right:0;top:160px;display:flex;justify-content:center}.closing-title{position:absolute;left:160px;right:160px;top:424px;text-align:center;font-size:42px;line-height:1.2;letter-spacing:-1.2px}.closing-title span{display:block}.closing-rule{position:absolute;left:846px;top:542px;width:228px;height:3px;background:#0d9488}.credits{position:absolute;left:0;right:0;top:577px;text-align:center;font-size:25px;line-height:1.5;color:#334155}.credits .credit-project{font-weight:600;color:#075985}.credits h2{font-size:38px;line-height:1.25;letter-spacing:-.8px;font-weight:700;color:#0f172a;margin:14px 0 10px}.disclaimer{position:absolute;left:160px;right:160px;top:852px;text-align:center;font-size:23px;line-height:1.4;color:#334155}.disclaimer span{display:block}
.ack-mark{position:absolute;left:0;right:0;top:170px;display:flex;justify-content:center}.ack-kicker{position:absolute;left:0;right:0;top:405px;text-align:center;font-size:23px;font-weight:700;letter-spacing:2.6px;color:#0369a1}.ack-line{position:absolute;left:120px;right:120px;top:463px;text-align:center;font-size:42px;line-height:1.2;color:#0f172a}.ack-name{position:absolute;left:120px;right:120px;top:526px;text-align:center;font-size:66px;line-height:1.15;letter-spacing:-1.5px;color:#075985}.ack-role{position:absolute;left:120px;right:120px;top:618px;text-align:center;font-size:34px;color:#334155}.ack-period{position:absolute;left:120px;right:120px;top:696px;text-align:center;font-size:38px;font-weight:600;color:#0f172a}.ack-disclaimer{position:absolute;left:160px;right:160px;top:857px;text-align:center;font-size:23px;line-height:1.4;color:#334155}.ack-disclaimer span{display:block}
.caption{z-index:60;inset:auto 90px 29px;height:72px;display:flex;align-items:center;justify-content:center}.caption p{display:block;padding:15px 30px;color:#fff;background:#0c2942;border-radius:12px;font-size:31px;line-height:1.25;text-align:center;box-shadow:0 3px 14px rgba(8,47,73,.12)}
.progress{position:absolute;bottom:0;left:0;width:1920px;height:5px;background:#0d9488;transform-origin:left center;z-index:80}
/* Adapted from the installed yt-feather-highlight primitive. */
.yt-hl{--yt-hl-x:70%;--yt-hl-y:46%;--yt-hl-rx:32%;--yt-hl-ry:48%;position:absolute;inset:0;pointer-events:none;opacity:0;background:rgba(8,47,73,.2);mask-image:radial-gradient(ellipse var(--yt-hl-rx) var(--yt-hl-ry) at var(--yt-hl-x) var(--yt-hl-y),transparent 0%,transparent 52%,black 88%)}
</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="60" data-width="1920" data-height="1080" data-fps="30">
<div class="backdrop"><div class="wash" data-layout-ignore></div><div class="grid"></div></div>
${shots.join('\n')}
<div class="clip header" data-start="0" data-duration="47.6" data-track-index="1"><img src="assets/logo.png" alt="OraVisionAI"><span class="project">AI-assisted screening &amp; clinical decision support</span><i class="line"></i></div>
${captions}
<div class="progress" data-layout-ignore></div>
<audio id="narration" src="assets/voiceover.wav" data-start="0.35" data-duration="54.3" data-track-index="3" data-volume="1"></audio>
<audio id="music" src="assets/music.mp3" data-start="0" data-duration="60" data-track-index="4" data-volume="0.13" data-automation="{&quot;version&quot;:1,&quot;lanes&quot;:[{&quot;target&quot;:&quot;volume&quot;,&quot;points&quot;:[{&quot;t&quot;:0,&quot;v&quot;:0},{&quot;t&quot;:1,&quot;v&quot;:0.1},{&quot;t&quot;:54.5,&quot;v&quot;:0.1},{&quot;t&quot;:55.5,&quot;v&quot;:0.2},{&quot;t&quot;:58,&quot;v&quot;:0.2},{&quot;t&quot;:60,&quot;v&quot;:0}]}]}"></audio>
</div><script>
const tl=gsap.timeline({paused:true});
document.querySelectorAll('.shot').forEach(shot=>{const start=Number(shot.dataset.start),duration=Number(shot.dataset.duration);if(start>0)tl.fromTo(shot.querySelector('.scene'),{opacity:0},{opacity:1,duration:.25,ease:'power1.out'},start);const screens=shot.querySelectorAll('.screen');screens.forEach((screen,i)=>{tl.fromTo(screen,{y:24,opacity:0},{y:0,opacity:1,duration:.55,ease:'power3.out'},start+.08+i*.08);});const heading=shot.querySelector('.heading');if(heading)tl.fromTo(heading,{y:12,opacity:0},{y:0,opacity:1,duration:.4,ease:'power2.out'},start);});
tl.fromTo('.hero-logo',{opacity:0,y:25},{opacity:1,y:0,duration:.8,ease:'power3.out'},.05);
tl.fromTo('.intro-title',{opacity:0,y:25},{opacity:1,y:0,duration:.7,ease:'power3.out'},.45);
tl.fromTo('.intro-path',{opacity:0,x:-20},{opacity:1,x:0,duration:.6,ease:'power2.out'},1.1);
tl.fromTo('#intro-ui .camera',{scale:1,x:0},{scale:1.08,x:-12,duration:5.8,ease:'sine.inOut'},.2);
tl.fromTo('#upload-ui .camera',{y:0},{y:-175,duration:2.8,ease:'power1.inOut'},8.9);
tl.fromTo('.scan',{y:30,opacity:0},{y:500,opacity:.6,duration:3.5,ease:'none'},12.6);
tl.fromTo('#classifier',{x:40,opacity:0},{x:0,opacity:1,duration:.6,ease:'power3.out'},12.6);
tl.fromTo('#localizer',{x:40,opacity:0},{x:0,opacity:1,duration:.6,ease:'power3.out'},13.1);
tl.fromTo('#localize-ui .camera',{scale:1,y:0},{scale:1.035,y:-16,duration:3.5,ease:'sine.inOut'},17.4);
tl.fromTo('#probability-ui .camera',{y:0},{y:-84,duration:2.8,ease:'power1.inOut'},21.9);
tl.fromTo('#evidence-ui .camera',{scale:1},{scale:1.03,duration:3.4,ease:'sine.inOut'},21.1);
tl.fromTo('#xai-ui .camera',{y:0},{y:-78,duration:3.1,ease:'sine.inOut'},25);
tl.fromTo('#risk-ui .camera',{y:0},{y:-62,duration:3.1,ease:'sine.inOut'},25);
tl.fromTo('#support-ui .camera',{y:0},{y:-58,duration:3.6,ease:'sine.inOut'},28.5);
tl.fromTo('#request-ui .camera',{y:10},{y:0,duration:2.6,ease:'sine.inOut'},32.6);
tl.fromTo('#dentist-image-ui .camera',{scale:1},{scale:1.035,duration:6.4,ease:'sine.inOut'},36.8);
tl.fromTo('#assessment-ui .camera',{y:0},{y:-720,duration:5.0,ease:'power1.inOut'},37.5);
tl.fromTo('#report-action-ui .camera',{y:0},{y:-45,duration:2.8,ease:'sine.inOut'},44.4);
tl.fromTo('#pdf-ui .camera',{y:0},{y:-122,duration:3.7,ease:'sine.inOut'},43.8);
tl.fromTo('.closing-mark',{y:28,opacity:0},{y:0,opacity:1,duration:.8,ease:'power3.out'},47.8);
tl.fromTo('.closing-title',{y:20,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},48.1);
tl.fromTo('.credits',{y:14,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},49.1);
tl.fromTo('.disclaimer',{opacity:0},{opacity:1,duration:.6},49.5);
tl.fromTo('.ack-mark',{y:20,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},53.15);
tl.fromTo('.ack-kicker',{y:12,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},53.35);
tl.fromTo('.ack-line',{y:12,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},53.55);
tl.fromTo('.ack-name',{y:12,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},53.75);
tl.fromTo('.ack-role',{y:12,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},54);
tl.fromTo('.ack-period',{y:12,opacity:0},{y:0,opacity:1,duration:.5,ease:'power2.out'},54.2);
tl.fromTo('.ack-disclaimer',{opacity:0},{opacity:1,duration:.5},54.4);
tl.fromTo('.progress',{scaleX:0},{scaleX:1,duration:60,ease:'none'},0);
window.__timelines=window.__timelines||{};window.__timelines.main=tl;
</script></body></html>`;
fs.writeFileSync(path.join(root,'composition/index.html'),html);
console.log('Built 60-second composition, 15 directed shots, 22 measured caption cues.');
