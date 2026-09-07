const DB_NAME="UhuruContactBase", STORE="contacts";
let db, contacts=[];
// Always start with a valid view so render() never throws "currentView is not defined".
let currentView="all";

function openDB(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB_NAME,2);
  r.onupgradeneeded=e=>{
   const d=e.target.result;
   if(!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE,{keyPath:"id",autoIncrement:true});
  };
  r.onsuccess=e=>{db=e.target.result;resolve()};
  r.onerror=()=>reject(r.error);
 });
}
function all(){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readonly").objectStore(STORE).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(c){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).add(c);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function update(c){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).put(c);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function del(id){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearDB(){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}

function cleanPhone(p){
 const raw=String(p||"").trim();
 let digits=raw.replace(/\D/g,"");
 // South African local numbers: 081... -> +2781...
 if(digits.startsWith("00")) digits=digits.slice(2);
 if(digits.startsWith("0") && digits.length>=10) digits="27"+digits.slice(1);
 else if(!digits.startsWith("27") && digits.length>=9) digits="27"+digits;
 return digits?"+"+digits:"";
}
function phoneKey(p){ return cleanPhone(p).replace(/\D/g,""); }
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function nextNumber(){return contacts.length ? Math.max(...contacts.map(c=>Number(c.number)||0))+1 : 1}
function whatsappNumber(phone){return String(phone||"").replace(/\D/g,"")}
function formatDate(v){return v?new Date(v).toLocaleString():"NOT CALLED YET"}

async function refresh(){
 contacts=await all();
 // Normalize old phone formats and repair duplicate/invalid visible serial numbers.
 contacts.sort((a,b)=>(Number(a.number)||Number(a.id))-(Number(b.number)||Number(b.id)));
 let changed=false;
 contacts.forEach((c,i)=>{
   const normalized=cleanPhone(c.phone);
   if(normalized && c.phone!==normalized){ c.phone=normalized; changed=true; }
   if(Number(c.number)!==i+1){ c.number=i+1; changed=true; }
 });
 if(changed){ for(const c of contacts) await update(c); }
 render();
}
function contactHTML(c){
 return `<div class="row">
  <div class="serial">${esc(c.number||c.id)}</div><div>${esc(c.business)}</div><div>${esc(c.address||"—")}</div><div class="number">${esc(c.phone)}</div>
  <div class="call-info"><span class="called-badge ${c.called?"called":"not-called"}">${c.called?"✓ CALLED":"NOT CALLED"}</span><small>${c.called?esc(formatDate(c.lastCalled)):"No call recorded"}</small>${c.recall?'<span class="recall-badge">CALL AGAIN</span>':''}${c.lead?'<span class="lead-badge">LEAD / RETURN</span>':''}${c.notes?`<div class="note-preview">📝 ${esc(c.notes)}</div>`:""}</div>
  <div class="actions"><button class="whatsapp" onclick="openWhatsApp(${c.id})">WHATSAPP</button><button class="called" onclick="markCalled(${c.id})">${c.called?"CALLED ✓":"I CALLED"}</button><button onclick="toggleRecall(${c.id})">${c.recall?"REMOVE RECALL":"CALL AGAIN"}</button><button onclick="toggleLead(${c.id})">${c.lead?"REMOVE LEAD":"LEAD"}</button><button onclick="editNotes(${c.id})">NOTES</button><button onclick="editContact(${c.id})">EDIT</button><button class="danger" onclick="removeContact(${c.id})">DEL</button></div>
 </div>`;
}
function render(){
 const q=document.querySelector("#search").value.toLowerCase();
 let list=contacts.filter(c=>(`${c.business||""} ${c.address||""} ${c.phone||""} ${c.number||""} ${c.notes||""}`).toLowerCase().includes(q));
 if(currentView==="recall") list=list.filter(c=>c.recall);
 if(currentView==="leads") list=list.filter(c=>c.lead);
 document.querySelector("#total").textContent=contacts.length;
 const box=document.querySelector("#contacts"), title=document.querySelector("#viewTitle");
 title.textContent=currentView==="all"?"ALL CONTACTS":currentView==="places"?"CONTACTS GROUPED BY PLACE":currentView==="recall"?"CONTACTS TO CALL AGAIN":"LEADS / CONTACTS TO RETURN TO";
 if(currentView==="places"){
   const groups={}; list.forEach(c=>{const k=(c.address||"Not specified").trim();(groups[k]||(groups[k]=[])).push(c)});
   box.innerHTML=Object.entries(groups).map(([place,items])=>`<div class="place-group"><h3>📍 ${esc(place)} <small>(${items.length})</small></h3>${items.map(contactHTML).join("")}</div>`).join("");
 }else box.innerHTML=list.map(contactHTML).join("");
 document.querySelector("#empty").style.display=list.length?"none":"block";
}

async function add(b,a,p){
 b=String(b||"").trim(); a=String(a||"").trim(); p=cleanPhone(p);
 if(!b||!a||!p){alert("BUSINESS NAME, ADDRESS / PLACE AND CONTACT NUMBER ARE REQUIRED.");return false}
 if(contacts.some(c=>phoneKey(c.phone)===phoneKey(p))){alert(`DUPLICATE NUMBER DETECTED: ${p}`);return false}
 await put({number:nextNumber(),business:b,address:a,phone:p,created:new Date().toISOString(),called:false,lastCalled:null,notes:"",recall:false,lead:false});
 await refresh(); return true;
}


window.openWhatsApp=async id=>{
 const c=contacts.find(x=>x.id===id); if(!c)return;
 window.open(`https://wa.me/${whatsappNumber(c.phone)}`,"_blank");
};
window.markCalled=async id=>{
 const c=contacts.find(x=>x.id===id); if(!c)return;
 c.called=true;c.lastCalled=new Date().toISOString();
 await update(c);await refresh();
};
window.editNotes=async id=>{
 const c=contacts.find(x=>x.id===id); if(!c)return;
 const note=prompt(`NOTES FOR ${c.business}:`,c.notes||"");
 if(note===null)return;
 c.notes=note.trim();await update(c);await refresh();
};

window.toggleRecall=async id=>{ const c=contacts.find(x=>x.id===id); if(!c)return; c.recall=!c.recall; await update(c); await refresh(); };
window.toggleLead=async id=>{ const c=contacts.find(x=>x.id===id); if(!c)return; c.lead=!c.lead; await update(c); await refresh(); };

window.removeContact=async id=>{
 if(confirm("DELETE THIS CONTACT?")){
  await del(id);
  // Re-number remaining records from 1 so the list always stays sequential.
  const remaining=await all();
  remaining.sort((a,b)=>(a.number||a.id)-(b.number||b.id));
  for(let i=0;i<remaining.length;i++){remaining[i].number=i+1;await update(remaining[i])}
  await refresh();
 }
};

window.editContact=async id=>{
 const c=contacts.find(x=>x.id===id); if(!c)return;
 const b=prompt("BUSINESS NAME:",c.business);
 if(b===null)return;
 const a=prompt("BUSINESS ADDRESS / PLACE:",c.address||"");
 if(a===null)return;
 const p=prompt("CONTACT NUMBER / WHATSAPP:",c.phone);
 if(p===null)return;
 const phone=cleanPhone(p);
 if(!b.trim()||!a.trim()||!phone){alert("ALL THREE FIELDS ARE REQUIRED.");return}
 if(contacts.some(x=>x.id!==id&&phoneKey(x.phone)===phoneKey(phone))){alert("DUPLICATE NUMBER DETECTED.");return}
 await update({...c,business:b.trim(),address:a.trim(),phone});
 await refresh();
};

document.querySelector("#addBtn").onclick=async()=>{
 const ok=await add(
  document.querySelector("#business").value,
  document.querySelector("#address").value,
  document.querySelector("#phone").value
 );
 if(ok){
  document.querySelector("#phone").value="";
 }
};

document.querySelector("#bulkBtn").onclick=async()=>{
 const address=document.querySelector("#address").value.trim();
 if(!address){alert("ENTER THE BUSINESS ADDRESS / PLACE FIRST. ALL BULK CONTACTS WILL USE THIS SAME PLACE.");return}
 const lines=document.querySelector("#bulkInput").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length){alert("PASTE AT LEAST ONE BUSINESS NAME AND CONTACT NUMBER.");return}
 let n=0, skipped=0;
 for(const line of lines){
  // Preferred format: Business Name, Phone Number
  // Also accepts: Business Name | Phone Number or Business Name - Phone Number
  let parts=line.split(/\s*(?:,|\||\t)\s*/);
  if(parts.length<2){
   const m=line.match(/^(.*?)(?:\s+-\s+)([+\d][\d\s()\-]{6,})$/);
   parts=m?[m[1],m[2]]:[];
  }
  if(parts.length<2){skipped++;continue}
  const phone=parts.pop().trim();
  const business=parts.join(", ").trim();
  if(await add(business,address,phone)) n++; else skipped++;
 }
 if(n) document.querySelector("#bulkInput").value="";
 alert(`${n} CONTACT(S) SAVED WITH THE SAME PLACE: ${address}. ${skipped?skipped+" SKIPPED (CHECK THE FORMAT OR DUPLICATES).":""}`);
};

