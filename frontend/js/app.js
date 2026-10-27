(function(){
'use strict';
var KEY='commit2fit-prototype-v1';
var MEALS=['Frühstück','Mittagessen','Abendessen','Snack'];
var ACT=[{l:'Kaum Bewegung',f:1.2},{l:'Leicht aktiv (1–3 Trainings pro Woche)',f:1.375},{l:'Mäßig aktiv (3–5 Trainings pro Woche)',f:1.55},{l:'Sehr aktiv (6–7 Trainings pro Woche)',f:1.725}];
var WD=['So','Mo','Di','Mi','Do','Fr','Sa'];
var MODELS={'16:8':16,'18:6':18,'20:4':20,'Ramadan':0};

/* Beispielprodukte pro 100 g: Name, Marke, kcal, Fett, KH, Zucker, Eiweiß, Salz, Portion */
var RAW=[
['Haferflocken, zart','Bio-Mühle',372,7,59,1.1,13.5,0.02,null],
['Naturjoghurt 3,6 %','Alpenhof',66,3.6,4,4,3.5,0.1,['1 Becher',150]],
['Vollkornbrot','Bäckerei Kranz',215,1.5,40,3,7,1.2,['1 Scheibe',45]],
['Banane','Obst und Gemüse',93,0.3,21,17,1.1,0,['1 Banane',120]],
['Hühnerbrust, roh','Frischfleisch',110,1.5,0,0,23,0.15,['1 Filet',150]],
['Reis, gekocht','Küchenklassiker',130,0.3,28,0.1,2.7,0,null],
['Magertopfen','Alpenhof',68,0.3,3.5,3.5,12,0.1,['1 Packung',250]],
['Erdnussmus','Nussgarten',610,50,12,6,26,0.5,['1 EL',15]],
['Apfel','Obst und Gemüse',54,0.4,11.4,10.4,0.3,0,['1 Apfel',180]],
['Vollmilch 3,5 %','Alpenhof',64,3.5,4.7,4.7,3.3,0.1,['1 Glas',250]],
['Olivenöl','Sonnenhain',884,100,0,0,0,0,['1 EL',10]],
['Haselnuss-Riegel','Nussgarten',520,30,52,45,7,0.2,['1 Riegel',35]],
['Vollkornnudeln, gekocht','Küchenklassiker',150,1.2,28,1.5,5.5,0.01,null],
['Ei, Größe M','Landhof',143,9.5,0.7,0.7,12.6,0.35,['1 Ei',60]]
];
var P0=RAW.map(function(r,i){return {id:'p'+(i+1),bc:'90001000'+(10001+i),name:r[0],brand:r[1],k:r[2],f:r[3],c:r[4],s:r[5],p:r[6],t:r[7],por:r[8]}});

/* Beispiel-Tagebuch: Tag-Offset -> [Mahlzeit, Produkt, Gramm] */
var SEED={
0:[[0,'p1',60],[0,'p2',150],[0,'p4',120],[3,'p9',180]],
1:[[0,'p1',80],[0,'p10',250],[0,'p4',120],[1,'p5',200],[1,'p6',250],[1,'p11',10],[2,'p3',135],[2,'p14',180],[2,'p7',150],[3,'p9',180],[3,'p8',30]],
2:[[0,'p2',150],[0,'p4',120],[0,'p1',60],[1,'p6',200],[1,'p5',150],[2,'p3',90],[2,'p7',250],[3,'p8',30]],
3:[[0,'p3',90],[0,'p14',120],[0,'p10',200],[1,'p13',300],[1,'p5',180],[1,'p11',10],[2,'p6',250],[2,'p5',150],[2,'p11',10],[3,'p12',35],[3,'p9',180],[3,'p2',150],[3,'p8',20]],
4:[[0,'p1',100],[0,'p10',300],[0,'p4',120],[1,'p13',350],[1,'p5',250],[1,'p11',20],[2,'p3',180],[2,'p14',240],[2,'p8',40],[3,'p12',70]],
5:[[0,'p2',150],[0,'p1',70],[0,'p4',120],[1,'p6',300],[1,'p5',200],[1,'p11',10],[2,'p3',135],[2,'p7',200],[2,'p14',120],[3,'p9',180],[3,'p12',35]],
6:[[0,'p3',90],[0,'p14',120],[0,'p10',250],[1,'p13',300],[1,'p5',200],[1,'p11',15],[2,'p6',300],[2,'p5',150],[2,'p2',150],[3,'p8',30],[3,'p4',120],[3,'p12',35]]
};
/* Simulierte Scan-Ergebnisse */
var SIM_BC=['9000100010002','9000100099001','9000100099002'];
var OCR=[
 {k:362,f:6.2,c:63,s:12,p:10.1,t:0.05,flag:'t'},
 {k:63,f:0.2,c:4,s:4,p:11,t:0.1,flag:'c'},
 {k:98,f:3.2,c:12.5,s:6,p:4.1,t:0.22,flag:null}
];

var pad=function(n){return String(n).padStart(2,'0')};
var dk=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
var dayKey=function(off){var d=new Date();d.setDate(d.getDate()-off);return dk(d)};
var dateOf=function(key){var a=key.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
var fmt=function(n,d){return Number(n).toLocaleString('de-DE',{minimumFractionDigits:d||0,maximumFractionDigits:d||0})};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var $=function(s){return document.querySelector(s)};
var num=function(v,lo,hi,d){v=parseFloat(v);return isFinite(v)?Math.min(hi,Math.max(lo,v)):d};

var X='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
var TRI='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/></svg>';
var SCANI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></svg>';
var STAR=function(on){return '<svg viewBox="0 0 24 24" width="20" height="20" fill="'+(on?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>'};
var CHL='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
var CHR='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

/* Zustand: Beispieldaten werden täglich neu erzeugt, nur eigene Änderungen werden gespeichert */
var DEF=function(){return {profile:{sex:'m',age:22,h:180,w:75,act:1,goal:'halten'},favs:['p2','p9'],fast:{model:'16:8',startTs:null,from:'05:30',to:'18:00'},up:[],ue:[],rm:[]}};
var S=load();
function load(){try{var j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&j.profile&&j.fast){return Object.assign(DEF(),j)}}catch(e){}return DEF()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function seedLog(){var out=[],n=1;Object.keys(SEED).forEach(function(o){var key=dayKey(Number(o));SEED[o].forEach(function(r){out.push({id:'e'+(n++),d:key,m:r[0],pid:r[1],g:r[2]})})});return out}
var products=function(){return P0.concat(S.up)};
var prod=function(id){return products().find(function(p){return p.id===id})};
var logAll=function(){return seedLog().filter(function(e){return S.rm.indexOf(e.id)<0}).concat(S.ue).filter(function(e){return prod(e.pid)})};

function nut(pid,g){var p=prod(pid),f=g/100;return {k:p.k*f,p:p.p*f,c:p.c*f,f:p.f*f}}
function dayTotals(key){var t={k:0,p:0,c:0,f:0};logAll().forEach(function(e){if(e.d===key){var n=nut(e.pid,e.g);t.k+=n.k;t.p+=n.p;t.c+=n.c;t.f+=n.f}});return t}
function targets(){
  var pr=S.profile,age=num(pr.age,12,100,22),h=num(pr.h,120,230,180),w=num(pr.w,35,250,75);
  var bmr=10*w+6.25*h-5*age+(pr.sex==='m'?5:-161);
  var tdee=bmr*ACT[pr.act].f;
  var adj={abnehmen:-400,halten:0,zunehmen:300}[pr.goal]||0;
  var floor=pr.sex==='m'?1500:1200;
  var k=Math.round(Math.max(tdee+adj,floor)/10)*10;
  var p=Math.round(w*1.6),f=Math.round(k*0.3/9),c=Math.max(0,Math.round((k-p*4-f*9)/4));
  return {bmr:Math.round(bmr),tdee:Math.round(tdee),k:k,p:p,c:c,f:f};
}
function status(t,tg,today){
  if(t.k<=0)return 'none';
  if(t.k>tg.k*1.15)return 'high';
  if((!today||new Date().getHours()>=18)&&t.k<tg.k*0.7)return 'low';
  return 'ok';
}
function checks(t,tg,today){
  var out=[],late=!today||new Date().getHours()>=18,s=status(t,tg,today);
  if(s==='high')out.push({lv:'bad',txt:'Zu viel: '+fmt(t.k-tg.k)+' kcal über dem Tagesziel.'});
  if(s==='low')out.push({lv:'warn',txt:'Zu wenig: nur '+Math.round(t.k/tg.k*100)+' % des Tagesziels erreicht.'});
  if(t.k>0&&t.f>tg.f*1.3)out.push({lv:'warn',txt:'Der Fettanteil liegt deutlich über dem Ziel.'});
  if(t.k>0&&late&&t.p<tg.p*0.6)out.push({lv:'warn',txt:'Eiweiß liegt unter 60 % des Ziels.'});
  return out;
}
var alertHTML=function(a){return '<div class="alert '+a.lv+'" role="status">'+TRI+'<span>'+esc(a.txt)+'</span></div>'};
function defMeal(){var h=new Date().getHours();return h<10?0:h<15?1:h<17?3:2}

var tab='today',tick=null,q='',filt='all',pendMeal=null,hm='week',hk=dayKey(0),cur=null,sc=null,scanIdx=0,ocrIdx=0,lastPhase=null,lastFocus=null,toastT=null;
var view=$('#view'),sheet=$('#sheet'),panel=$('#panel');

function toast(msg){var t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},2800)}
function go(t){tab=t;clearInterval(tick);if(t!=='find')pendMeal=null;if(t==='hist'){hm='week';hk=dayKey(0)}render();window.scrollTo(0,0)}
function render(){
  document.querySelectorAll('.tab').forEach(function(b){b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false')});
  ({today:vToday,find:vFind,hist:vHist,fast:vFast,profile:vProfile})[tab]();
}

/* ---------- gemeinsame Bausteine ---------- */
function macro(label,v,tg,col){
  var pct=tg>0?Math.min(100,v/tg*100):0;
  return '<div class="mac"><div class="mac-h"><span>'+label+'</span><span class="mono">'+fmt(v)+' / '+fmt(tg)+' g</span></div><div class="track"><div class="fill" style="width:'+pct+'%;background:'+col+'"></div></div></div>';
}
function mealList(key,canAdd){
  var es=logAll().filter(function(e){return e.d===key}),h='';
  MEALS.forEach(function(mn,mi){
    var list=es.filter(function(e){return e.m===mi});
    var sum=list.reduce(function(a,e){return a+nut(e.pid,e.g).k},0);
    h+='<section class="meal"><div class="meal-h"><h2>'+mn+'</h2><span class="mono sub">'+(list.length?fmt(sum)+' kcal':'')+'</span></div>';
    if(!list.length)h+='<p class="empty">Noch nichts eingetragen.</p>';
    list.forEach(function(e){
      var p=prod(e.pid),n=nut(e.pid,e.g);
      h+='<div class="ent"><div><b>'+esc(p.name)+'</b><small>'+fmt(e.g)+' g · E '+fmt(n.p)+' · KH '+fmt(n.c)+' · F '+fmt(n.f)+' g</small></div><span class="mono">'+fmt(n.k)+'</span><button class="icon-btn" data-act="del" data-id="'+e.id+'" aria-label="'+esc(p.name)+' entfernen">'+X+'</button></div>';
    });
    if(canAdd)h+='<button class="link" data-act="addmeal" data-m="'+mi+'">+ Hinzufügen</button>';
    h+='</section>';
  });
  return h;
}

/* ---------- Heute ---------- */
function vToday(){
  var key=dayKey(0),t=dayTotals(key),tg=targets(),ch=checks(t,tg,true);
  var pct=t.k/tg.k,C=339.29,dash=Math.min(1,pct)*C,left=tg.k-t.k;
  var col=pct>1.15?'var(--bad)':pct>1?'var(--warn)':'var(--accent)';
  var date=new Date().toLocaleDateString('de-AT',{weekday:'long',day:'numeric',month:'long'});
  view.innerHTML='<p class="eyebrow">'+esc(date)+'</p><h1>Tagesbilanz</h1>'+ch.map(alertHTML).join('')+
  '<section class="card"><div class="hero"><div class="ring"><svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="54" fill="none" stroke="var(--line)" stroke-width="12"/>'+
  (dash>0.5?'<circle cx="66" cy="66" r="54" fill="none" stroke="'+col+'" stroke-width="12" stroke-linecap="round" stroke-dasharray="'+dash+' '+C+'" transform="rotate(-90 66 66)"/>':'')+
  '</svg><div class="mid"><b>'+fmt(t.k)+'</b><span>von '+fmt(tg.k)+' kcal</span></div></div>'+
  '<div><p class="k">'+(left>=0?'Noch offen':'Über dem Ziel')+'</p><p class="big">'+fmt(Math.abs(left))+' <small>kcal</small></p><p class="sub">'+Math.round(pct*100)+' % des Tagesziels</p></div></div>'+
  macro('Eiweiß',t.p,tg.p,'var(--p)')+macro('Kohlenhydrate',t.c,tg.c,'var(--c)')+macro('Fett',t.f,tg.f,'var(--f)')+'</section>'+
  mealList(key,true);
}

/* ---------- Produkte ---------- */
function productList(){
  var all=products(),r=all;
  if(filt==='fav')r=all.filter(function(p){return S.favs.indexOf(p.id)>=0});
  else if(filt==='rec'){
    var seen=[];
    logAll().reverse().sort(function(a,b){return a.d<b.d?1:a.d>b.d?-1:0}).forEach(function(e){if(seen.indexOf(e.pid)<0)seen.push(e.pid)});
    r=seen.slice(0,10).map(prod).filter(Boolean);
  }
  var s=q.trim().toLowerCase();
  if(s)r=r.filter(function(p){return (p.name+' '+p.brand+' '+p.bc).toLowerCase().indexOf(s)>=0});
  return r;
}
function drawResults(){
  var r=productList(),el=$('#results');if(!el)return;
  if(!r.length){
    el.innerHTML='<li><p class="empty" style="margin-top:18px">Nichts gefunden. Scanne das Produkt, dann steht es für alle Nutzer in der zentralen Datenbank.</p><button class="btn primary" data-act="scan">'+SCANI+'Produkt scannen</button></li>';
    return;
  }
  el.innerHTML=r.map(function(p){
    var fav=S.favs.indexOf(p.id)>=0;
    return '<li><button class="row" data-act="open" data-id="'+p.id+'"><span class="rm"><b>'+esc(p.name)+'</b><small>'+esc(p.brand)+'</small></span>'+(fav?'<span class="st" aria-label="Favorit">'+STAR(true)+'</span>':'')+'<span class="kc">'+fmt(p.k)+' kcal<br><small>pro 100 g</small></span></button></li>';
  }).join('');
}
function vFind(){
  var chips=[['all','Alle'],['rec','Zuletzt'],['fav','Favoriten']].map(function(c){return '<button class="chip" data-act="filt" data-f="'+c[0]+'" aria-pressed="'+(filt===c[0])+'">'+c[1]+'</button>'}).join('');
  view.innerHTML='<h1>Produkt hinzufügen</h1>'+
  (pendMeal!==null?'<p class="ctx">Eintrag für <b>'+MEALS[pendMeal]+'</b></p>':'')+
  '<div class="searchrow"><label class="sr-only" for="q" style="position:absolute;left:-9999px">Produkt suchen</label><input class="in" id="q" type="search" placeholder="Name, Marke oder Barcode" value="'+esc(q)+'" autocomplete="off"><button class="btn primary" data-act="scan" aria-label="Produkt scannen">'+SCANI+'Scan</button></div>'+
  '<div class="chips" role="group" aria-label="Filter">'+chips+'</div><ul class="rows" id="results"></ul>'+
  '<p class="note">'+products().length+' Produkte in der zentralen Datenbank.</p>';
  drawResults();
}

/* ---------- Produkt-Sheet ---------- */
function showSheet(html){
  if(sheet.hidden)lastFocus=document.activeElement;
  panel.innerHTML=html;sheet.hidden=false;document.body.style.overflow='hidden';panel.scrollTop=0;panel.focus();
}
function closeSheet(){sheet.hidden=true;document.body.style.overflow='';cur=null;sc=null;if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}}
function grams(){var p=prod(cur.id),v=parseFloat(String(cur.val).replace(',','.'));if(!isFinite(v)||v<=0)return 0;return cur.mode==='p'?v*p.por[1]:v}
function openProduct(id){
  var p=prod(id);sc=null;
  cur={id:id,mode:p.por?'p':'g',val:p.por?1:100,meal:pendMeal!==null?pendMeal:defMeal()};
  showSheet(productHTML());
}
function calcHTML(){
  var g=grams(),n=nut(cur.id,g);
  return '<div><span class="big">'+fmt(n.k)+'</span> <span class="sub">kcal · '+fmt(g)+' g</span></div><div class="mini"><span><i style="background:var(--p)"></i>Eiweiß <b class="mono">'+fmt(n.p,1)+' g</b></span><span><i style="background:var(--c)"></i>KH <b class="mono">'+fmt(n.c,1)+' g</b></span><span><i style="background:var(--f)"></i>Fett <b class="mono">'+fmt(n.f,1)+' g</b></span></div>';
}
function productHTML(){
  var p=prod(cur.id),fav=S.favs.indexOf(p.id)>=0,amt='';
  if(p.por){
    amt+='<div class="seg" role="group" aria-label="Mengenart" style="margin:0"><button data-act="mode" data-m="p" aria-pressed="'+(cur.mode==='p')+'">Portion</button><button data-act="mode" data-m="g" aria-pressed="'+(cur.mode==='g')+'">Gramm</button></div>';
  }
  if(cur.mode==='p'){
    amt+='<label class="fld">Anzahl · '+esc(p.por[0])+' = '+p.por[1]+' g<input class="in" id="pv" type="number" inputmode="decimal" min="0.5" step="0.5" value="'+esc(cur.val)+'"></label>';
  }else{
    amt+='<label class="fld">Menge in Gramm<input class="in" id="pv" type="number" inputmode="decimal" min="1" step="5" value="'+esc(cur.val)+'"></label><div class="chips" style="margin:0">'+[50,100,150,200].map(function(v){return '<button class="chip" data-act="qg" data-v="'+v+'">'+v+' g</button>'}).join('')+'</div>';
  }
  amt+='<label class="fld">Mahlzeit<select class="in" id="pm">'+MEALS.map(function(m,i){return '<option value="'+i+'"'+(cur.meal===i?' selected':'')+'>'+m+'</option>'}).join('')+'</select></label>';
  return '<div class="sh-head"><div><h2 id="sheetTitle">'+esc(p.name)+'</h2><p class="sub">'+esc(p.brand)+' · <span class="mono">'+esc(p.bc||'kein Barcode')+'</span></p></div><button class="icon-btn" data-act="close" aria-label="Schließen">'+X+'</button></div>'+
  '<div class="label"><h3>Nährwerte <span>pro 100 g</span></h3>'+
  '<div class="lr first"><span>Energie</span><span class="mono">'+fmt(p.k)+' kcal</span></div>'+
  '<div class="lr"><span>Fett</span><span class="mono">'+fmt(p.f,1)+' g</span></div>'+
  '<div class="lr"><span>Kohlenhydrate</span><span class="mono">'+fmt(p.c,1)+' g</span></div>'+
  '<div class="lr sub1"><span>davon Zucker</span><span class="mono">'+fmt(p.s,1)+' g</span></div>'+
  '<div class="lr"><span>Eiweiß</span><span class="mono">'+fmt(p.p,1)+' g</span></div>'+
  '<div class="lr"><span>Salz</span><span class="mono">'+fmt(p.t,2)+' g</span></div></div>'+
  '<div class="amount">'+amt+'</div><div class="calc" id="pcalc">'+calcHTML()+'</div>'+
  '<div class="acts"><button class="btn" data-act="fav" aria-pressed="'+fav+'" aria-label="'+(fav?'Favorit entfernen':'Als Favorit merken')+'" style="color:'+(fav?'var(--c)':'inherit')+'">'+STAR(fav)+'</button><button class="btn primary" data-act="addcur">Zum Tagebuch hinzufügen</button></div>';
}

/* ---------- Scan-Sheet ---------- */
function stepper(n){return '<ol class="steps">'+['Barcode','Nährwerte','Prüfen'].map(function(l,i){return '<li class="'+(i+1<n?'done':'')+'"'+(i+1===n?' aria-current="step"':'')+'><span>'+(i+1)+'</span>'+l+'</li>'}).join('')+'</ol>'}
function scanHTML(){
  var head='<div class="sh-head"><h2 id="sheetTitle">Produkt scannen</h2><button class="icon-btn" data-act="close" aria-label="Schließen">'+X+'</button></div>'+stepper(sc.step);
  var proto='<p class="sub" style="margin-top:12px">Prototyp: Die Kamera ist nicht angebunden. Der Scan läuft mit Beispieldaten.</p>';
  if(sc.step===1){
    return head+'<div class="vf" aria-hidden="true"><i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i><div class="bars"></div></div>'+
    '<button class="btn primary block" data-act="scanbc">'+SCANI+'Barcode scannen</button>'+
    '<p class="or">oder Barcode eintippen</p><div class="searchrow"><label for="bcIn" style="position:absolute;left:-9999px">Barcode</label><input class="in mono" id="bcIn" inputmode="numeric" maxlength="13" placeholder="13 Ziffern"><button class="btn" data-act="scanmanual">Prüfen</button></div>'+
    '<div style="margin-top:8px"><button class="link" data-act="skipbc">Ohne Barcode fortfahren</button></div><p class="msg" id="scMsg" role="alert"></p>'+proto;
  }
  if(sc.step===2){
    return head+'<p style="margin:0 0 12px">'+(sc.bc?'Der Barcode <span class="mono">'+esc(sc.bc)+'</span> ist noch nicht in der Datenbank. Fotografiere jetzt die Nährwerttabelle.':'Fotografiere die Nährwerttabelle der Verpackung.')+'</p>'+
    '<div class="vf" aria-hidden="true"><i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i><div class="lbl"><i></i><i></i><i></i><i></i><i></i></div></div>'+
    '<button class="btn primary block" data-act="scanocr">'+SCANI+'Nährwerttabelle scannen</button>'+
    '<div style="margin-top:8px"><button class="link" data-act="scanback">Zurück</button></div>'+proto;
  }
  var v=sc.vals;
  function f(key,label,extra){
    return '<label class="fld'+(sc.flag===key?' flag':'')+'">'+label+'<input class="in mono" data-sf="'+key+'" inputmode="decimal" value="'+esc(v[key])+'">'+(sc.flag===key?'<span class="hint">Unsicher erkannt, bitte prüfen</span>':'')+'</label>';
  }
  return head+'<p class="sub" style="margin:0 0 12px">Prüfe die erkannten Werte (pro 100 g) und ergänze den Namen.</p><div class="form">'+
  '<label class="fld">Produktname<input class="in" data-sf="name" value="'+esc(v.name)+'" placeholder="z. B. Dinkel-Müsli" autocomplete="off"></label>'+
  '<div class="grid2"><label class="fld">Marke<input class="in" data-sf="brand" value="'+esc(v.brand)+'" autocomplete="off"></label><label class="fld">Barcode<input class="in mono" data-sf="bc" inputmode="numeric" maxlength="13" value="'+esc(v.bc)+'"></label></div>'+
  '<div class="grid2">'+f('k','Energie (kcal)')+f('f','Fett (g)')+f('c','Kohlenhydrate (g)')+f('s','davon Zucker (g)')+f('p','Eiweiß (g)')+f('t','Salz (g)')+'</div></div>'+
  '<p class="msg" id="scMsg" role="alert"></p>'+
  '<div class="acts" style="grid-template-columns:auto 1fr;margin-top:6px"><button class="btn" data-act="rescan">Neu scannen</button><button class="btn primary" data-act="savep">In Datenbank speichern</button></div>';
}
function scMsg(t){var m=$('#scMsg');if(m)m.textContent=t}
function openExisting(p){sc=null;toast('Dieses Produkt ist schon in der Datenbank.');openProduct(p.id)}

/* ---------- Verlauf ---------- */
function weekHTML(){
  var tg=targets(),days=[],o,i;
  for(o=6;o>=0;o--){var key=dayKey(o);days.push({o:o,key:key,d:dateOf(key),t:dayTotals(key)})}
  days.forEach(function(x){x.st=status(x.t,tg,x.o===0)});
  var mx=Math.max.apply(null,[tg.k*1.2].concat(days.map(function(x){return x.t.k})));
  var top=Math.max(1000,Math.ceil(mx/500)*500);
  var W=340,H=196,L=36,R=6,T=18,B=26,iw=W-L-R,ih=H-T-B,step=iw/7,bw=step*0.56;
  var y=function(v){return T+ih-(v/top)*ih};
  var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Kalorien der letzten sieben Tage im Vergleich zum Tagesziel von '+fmt(tg.k)+' kcal">';
  for(var v=0;v<=top;v+=500){s+='<line class="gl" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'"/>';if(v%1000===0)s+='<text x="'+(L-6)+'" y="'+(y(v)+3)+'" text-anchor="end">'+fmt(v)+'</text>'}
  days.forEach(function(x,idx){
    var cx=L+step*idx+step/2,h=(x.t.k/top)*ih;
    if(x.t.k>0)s+='<rect class="b-'+x.st+(x.o===0?' today':'')+'" x="'+(cx-bw/2)+'" y="'+y(x.t.k)+'" width="'+bw+'" height="'+h+'" rx="3"/><text x="'+cx+'" y="'+(y(x.t.k)-4)+'" text-anchor="middle">'+fmt(x.t.k)+'</text>';
    s+='<text x="'+cx+'" y="'+(H-8)+'" text-anchor="middle">'+(x.o===0?'Heute':WD[x.d.getDay()])+'</text>';
  });
  s+='<line class="tl" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(tg.k)+'" y2="'+y(tg.k)+'"/></svg>';
  var done=days.filter(function(x){return x.o>0&&x.t.k>0}),n=done.length||1;
  var avg=function(k){return done.reduce(function(a,x){return a+x.t[k]},0)/n};
  var pill={ok:'im Ziel',high:'zu hoch',low:'zu niedrig',none:'keine Einträge'};
  var rows=days.slice().reverse().map(function(x){
    var lab=x.d.toLocaleDateString('de-AT',{weekday:'short',day:'numeric',month:'short'});
    return '<button class="drow" data-act="hday" data-key="'+x.key+'"><span class="d"><b>'+esc(lab)+(x.o===0?' (heute)':'')+'</b><span class="sub mono">'+fmt(x.t.k)+' kcal</span></span><span class="pill '+x.st+'">'+(x.o===0&&x.st==='ok'?'läuft':pill[x.st])+'</span>'+CHR+'</button>';
  }).join('');
  return '<div class="card">'+s+'<div class="legend"><span><i style="background:var(--accent)"></i>im Ziel</span><span><i style="background:var(--warn)"></i>zu niedrig</span><span><i style="background:var(--bad)"></i>zu hoch</span><span><i style="border-top:2px dashed var(--ink);height:0;border-radius:0;width:14px;vertical-align:3px"></i>Ziel '+fmt(tg.k)+' kcal</span></div></div>'+
  '<div class="stats"><div class="stat"><p class="k">Ø Energie</p><p class="big">'+fmt(avg('k'))+' <small>kcal</small></p></div><div class="stat"><p class="k">Ø Eiweiß</p><p class="big">'+fmt(avg('p'))+' <small>g</small></p></div><div class="stat"><p class="k">Ø Kohlenhydrate</p><p class="big">'+fmt(avg('c'))+' <small>g</small></p></div><div class="stat"><p class="k">Ø Fett</p><p class="big">'+fmt(avg('f'))+' <small>g</small></p></div></div>'+
  '<p class="sub">Durchschnitt der abgeschlossenen Tage. Heute ist hell dargestellt, weil der Tag noch läuft.</p><div style="margin-top:14px">'+rows+'</div>';
}
function dayHTML(){
  var key=hk,off=Math.round((dateOf(dayKey(0))-dateOf(key))/864e5);
  var t=dayTotals(key),tg=targets(),ch=checks(t,tg,off===0);
  var label=dateOf(key).toLocaleDateString('de-AT',{weekday:'long',day:'numeric',month:'long'});
  return '<div class="dnav"><button class="icon-btn" data-act="dprev" aria-label="Vortag"'+(off>=6?' disabled':'')+'>'+CHL+'</button><b>'+esc(label)+'</b><button class="icon-btn" data-act="dnext" aria-label="Nächster Tag"'+(off<=0?' disabled':'')+'>'+CHR+'</button></div>'+
  ch.map(alertHTML).join('')+
  '<section class="card"><div class="sumrow"><span class="big">'+fmt(t.k)+' <small>kcal</small></span><span class="sub">Ziel '+fmt(tg.k)+' kcal</span></div>'+macro('Eiweiß',t.p,tg.p,'var(--p)')+macro('Kohlenhydrate',t.c,tg.c,'var(--c)')+macro('Fett',t.f,tg.f,'var(--f)')+'</section>'+mealList(key,false);
}
function vHist(){
  view.innerHTML='<h1>Verlauf</h1><div class="seg" role="group" aria-label="Zeitraum"><button data-act="hmode" data-m="week" aria-pressed="'+(hm==='week')+'">Woche</button><button data-act="hmode" data-m="day" aria-pressed="'+(hm==='day')+'">Tag</button></div>'+(hm==='week'?weekHTML():dayHTML());
}

/* ---------- Fasten ---------- */
function hms(ms){var s=Math.max(0,Math.floor(ms/1000));return pad(Math.floor(s/3600))+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60)}
var clock=function(ts){return new Date(ts).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})};
function fastState(){
  var F=S.fast,now=Date.now(),H=MODELS[F.model];
  if(F.model==='Ramadan'){
    var a1=F.from.split(':').map(Number),b1=F.to.split(':').map(Number),d=new Date();
    var a=new Date(d.getFullYear(),d.getMonth(),d.getDate(),a1[0],a1[1]).getTime(),b=new Date(d.getFullYear(),d.getMonth(),d.getDate(),b1[0],b1[1]).getTime();
    if(!(b>a))return {invalid:true};
    if(now>=a&&now<b)return {phase:'fast',total:b-a,elapsed:now-a,remain:b-now,from:a,to:b};
    var nextA=now<a?a:a+864e5,prevB=now>=b?b:b-864e5;
    return {phase:'eat',total:nextA-prevB,elapsed:now-prevB,remain:nextA-now,nextA:nextA};
  }
  var total=H*3600e3;
  if(!F.startTs)return {phase:'idle',total:total};
  var el=now-F.startTs;
  if(el>=total)return {phase:'done',total:total,elapsed:total,remain:0,over:el-total};
  return {phase:'fast',total:total,elapsed:el,remain:total-el,from:F.startTs,to:F.startTs+total};
}
function updateFast(){
  var el=$('#fTime');if(!el)return;
  var F=S.fast,st=fastState(),C=552.92,frac=0,col='var(--accent)',label='',time='',sub='';
  if(st.invalid){label='Zeiten prüfen';time='--:--:--';sub='Das Ende muss nach dem Beginn liegen.'}
  else if(st.phase==='idle'){label='Bereit';time=hms(st.total);sub=F.model+': '+MODELS[F.model]+' Stunden fasten'}
  else if(st.phase==='fast'){frac=st.elapsed/st.total;label='Noch bis zum Ende';time=hms(st.remain);sub='Seit '+clock(st.from)+' Uhr · Ende '+clock(st.to)+' Uhr'}
  else if(st.phase==='eat'){frac=st.elapsed/st.total;col='var(--c)';label='Essensfenster';time=hms(st.remain);sub='Nächstes Fasten um '+clock(st.nextA)+' Uhr'}
  else{frac=1;col='var(--good)';label='Ziel erreicht';time='+'+hms(st.over);sub=MODELS[F.model]+' Stunden geschafft'}
  var ring=$('#fRing');ring.setAttribute('stroke',col);ring.setAttribute('stroke-dasharray',(Math.min(1,frac)*C)+' '+C);
  $('#fLabel').textContent=label;el.textContent=time;$('#fSub').textContent=sub;
  var key=st.invalid?'invalid':st.phase;
  if(key!==lastPhase){
    lastPhase=key;var a='';
    if(F.model!=='Ramadan'){
      if(key==='idle')a='<button class="btn primary block" data-act="fstart">Fasten starten</button>';
      else if(key==='fast')a='<button class="btn block" data-act="fstop">Fasten beenden</button>';
      else if(key==='done')a='<button class="btn primary block" data-act="fstop">Neu starten</button>';
    }
    $('#fAct').innerHTML=a;
  }
}
function vFast(){
  var F=S.fast,running=F.model!=='Ramadan'&&F.startTs&&fastState().phase==='fast';
  var desc=F.model==='Ramadan'?'Fasten von Sonnenaufgang bis Sonnenuntergang. Trage die Zeiten für deinen Ort ein.':MODELS[F.model]+' Stunden fasten, '+(24-MODELS[F.model])+' Stunden essen.';
  lastPhase=null;
  view.innerHTML='<h1>Fasten</h1><div class="chips" style="margin-top:0" role="group" aria-label="Fastenmodell">'+Object.keys(MODELS).map(function(m){return '<button class="chip" data-act="fmodel" data-m="'+m+'" aria-pressed="'+(F.model===m)+'"'+(running&&F.model!==m?' disabled':'')+'>'+m+'</button>'}).join('')+'</div>'+
  '<p class="sub" style="margin-top:12px">'+desc+'</p>'+
  '<div class="fring"><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="88" fill="none" stroke="var(--line)" stroke-width="14"/><circle id="fRing" cx="100" cy="100" r="88" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round" stroke-dasharray="0 552.92" transform="rotate(-90 100 100)"/></svg><div class="mid"><span id="fLabel"></span><b id="fTime" class="mono"></b><span id="fSub"></span></div></div>'+
  (F.model==='Ramadan'?'<div class="times"><label class="fld">Beginn (Fajr)<input class="in" id="rf" type="time" value="'+esc(F.from)+'"></label><label class="fld">Ende (Maghrib)<input class="in" id="rt" type="time" value="'+esc(F.to)+'"></label></div>':'')+
  '<div id="fAct"></div>';
  updateFast();clearInterval(tick);tick=setInterval(updateFast,1000);
}

/* ---------- Profil ---------- */
function targetHTML(){
  var tg=targets();
  return '<p class="k">Tagesziel</p><p class="big">'+fmt(tg.k)+' <small>kcal</small></p><dl><dt>Grundumsatz</dt><dd class="mono">'+fmt(tg.bmr)+' kcal</dd><dt>Gesamtumsatz</dt><dd class="mono">'+fmt(tg.tdee)+' kcal</dd><dt>Eiweiß</dt><dd class="mono">'+fmt(tg.p)+' g</dd><dt>Kohlenhydrate</dt><dd class="mono">'+fmt(tg.c)+' g</dd><dt>Fett</dt><dd class="mono">'+fmt(tg.f)+' g</dd></dl>'+
 ``;
}
function vProfile(){
  var pr=S.profile,opt=function(v,l,sel){return '<option value="'+v+'"'+(sel?' selected':'')+'>'+l+'</option>'};
  view.innerHTML='<h1>Profil und Tagesziel</h1><section class="card form">'+
  '<div class="grid2"><label class="fld">Geschlecht<select class="in" data-pr="sex">'+opt('m','Männlich',pr.sex==='m')+opt('w','Weiblich',pr.sex==='w')+'</select></label>'+
  '<label class="fld">Alter<input class="in" type="number" inputmode="numeric" min="12" max="100" data-pr="age" value="'+esc(pr.age)+'"></label>'+
  '<label class="fld">Größe (cm)<input class="in" type="number" inputmode="numeric" min="120" max="230" data-pr="h" value="'+esc(pr.h)+'"></label>'+
  '<label class="fld">Gewicht (kg)<input class="in" type="number" inputmode="decimal" min="35" max="250" data-pr="w" value="'+esc(pr.w)+'"></label></div>'+
  '<label class="fld">Aktivität<select class="in" data-pr="act">'+ACT.map(function(a,i){return opt(i,a.l,pr.act===i)}).join('')+'</select></label>'+
  '<label class="fld">Ziel<select class="in" data-pr="goal">'+opt('abnehmen','Abnehmen',pr.goal==='abnehmen')+opt('halten','Gewicht halten',pr.goal==='halten')+opt('zunehmen','Zunehmen',pr.goal==='zunehmen')+'</select></label></section>'+
  '<section class="card tgt" id="tgt" style="margin-top:14px">'+targetHTML()+'</section>'+
  '<p class="note">Alles läuft lokal in deinem Browser. Das Zurücksetzen löscht eigene Einträge, Produkte und Einstellungen.</p><div style="margin-top:10px"><button class="btn" data-act="resetall">Prototyp zurücksetzen</button></div>';
}

/* ---------- Aktionen ---------- */
var ACTIONS={
  del:function(t){var id=t.dataset.id;if(id.charAt(0)==='e'){if(S.rm.indexOf(id)<0)S.rm.push(id)}else S.ue=S.ue.filter(function(e){return e.id!==id});save();render();toast('Eintrag entfernt.')},
  addmeal:function(t){pendMeal=Number(t.dataset.m);tab='find';clearInterval(tick);render();window.scrollTo(0,0)},
  scan:function(){sc={step:1,bc:'',vals:{},flag:null};showSheet(scanHTML())},
  open:function(t){openProduct(t.dataset.id)},
  close:function(){closeSheet()},
  filt:function(t){filt=t.dataset.f;vFind();var b=document.querySelector('[data-f="'+filt+'"]');if(b)b.focus()},
  mode:function(t){var p=prod(cur.id),g=grams();cur.mode=t.dataset.m;cur.val=cur.mode==='p'?Math.max(0.5,Math.round(g/p.por[1]*2)/2):Math.round(g)||100;showSheet(productHTML())},
  qg:function(t){cur.val=Number(t.dataset.v);var i=$('#pv');if(i)i.value=cur.val;$('#pcalc').innerHTML=calcHTML()},
  fav:function(){var i=S.favs.indexOf(cur.id);if(i<0)S.favs.push(cur.id);else S.favs.splice(i,1);save();showSheet(productHTML())},
  addcur:function(){
    var g=grams();if(!(g>0)){toast('Bitte eine Menge größer als 0 eingeben.');return}
    var p=prod(cur.id),k=nut(cur.id,g).k,m=cur.meal;
    S.ue.push({id:'u'+Date.now(),d:dayKey(0),m:m,pid:cur.id,g:Math.round(g*10)/10});save();pendMeal=null;closeSheet();go('today');
    toast(p.name+' zu '+MEALS[m]+' hinzugefügt (+'+fmt(k)+' kcal).');
  },
  scanbc:function(){
    var bc=SIM_BC[scanIdx++%SIM_BC.length],ex=products().find(function(p){return p.bc===bc});
    if(ex)return openExisting(ex);
    sc.bc=bc;sc.step=2;showSheet(scanHTML());
  },
  scanmanual:function(){
    var v=($('#bcIn').value||'').replace(/\D/g,'');
    if(v.length<8)return scMsg('Bitte mindestens 8 Ziffern eingeben.');
    var ex=products().find(function(p){return p.bc===v});
    if(ex)return openExisting(ex);
    sc.bc=v;sc.step=2;showSheet(scanHTML());
  },
  skipbc:function(){sc.bc='';sc.step=2;showSheet(scanHTML())},
  scanback:function(){sc.step=1;showSheet(scanHTML())},
  scanocr:function(){
    var o=OCR[ocrIdx++%OCR.length],s=function(x){return String(x).replace('.',',')};
    sc.vals={name:'',brand:'',bc:sc.bc,k:s(o.k),f:s(o.f),c:s(o.c),s:s(o.s),p:s(o.p),t:s(o.t)};sc.flag=o.flag;sc.step=3;showSheet(scanHTML());
  },
  rescan:function(){sc.step=2;showSheet(scanHTML())},
  savep:function(){
    var v=sc.vals,P=function(k){return parseFloat(String(v[k]).replace(',','.'))},name=(v.name||'').trim();
    if(!name)return scMsg('Bitte einen Produktnamen eingeben.');
    var labels={k:'Energie',f:'Fett',c:'Kohlenhydrate',s:'Zucker',p:'Eiweiß',t:'Salz'};
    for(var k in labels){if(!isFinite(P(k))||P(k)<0)return scMsg('Bitte einen gültigen Wert für '+labels[k]+' eingeben.')}
    if(P('f')+P('c')+P('p')>100)return scMsg('Fett, Kohlenhydrate und Eiweiß ergeben zusammen mehr als 100 g pro 100 g. Bitte Werte prüfen.');
    if(P('s')>P('c'))return scMsg('Zucker kann nicht höher sein als die Kohlenhydrate.');
    var bc=(v.bc||'').replace(/\D/g,'');
    if(bc&&products().some(function(p){return p.bc===bc}))return scMsg('Zu diesem Barcode gibt es schon ein Produkt in der Datenbank.');
    var id='u'+Date.now();
    S.up.push({id:id,bc:bc,name:name,brand:(v.brand||'').trim()||'ohne Marke',k:P('k'),f:P('f'),c:P('c'),s:P('s'),p:P('p'),t:P('t'),por:null});save();
    openProduct(id);toast('Neues Produkt für alle Nutzer gespeichert.');
    if(tab==='find')drawResults();
  },
  hmode:function(t){hm=t.dataset.m;vHist()},
  hday:function(t){hk=t.dataset.key;hm='day';vHist();window.scrollTo(0,0)},
  dprev:function(){var o=Math.round((dateOf(dayKey(0))-dateOf(hk))/864e5);if(o<6){hk=dayKey(o+1);vHist()}},
  dnext:function(){var o=Math.round((dateOf(dayKey(0))-dateOf(hk))/864e5);if(o>0){hk=dayKey(o-1);vHist()}},
  fmodel:function(t){S.fast.model=t.dataset.m;save();vFast()},
  fstart:function(){S.fast.startTs=Date.now();save();vFast()},
  fstop:function(){S.fast.startTs=null;save();vFast()},
  resetall:function(){S=DEF();save();closeSheet();q='';filt='all';render();toast('Prototyp zurückgesetzt.')}
};
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act],[data-tab]');if(!t)return;
  if(t.dataset.tab){go(t.dataset.tab);return}
  var f=ACTIONS[t.dataset.act];if(f)f(t,e);
});
sheet.addEventListener('click',function(e){if(e.target===sheet)closeSheet()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!sheet.hidden)closeSheet()});
document.addEventListener('input',function(e){
  var t=e.target;
  if(t.id==='q'){q=t.value;drawResults()}
  else if(t.id==='pv'){cur.val=t.value;$('#pcalc').innerHTML=calcHTML()}
  else if(t.id==='pm'){cur.meal=Number(t.value)}
  else if(t.dataset.sf){sc.vals[t.dataset.sf]=t.value}
  else if(t.dataset.pr){
    var k=t.dataset.pr,pr=S.profile;
    if(k==='sex'||k==='goal')pr[k]=t.value;
    else if(k==='act')pr.act=Number(t.value);
    else{var n=parseFloat(t.value);if(isFinite(n))pr[k]=n}
    save();$('#tgt').innerHTML=targetHTML();
  }
  else if(t.id==='rf'||t.id==='rt'){
    if(/^\d\d:\d\d$/.test(t.value)){S.fast[t.id==='rf'?'from':'to']=t.value;save();updateFast()}
  }
});
render();
})();
