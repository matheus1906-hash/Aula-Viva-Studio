"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const source=f=>fs.readFileSync(path.join(root,"src",f),"utf8");
const AV=globalThis.AV={views:{},LS:{get:(_,d)=>d,set:()=>true},h:()=>({}),profile:()=>({})};
vm.runInThisContext(source("atividades.js"),{filename:"atividades.js"});
vm.runInThisContext(source("activity-presets.js"),{filename:"activity-presets.js"});
assert.equal(AV.ACTIVITY_PRESETS.length,50,"50 distinct editable activity presets");
assert.equal(new Set(AV.ACTIVITY_PRESETS.map(x=>x.id)).size,50,"unique activity IDs");
for(const p of AV.ACTIVITY_PRESETS){
 const e=AV.atividades.catalog.find(x=>x.id===p.activityId);
 assert.ok(e,"activity generator exists: "+p.activityId);
 const result=AV.atividades.run(p.activityId,p.values);
 assert.ok(Array.isArray(result)&&result.length>0,"activity preset produces blocks: "+p.name);
}
console.log("PASS 50 activity presets generate actual materials");
AV.anim={BACKGROUNDS:{sala:"Sala",parque:"Parque",fazenda:"Fazenda",cidade:"Cidade",biblioteca:"Biblioteca"},ACTORS:{menina:"Menina",menino:"Menino",professora:"Professora",flor:"Flor",gota:"Gota"}};
vm.runInThisContext(source("animacao-extras.js"),{filename:"animacao-extras.js"});
assert.equal(AV.anim.TEMPLATES.length,15);
for(const t of AV.anim.TEMPLATES){assert.ok(t.story.scenes.length>=3);for(const s of t.story.scenes){assert.ok(AV.anim.BACKGROUNDS[s.bg]);assert.ok(AV.anim.ACTORS[s.actors[0].type]);}}
console.log("PASS fifteen new storyboard models");
vm.runInThisContext(source("teacher-tools.js"),{filename:"teacher-tools.js"});
for(const id of ["agenda","horarios","estudos","abnt"]){assert.equal(typeof AV.views[id].render,"function",id+" render");}
assert.equal(typeof AV.teacherHomeWidgets,"function");
assert.equal(typeof AV.homeWidgetSettings,"function");
console.log("PASS agenda, timetable, study, ABNT and home personalization module interfaces");
const order=fs.readFileSync(path.join(root,"build.mjs"),"utf8");
for(const f of ["activity-presets.js","teacher-tools.js","animacao-extras.js"]){assert.ok(order.includes(f),"bundle includes "+f);}
console.log("PASS source modules are bundled");
