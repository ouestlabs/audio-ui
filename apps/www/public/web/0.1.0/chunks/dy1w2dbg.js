function O(a){let m=a.formatToParts(1.5).some((e)=>e.type==="decimal"&&e.value===",")?"; ":", ";return(e,r)=>`${a.format(e)}${m}${a.format(r)}`}
export{O};
