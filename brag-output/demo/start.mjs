import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';
import react from '../../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../frontend');
process.chdir(root);
const server=await createServer({root,configFile:false,envFile:false,
 define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('http://127.0.0.1:8000')},
 plugins:[{name:'local-synthetic-video-fixture',enforce:'pre',load(id){
  const file=id.replaceAll('\\','/');
  if(file.endsWith('/src/context/AuthContext.tsx')) return fs.readFileSync(path.join(dir,'AuthContext.tsx'),'utf8');
  if(file.endsWith('/src/config/firebase.ts')) return 'export const auth={currentUser:null};';
 }},react()],server:{host:'127.0.0.1',port:5173,strictPort:true,fs:{allow:[path.resolve(root,'..')]} }});
await server.listen();
console.log('OraVisionAI source UI + isolated synthetic fixture: http://127.0.0.1:5173');
