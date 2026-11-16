var o=(n,e,r)=>Math.max(e,Math.min(n,r)),d=(n)=>Math.max(0,Math.min(n,1)),u=(n,e,r)=>Number.isFinite(n)?o(n,e,r):e;function y(n,e,r){let t=(String(e).split(".")[1]??"").length;return Number((Math.round((n-r)/e)*e+r).toFixed(t))}var M=Math.PI*2,H=Math.PI/2,W=(n)=>n*180/Math.PI,V=(n)=>n/180*Math.PI;
export{o,d,u,y,M,H,W,V};
