import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const base='http://127.0.0.1:3000';
for(let attempt=0;;attempt++){
  try { if ((await fetch(base+'/health')).ok) break; } catch {}
  if(attempt>=29) throw new Error('Container did not become ready.');
  await delay(1000);
}
const players=Array.from({length:4},(_,i)=>({name:'Demo '+i,rating:1500+i}));
const create=await fetch(base+'/api/boards',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'CI Cup',players})});
assert.equal(create.status,201);
const {id,key}=await create.json();
const result=await fetch(base+'/api/boards/'+id+'/matches/S1',{method:'POST',headers:{'content-type':'application/json','x-organiser-key':key},body:JSON.stringify({revision:0,left:2,right:0})});
assert.equal(result.status,200);
assert.equal((await (await fetch(base+'/api/boards/'+id)).json()).revision,1);
console.log('Container smoke test passed: create, score, read back.');
