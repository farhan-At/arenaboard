import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoard, probability, score} from '../src/rules.js';
const entries = [1500,1400,1700,1500].map((rating,i)=>({name:'Player '+i,rating}));
const board = () => createBoard(' League ',entries);
test('Trim title and order seeds with registration tie break',()=>{
  const b = board();
  assert.equal(b.name,'League');
  assert.deepEqual(b.seeds,[3,1,4,2]);
  assert.deepEqual(b.matches.map(m=>[m.a,m.b]),[[3,2],[1,4],[null,null]]);
});
for (const [label,title,players] of [
  ['blank title',' ',entries],['partial roster','T',entries.slice(1)],['blank alias','T',[{name:' ',rating:1200},...entries.slice(1)]],
  ['duplicate alias','T',[{...entries[1],name:' PLAYER 1 '},...entries.slice(1)]],['invalid rating','T',[{name:'X',rating:3001},...entries.slice(1)]]
]) test('Reject '+label,()=>assert.throws(()=>createBoard(title,players)));
test('Equal ratings and 400-point difference give expected probabilities',()=>{
  assert.equal(probability(1500,1500),0.5);
  assert.ok(Math.abs(probability(1600,1200)-10/11)<1e-12);
});
for (const [label,left,right] of [['tie',1,1],['negative',-1,0],['fraction',1.5,1],['too high',1000,0],['string','2',1]]) {
  test('Reject '+label+' without changing state',()=>{
    const b = board(), original = structuredClone(b);
    assert.throws(()=>score(b,'S1',left,right)); assert.deepEqual(b,original);
  });
}
test('Reject final before qualifiers and unknown match',()=>{
  assert.throws(()=>score(board(),'F',1,0),{status:409});
  assert.throws(()=>score(board(),'X',1,0),{status:404});
});
test('Semifinal upset advances winner, conserves rating and locks result',()=>{
  const b=board(),sum=b.players.reduce((s,p)=>s+p.rating,0);
  score(b,'S1',0,2);
  assert.equal(b.matches[2].a,2); assert.equal(b.players[1].wins,1);
  assert.equal(b.players.reduce((s,p)=>s+p.rating,0),sum);
  assert.throws(()=>score(b,'S1',2,0),{status:409});
});
test('Both finalists qualify regardless of semifinal entry order',()=>{
  const b=board();
  score(b,'S2',1,0); score(b,'S1',1,0); score(b,'F',0,2);
  assert.equal(b.matches[2].result.winner,1); assert.equal(b.players[0].wins,2);
  assert.equal(b.revision,3);
});
