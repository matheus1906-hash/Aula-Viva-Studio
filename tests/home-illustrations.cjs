"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const mockDocument={
 createElementNS(ns,tag){
  assert.equal(ns,"http://www.w3.org/2000/svg");
  return {tag,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=String(v);},appendChild(child){this.children.push(child);return child;},textContent:""};
 }
};
const context={document:mockDocument,globalThis:{AV:{h:(tag,props)=>({tag,props})}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/home-card-art.js"),"utf8"),context);
const art=context.globalThis.AV.HOME_CARD_ART,keys=Object.keys(art.palette);
assert.equal(keys.length,12);
assert.equal(Object.keys(art.badges).length,12);
const signatures=new Set();
for(const key of keys){
 const svg=art.create(key);
 assert.equal(svg.tag,"svg",key+": svg");
 assert.equal(svg.attrs["aria-hidden"],"true");
 assert.equal(svg.attrs["data-illustration-style"],"full-color");
 assert.ok(svg.children.length>=8,key+": multiple layered objects");
 const fills=svg.children.map(n=>n.attrs.fill).filter(x=>x&&x!=="none");
 assert.ok(new Set(fills).size>=4,key+": colorful illustration, not monochrome");
 const colored=fills.filter(x=>x.startsWith("#")&&!["#FFFFFF","#FFFFFFA8","#fff","#F6FBFF"].includes(x));
 assert.ok(new Set(colored).size>=3,key+": multiple colors");
 signatures.add(svg.children.map(n=>n.tag+JSON.stringify(n.attrs)).join("|"));
}
assert.equal(signatures.size,12,"each activity must have its own illustration, not repeated generic shapes");
console.log("PASS all 12 full-color SVG illustrations are distinct, multi-layered, self-contained and accessible");
