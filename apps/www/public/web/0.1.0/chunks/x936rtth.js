var r=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],o=new Set([1,3,6,8,10]);function e(n){return r[(Math.round(n)%12+12)%12]??""}function S(n){let t=Math.round(n);return`${e(t)}${Math.floor(t/12)-1}`}function R(n){return o.has((Math.round(n)%12+12)%12)}
export{S,R};
