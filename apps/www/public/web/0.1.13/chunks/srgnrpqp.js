var e=new Map;function d(i,n={}){let r=`${i??""}|${JSON.stringify(n)}`,t=e.get(r);if(!t)t=new Intl.NumberFormat(i,n),e.set(r,t);return t}
export{d};