document.querySelector("#search").oninput=render;

function download(name,text,type){
 const a=document.createElement("a");
 a.href=URL.createObjectURL(new Blob([text],{type}));
 a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
document.querySelector("#csvBtn").onclick=()=>{
 const rows=[["No.","Business Name","Address / Place","Contact Number","Called","Last Called","Notes"],...contacts.map(c=>[c.number||c.id,c.business,c.address||"",c.phone,c.called?"YES":"NO",c.lastCalled||"",c.notes||""])];
 const csv=rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(",")).join("\r\n");
 download("uhuru-contact-base.csv",csv,"text/csv")
};
document.querySelector("#vcfBtn").onclick=()=>{
 const v=contacts.map(c=>`BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${c.business}\r\nORG:${c.business}\r\nADR:;;${c.address||""};;;;\r\nTEL;TYPE=CELL,VOICE:${c.phone}\r\nNOTE:Contact No. ${c.number||c.id}\r\nEND:VCARD`).join("\r\n");
 download("uhuru-contact-base.vcf",v,"text/vcard")
};
document.querySelector("#backupBtn").onclick=()=>download("uhuru-contact-base-backup.json",JSON.stringify(contacts,null,2),"application/json");

document.querySelector("#csvFile").onchange=e=>{
 const f=e.target.files[0];if(!f)return;
 const r=new FileReader();
 r.onload=async()=>{
  const lines=r.result.split(/\r?\n/).filter(Boolean);
  let n=0;
  // Supports: Business,Address,Phone (or exported No.,Business,Address,Phone)
  for(let i=0;i<lines.length;i++){
   const cols=lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(x=>x.replace(/^"|"$/g,"").replaceAll('""','"'))||[];
   if(i===0 && /business/i.test(lines[i])) continue;
   let b,a,p;
   if(cols.length>=4){[,b,a,p]=cols}
   else if(cols.length>=3){[b,a,p]=cols}
   else continue;
   if(await add(b,a,p)) n++;
  }
  alert(`${n} CONTACT(S) IMPORTED.`);
 };
 r.readAsText(f);e.target.value="";
};
document.querySelector("#jsonFile").onchange=e=>{
 const f=e.target.files[0];if(!f)return;
 const r=new FileReader();
 r.onload=async()=>{
  try{
   const data=JSON.parse(r.result);let n=0;
   for(const c of data){
    if(await add(c.business,c.address||"Not specified",c.phone)){
     const added=contacts.find(x=>phoneKey(x.phone)===phoneKey(c.phone));
     if(added){
       added.called=!!c.called; added.lastCalled=c.lastCalled||null; added.notes=c.notes||"";
       added.recall=!!c.recall; added.lead=!!c.lead; await update(added);
     }
     n++;
    }
   }
   await refresh();
   alert(`${n} CONTACT(S) RESTORED.`);
  }catch{alert("INVALID BACKUP FILE.")}
 };
 r.readAsText(f);e.target.value="";
};
const contactFile=document.querySelector("#contactFile");
if(contactFile) contactFile.onchange=e=>{
 const f=e.target.files[0]; if(!f)return;
 const r=new FileReader();
 r.onload=async()=>{
  const cards=String(r.result).split(/END:VCARD/i); let saved=0,skipped=0;
  for(const card of cards){
   const fn=(card.match(/(?:^|\n)FN[^:]*:(.+)/i)||[])[1]?.trim();
   const tel=(card.match(/(?:^|\n)TEL[^:]*:(.+)/i)||[])[1]?.trim();
   const adr=(card.match(/(?:^|\n)ADR[^:]*:(.+)/i)||[])[1]?.replace(/;/g," ").trim()||"Imported Contacts";
   if(fn&&tel){ if(await add(fn,adr,tel)) saved++; else skipped++; }
  }
  alert(`${saved} CONTACT(S) IMPORTED FROM VCF.${skipped?` ${skipped} SKIPPED (INVALID OR DUPLICATE).`:""}`);
 };
 r.readAsText(f); e.target.value="";
};

