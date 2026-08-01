// v2: verify starvation + add rule a60 (tested-correct, test = whole capped segment up to 60)
const DPW=5, PACE=20, CAP=60, REST=21;
function simulate({ listSize, score, rule, days=400, TEST=30 }) {
  const state=new Int8Array(listSize); const returnAt=new Int32Array(listSize).fill(-1);
  let twi=0, studyDay=0; const samples={}; const lastSeen=new Int32Array(listSize).fill(-1);
  for (let day=0; day<days; day++) {
    for (let i=0;i<twi;i++) if (state[i]===2 && returnAt[i]<=day) state[i]=1;
    if (day%7>=5) continue;
    studyDay++;
    if (twi<listSize){const n=Math.min(PACE,listSize-twi);for(let i=twi;i<twi+n;i++)state[i]=1;twi+=n;}
    const pool=[];for(let i=0;i<twi;i++)if(state[i]===1)pool.push(i);
    const week=Math.ceil(studyDay/DPW), dow=((studyDay-1)%DPW)+1;
    let seg=null;
    if(!(week===1&&dow===1)&&pool.length){
      const divisor=week===1?DPW-1:DPW; const segSize=Math.ceil(pool.length/divisor);
      const pos=week===1?dow-2:dow-1;
      seg=pool.slice(pos*segSize,pos*segSize+segSize).slice(0,CAP);
    }
    if(seg&&seg.length){
      seg.forEach(i=>lastSeen[i]=studyDay);
      const testN=Math.min(TEST,seg.length);
      const sh=[...seg].sort(()=>Math.random()-0.5);
      const tested=sh.slice(0,testN);
      const nC=Math.round(testN*score);
      const correct=tested.slice(0,nC), failed=tested.slice(nC);
      let grads=[];
      if(rule==='a'||rule==='a60') grads=correct;
      else if(rule==='b') grads=tested;
      else { const fs=new Set(failed); const elig=seg.filter(i=>!fs.has(i));
        grads=[...elig].sort(()=>Math.random()-0.5).slice(0,Math.min(Math.floor(seg.length*score),elig.length)); }
      for(const i of grads){state[i]=2;returnAt[i]=day+REST;}
    }
    if(studyDay===80){
      const gaps=[]; for(let i=0;i<twi;i++) if(state[i]===1&&lastSeen[i]>0) gaps.push(studyDay-lastSeen[i]);
      gaps.sort((x,y)=>y-x);
      samples.d80={active:pool.length, gapMax:gaps[0]??0, gapP90:gaps[Math.floor(gaps.length*0.1)]??0, over20:gaps.filter(g=>g>20).length};
    }
    if([40,200].includes(studyDay)) samples['d'+studyDay]={active:pool.length};
  }
  return samples;
}
console.log('rule a60 = tested-correct graduate, TEST = whole capped segment (<=60)');
console.log('score | d40  d200 | gapMax gapP90 #words>20d  (at d80)');
for(const rule of ['a','a60']){
  console.log(`--- ${rule} ---`);
  for(const s of [0.5,0.6,0.7,0.8,0.9,0.95,1.0]){
    const TEST=rule==='a60'?60:30;
    const runs=[1,2,3].map(()=>simulate({listSize:600,score:s,rule,TEST}));
    const avg=(d,k)=>Math.round(runs.reduce((a,r)=>a+(r[d]?.[k]??0),0)/runs.length);
    console.log(`${String(Math.round(s*100)).padStart(4)}% | ${String(avg('d40','active')).padStart(4)} ${String(avg('d200','active')).padStart(4)} | ${String(avg('d80','gapMax')).padStart(5)} ${String(avg('d80','gapP90')).padStart(5)}  ${String(avg('d80','over20')).padStart(5)}`);
  }
}
// starvation check for rule b (pool 180 < 300 — is the 72d gap real aliasing or a bug?)
const rb=[1,2,3].map(()=>simulate({listSize:600,score:0.8,rule:'b'}));
const avgb=(k)=>Math.round(rb.reduce((a,r)=>a+(r.d80?.[k]??0),0)/3);
console.log(`\nrule b @80%: active=${avgb('active')} gapMax=${avgb('gapMax')} gapP90=${avgb('gapP90')} words>20d=${avgb('over20')}`);
