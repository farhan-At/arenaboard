import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {arenaServer} from '../src/server.js';
import {fileStore} from '../src/store.js';
const directory=mkdtempSync(join(tmpdir(),'arena-demo-'));
const server=arenaServer(fileStore(directory));
server.listen(0,'127.0.0.1'); await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
try {
  const players=[['Kestrel',1700],['Rook',1580],['Finch',1510],['Swift',1420]].map(([name,rating])=>({name,rating}));
  async function post(path,input,key=''){
    const res=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json','x-organiser-key':key},body:JSON.stringify(input)});
    if(!res.ok) throw new Error('Unexpected response '+res.status);
    return res.json();
  }
  const {id,key}=await post('/api/boards',{name:'Campus Open',players});
  const path='/api/boards/'+id;
  let revision=0;
  const scores=[];
  for(const [match,left,right] of [['S1',3,1],['S2',1,2],['F',2,1]]){
    const b=await post(path+'/matches/'+match,{revision,left,right},key);
    revision=b.revision;
    const m=b.matches.find(m=>m.id===match);
    scores.push({match,left,right,revision,winner:b.players.find(p=>p.id===m.result.winner).name,leftChance:m.result.chance});
  }
  const latency=[];
  for(let i=0;i<100;i++){
    const start=performance.now();
    const res=await fetch(base+path);
    if(!res.ok) throw new Error('Read failed');
    await res.json(); latency.push(performance.now()-start);
  }
  latency.sort((a,b)=>a-b);
  console.log(JSON.stringify({scores,localReadSample:{n:100,medianMs:latency[49],p95Ms:latency[94]},metrics:await (await fetch(base+'/metrics')).json()},null,2));
} finally {
  await new Promise(r=>server.close(r)); rmSync(directory,{recursive:true});
}