document.querySelector("#clearBtn").onclick=async()=>{
 if(confirm("DELETE ALL LOCAL CONTACTS? THIS CANNOT BE UNDONE.")){await clearDB();await refresh()}
};
document.querySelectorAll("#viewTabs button").forEach(btn=>btn.onclick=()=>{currentView=btn.dataset.view;document.querySelectorAll("#viewTabs button").forEach(b=>b.classList.toggle("active",b===btn));render();});
openDB().then(refresh).catch(err=>alert("DATABASE ERROR: "+err.message));

// THEME SWITCHER
const THEME_KEY="UhuruContactBaseTheme";
function applyTheme(theme){
 document.body.dataset.theme=theme;
 localStorage.setItem(THEME_KEY,theme);
 const btn=document.querySelector("#themeToggle");
 if(btn) btn.textContent=theme==="iphone"?"◐ CYBERPUNK VIEW":"◐ IPHONE VIEW";
 document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="iphone"?"#f5f5f7":"#050509");
}
applyTheme(localStorage.getItem(THEME_KEY)||"cyberpunk");
document.querySelector("#themeToggle").onclick=()=>applyTheme(document.body.dataset.theme==="iphone"?"cyberpunk":"iphone");

// IMPORT PHONE CONTACTS FROM VCF / VCARD FILES
function unfoldVCard(text){return text.replace(/\r?\n[ \t]/g,"");}
function parseVCardFile(text){
 const cards=unfoldVCard(text).split(/END:VCARD/i);
 const results=[];
 for(const card of cards){
  if(!/BEGIN:VCARD/i.test(card)) continue;
  const lines=card.split(/\r?\n/);
  let name="", org="", address="", phones=[];
  for(let line of lines){
   const idx=line.indexOf(":"); if(idx<0) continue;
   const key=line.slice(0,idx).toUpperCase(), value=line.slice(idx+1).trim();
   if(key.startsWith("FN")) name=value;
   else if(key.startsWith("ORG")) org=value.replace(/;/g," ");
   else if(key.startsWith("ADR")) address=value.split(";").filter(Boolean).join(", ");
   else if(key.startsWith("TEL")) phones.push(value);
  }
  const business=(org||name||"Unnamed Contact").trim();
  for(const phone of phones) results.push({business,address:address||"Imported Contact",phone});
 }
 return results;
}
document.querySelector("#contactFile").onchange=e=>{
 const f=e.target.files[0]; if(!f)return;
 const r=new FileReader();
 r.onload=async()=>{
  const imported=parseVCardFile(String(r.result||""));
  if(!imported.length){alert("NO PHONE CONTACTS WERE FOUND IN THIS FILE. PLEASE IMPORT A .VCF / VCARD FILE.");return}
  let saved=0, skipped=0;
  for(const c of imported){
   if(await add(c.business,c.address,c.phone)) saved++; else skipped++;
  }
  alert(`${saved} CONTACT(S) IMPORTED. ${skipped?skipped+" SKIPPED (INVALID OR DUPLICATE).":""}`);
 };
 r.readAsText(f); e.target.value="";
};
