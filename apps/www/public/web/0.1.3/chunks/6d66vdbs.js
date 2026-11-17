var e=new Map;function d(t,n={}){let r=`${t??""}|${JSON.stringify(n)}`,i=e.get(r);if(!i)i=new Intl.NumberFormat(t,n),e.set(r,i);return i}
export{d};
