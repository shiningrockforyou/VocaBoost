// Tracer: rule b @80% — find the max-gap word at d80, then replay and log where it sat vs the served slice
const DPW=5,PACE=20,CAP=60,REST=21,TEST=30,LIST=600,SCORE=0.8;
function run(traceWord=-1){
  const state=new Int8Array(LIST); const returnAt=new Int32Array(LIST).fill(-1);
  let twi=0,studyDay=0; const lastSeen=new Int32Array(LIST).fill(-1); const log=[];
  let rng=42; const rand=()=> (rng=(rng*1103515245+12345)&0x7fffffff)/0x7fffffff; // deterministic
  for(let day=0;day<160;day++){
    for(let i=0;i<twi;i++) if(state[i]===2&&returnAt[i]<=day) state[i]=1;
    if(day%7>=5) continue;
    studyDay++;
    if(twi<LIST){const n=Math.min(PACE,LIST-twi);for(let i=twi;i<twi+n;i++)state[i]=1;twi+=n;}
    const pool=[];for(let i=0;i<twi;i++)if(state[i]===1)pool.push(i);
    const week=Math.ceil(studyDay/DPW),dow=((studyDay-1)%DPW)+1;
    let seg=null,start=0,segSize=0;
    if(!(week===1&&dow===1)&&pool.length){
      const divisor=week===1?DPW-1:DPW; segSize=Math.ceil(pool.length/divisor);
      const pos=week===1?dow-2:dow-1; start=pos*segSize;
      seg=pool.slice(start,start+segSize).slice(0,CAP);
    }
    if(traceWord>=0&&studyDay>=40&&studyDay<=80){
      const idx=pool.indexOf(traceWord);
      log.push(`d${studyDay} dow${dow} pool=${pool.length} segSize=${segSize} served[${start}..${Math.min(start+segSize,pool.length)-1}]cap${CAP} word@${idx>=0?idx:(state[traceWord]===2?'REST':'?')} ${seg&&seg.includes(traceWord)?'<SERVED>':''}`);
    }
    if(seg&&seg.length){
      seg.forEach(i=>lastSeen[i]=studyDay);
      const sh=[...seg].sort(()=>rand()-0.5);
      const tested=sh.slice(0,Math.min(TEST,seg.length));
      const nC=Math.round(tested.length*SCORE);
      for(const i of tested.slice(0,nC)){state[i]=2;returnAt[i]=day+REST;} // rule b-ish: only correct graduate? use rule b: all tested
      for(const i of tested.slice(nC)){state[i]=2;returnAt[i]=day+REST;}
    }
    if(studyDay===80&&traceWord<0){
      let worst=-1,wg=0;
      for(let i=0;i<twi;i++) if(state[i]===1&&lastSeen[i]>0&&studyDay-lastSeen[i]>wg){wg=studyDay-lastSeen[i];worst=i;}
      return {worst,wg};
    }
  }
  return {log};
}
const {worst,wg}=run(); console.log(`max-gap word at d80: #${worst} gap=${wg} study-days`);
const {log}=run(worst); console.log(log.slice(-28).join('\n'));
