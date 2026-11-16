import{o}from"./h55ms3ww.js";var a={toPosition:(r,e,t)=>o((r-e)/(t-e||1),0,1),toValue:(r,e,t)=>e+o(r,0,1)*(t-e)},K={toPosition:(r,e,t)=>{if(!(e>0&&t>e))return a.toPosition(r,e,t);let l=o(r,e,t);return Math.log(l/e)/Math.log(t/e)},toValue:(r,e,t)=>{if(!(e>0&&t>e))return a.toValue(r,e,t);return e*(t/e)**o(r,0,1)}};function P(r){if(r==="log")return K;return r==="linear"?a:r}
export{K,P};
