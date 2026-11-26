import {probability} from '../src/rules.js';
let state=62;
function random(){state=(Math.imul(1664525,state)+1013904223)>>>0; return state/4294967296;}
const bands = [{name:'Under 100',end:100},{name:'100 to 299',end:300},{name:'300 or more',end:Infinity}].map(b=>({...b,total:0,correct:0}));
let correct=0,firstWins=0,brier=0;
for(let i=0;i<10000;i++){
  const skillA=1200+random()*800, skillB=1200+random()*800;
  const ratingA=Math.round(skillA+(random()-.5)*200), ratingB=Math.round(skillB+(random()-.5)*200);
  const actual=Number(random()<probability(skillA,skillB));
  const estimated=probability(ratingA,ratingB);
  const hit=Number(Number(estimated>=.5)===actual);
  const band=bands.find(b=>Math.abs(ratingA-ratingB)<b.end);
  band.total++; band.correct+=hit;
  correct+=hit; firstWins+=actual; brier+=(estimated-actual)**2;
}
console.log(JSON.stringify({seed:62,trials:10000,correct,accuracy:correct/10000,firstPlayerBaseline:firstWins/10000,brier:brier/10000,
  bands:bands.map(({name,total,correct})=>({name,total,correct,accuracy:correct/total}))},null,2));
