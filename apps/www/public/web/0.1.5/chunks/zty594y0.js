var o=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],r=new Set([1,3,6,8,10]),e=(n)=>(Math.round(n)%12+12)%12;function c(n){return o[e(n)]??""}function S(n){let t=Math.round(n);return`${c(t)}${Math.floor(t/12)-1}`}var A=(n)=>r.has(e(n));
export{S,A};
