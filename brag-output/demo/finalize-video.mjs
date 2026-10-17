// Delivery pass: keep the synthetic-demo branding persistent, bake the selected
// poster into frame zero, and copy the already mixed audio without re-encoding.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve('brag-output');
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.status!==0)throw Error(`${cmd} exited ${r.status}`);};
const rendered=path.join(root,'brag-render.mp4');
if(!fs.existsSync(rendered))fs.renameSync(path.join(root,'brag.mp4'),rendered);
run('ffmpeg',['-y','-v','error','-ss','2.0','-i',rendered,'-frames:v','1','-q:v','2',path.join(root,'brag.jpg')]);
run('ffmpeg',['-y','-v','error','-ss','10.5','-i',rendered,'-vf','crop=1920:130:0:0','-frames:v','1',path.join(root,'composition/assets/header-strip.png')]);
run('ffmpeg',['-y','-hide_banner','-loglevel','warning','-stats','-i',rendered,'-i',path.join(root,'composition/assets/header-strip.png'),'-i',path.join(root,'brag.jpg'),'-filter_complex',"[0:v][1:v]overlay=0:0:enable='lt(t,47.6)'[branded];[branded][2:v]overlay=0:0:enable='eq(n,0)'[v]",'-map','[v]','-map','0:a?','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart','-metadata','title=OraVisionAI | AI-Assisted Oral Health Screening','-metadata','comment=Actual application UI. Synthetic demo identities; user-provided oral image; repository-model inference. Preliminary screening and clinical decision support only.',path.join(root,'brag.mp4')]);
const probe=spawnSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',path.join(root,'brag.mp4')],{encoding:'utf8'});
if(probe.status!==0)throw Error(probe.stderr);
const p=JSON.parse(probe.stdout),v=p.streams.find(s=>s.codec_type==='video'),a=p.streams.find(s=>s.codec_type==='audio');
if(v.width!==1920||v.height!==1080||v.nb_frames!=='1800'||Math.abs(Number(p.format.duration)-60)>.1||!a)throw Error('Delivery verification failed');
fs.writeFileSync(path.join(root,'render-verification.json'),JSON.stringify(p,null,2));
console.log(`Verified final MP4: ${p.format.duration}s, ${v.width}x${v.height}, ${v.nb_frames} frames, ${a.codec_name} audio, ${(Number(p.format.size)/1048576).toFixed(1)} MB.`);
