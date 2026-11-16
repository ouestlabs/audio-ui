import{o,u}from"./h55ms3ww.js";function k(a,e){let n=u(a[0],0,e),t=u(a[1],0,e);return n<=t?[n,t]:[t,n]}function T(a,e,n,t){let[r,m]=a,{duration:i,minLength:g}=t;if(e==="both"){let s=m-r,c=o(r+n,0,Math.max(0,i-s));return[c,c+s]}if(e==="start")return[o(r+n,0,Math.max(0,m-g)),m];return[r,o(m+n,Math.min(i,r+g),i)]}
export{k,T};
