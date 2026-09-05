const defaults = {
  hp: {now:14,max:14},
  abilities:[['FOR',6],['DEX',17],['CON',9],['INT',13],['SAG',9],['CHA',17]],
  skills:[
    {name:'Acrobaties',bonus:6},{name:'Bluff',bonus:7},{name:'Crochetage',bonus:6},
    {name:'Discrétion',bonus:7},{name:'Déplacement silencieux',bonus:7},{name:'Escamotage',bonus:8},{name:'Évasion',bonus:6}
  ],
  saves:[{name:'Réflexes',bonus:5},{name:'Vigueur',bonus:-1},{name:'Volonté',bonus:1}],
  combat:[
    {name:'Arbalète légère',bonus:4,damage:'1d6',note:'taille P · 24 m · 19–20/x2',min1:true},
    {name:'Dague',bonus:4,damage:'1d3-2',note:'taille P · 3 m · 19–20/x2',min1:true},
    {name:'Attaque sournoise',bonus:null,damage:'1d6',note:'dégâts supplémentaires'}
  ],
  spells:[
    {kind:'spell',name:'Détection de la magie',level:'N0',description:''},
    {kind:'spell',name:'Prestidigitation',level:'N0',description:''},
    {kind:'spell',name:'Claque sonique',level:'N0',description:''},
    {kind:'spell',name:'Manipulation à distance',level:'N0',description:''},
    {kind:'spell',name:'Armure de mage',level:'N1',description:''},
    {kind:'spell',name:'Rayon de flamme',level:'N1',description:''}
  ],
  feats:[
    {kind:'feat',name:'Kobold Cœur-de-dragon',source:'Races of Dragon',description:'Type Dragon ; immunité sommeil/paralysie ; héritage de cuivre.'},
    {kind:'feat',name:'Robustesse draconique',source:'Races of Dragon',description:'+2 PV par don draconique selon le profil validé.'},
    {kind:'feat',name:'Vigueur draconique',source:'Dragon Magic',description:'Vigueur liée au lancement de sorts profanes.'}
  ],
  familiarNotes:''
};

const KEY='ancalagon-companion-v0';
const FEAT_PAGES=[
  '/dons/dons-general.htm','/dons/dons-draconique.htm','/dons/dons-background.htm',
  '/dons/dons-racial.htm','/dons/dons-livres-DRM.htm','/dons/dons-livres-ROD.htm','/dons/dons-livres-CP.htm'
];
const GEM='https://www.gemmaline.com';
let state=load();
let gemKind='spell';

function clone(v){return JSON.parse(JSON.stringify(v))}
function load(){try{return {...clone(defaults),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return clone(defaults)}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function mod(v){return Math.floor((v-10)/2)}
function sign(v){return v>=0?`+${v}`:`${v}`}

function render(){
  $('#hpNow').textContent=state.hp.now; $('#hpMax').textContent=state.hp.max; $('#hpSlider').max=state.hp.max; $('#hpSlider').value=state.hp.now;
  $('#abilities').innerHTML=state.abilities.map(([n,v])=>`<article class="card ability"><span>${n}</span><b>${v}</b><small>${sign(mod(v))}</small></article>`).join('');
  $('#skills').innerHTML=state.skills.map((s,i)=>`<article class="list-item"><div class="bonus">${sign(s.bonus)}</div><div class="grow"><b>${esc(s.name)}</b><small>1d20 ${sign(s.bonus)}</small></div><button class="rollbtn" data-skill="${i}">🎲</button><button class="deletebtn" data-del-skill="${i}">×</button></article>`).join('');
  $('#combatList').innerHTML=state.combat.map((a,i)=>`<article class="list-item"><div class="grow"><b>${esc(a.name)}</b><small>${esc(a.note||'')} · dégâts ${esc(a.damage)}</small></div>${a.bonus===null?'':`<button class="rollbtn" data-attack="${i}">Atk ${sign(a.bonus)}</button>`}<button class="rollbtn" data-damage="${i}">Dgts</button></article>`).join('');
  $('#saves').innerHTML=state.saves.map(s=>`<button class="quick tap-roll" data-roll="1d20${sign(s.bonus)}" data-label="${escAttr(s.name)}"><b>${esc(s.name)}</b><span>${sign(s.bonus)}</span></button>`).join('');
  $('#spells').innerHTML=state.spells.map((x,i)=>itemRow(x,i,'spell')).join('');
  $('#feats').innerHTML=state.feats.map((x,i)=>itemRow(x,i,'feat')).join('');
  $('#familiarNotes').value=state.familiarNotes||'';
  bindDynamic();
}
function itemRow(x,i,kind){const meta=[x.level,x.school,x.source].filter(Boolean).join(' · ');return `<article class="list-item"><div class="grow"><b>${esc(x.name)}</b><small>${esc(meta||'Fiche locale')}</small></div><button class="detailbtn" data-detail-kind="${kind}" data-detail="${i}">Voir</button>${x.url?`<button class="deletebtn" data-del-item="${kind}:${i}">×</button>`:''}</article>`}

function bindDynamic(){
  $$('[data-skill]').forEach(b=>b.onclick=e=>{const s=state.skills[+b.dataset.skill];rollAt(`1d20${sign(s.bonus)}`,s.name,e)});
  $$('[data-del-skill]').forEach(b=>b.onclick=()=>{state.skills.splice(+b.dataset.delSkill,1);save();render()});
  $$('[data-attack]').forEach(b=>b.onclick=e=>{const a=state.combat[+b.dataset.attack];rollAt(`1d20${sign(a.bonus)}`,a.name,e)});
  $$('[data-damage]').forEach(b=>b.onclick=e=>{const a=state.combat[+b.dataset.damage];rollAt(a.damage,`${a.name} — dégâts`,e,{min1:!!a.min1})});
  $$('[data-detail]').forEach(b=>b.onclick=()=>showDetail(state[b.dataset.detailKind==='spell'?'spells':'feats'][+b.dataset.detail]));
  $$('[data-del-item]').forEach(b=>b.onclick=()=>{const [k,i]=b.dataset.delItem.split(':'); state[k==='spell'?'spells':'feats'].splice(+i,1);save();render()});
  bindTapRolls();
}
function bindTapRolls(){$$('.tap-roll').forEach(b=>b.onclick=e=>rollAt(b.dataset.roll,b.dataset.label,e))}

function parseDice(formula){
  const clean=formula.replace(/\s/g,'').toLowerCase(); let total=0, parts=[];
  const tokens=clean.match(/[+-]?[^+-]+/g)||[];
  for(const t of tokens){let s=t.startsWith('-')?-1:1, body=t.replace(/^[+-]/,''); if(body.includes('d')){const [n0,d0]=body.split('d'),n=+(n0||1),d=+d0;let rolls=[];for(let i=0;i<n;i++)rolls.push(1+Math.floor(Math.random()*d));let v=rolls.reduce((a,b)=>a+b,0)*s;total+=v;parts.push(`${s<0?'-':''}[${rolls.join(', ')}]`)}else{const v=(+body||0)*s;total+=v;parts.push(sign(v))}}
  return {total,detail:parts.join(' ')};
}
function rollAt(formula,label,event,opts={}){const r=parseDice(formula);if(opts.min1&&r.total<1){r.detail+=' → minimum 1';r.total=1;} const pop=document.createElement('div');pop.className='dice-pop';pop.innerHTML=`${esc(label)} : 🎲 <strong>${r.total}</strong><small>${esc(formula)} → ${esc(r.detail)}</small>`;document.body.appendChild(pop);const x=event?.clientX??innerWidth/2,y=event?.clientY??innerHeight/2;requestAnimationFrame(()=>{const w=pop.offsetWidth,h=pop.offsetHeight;pop.style.left=Math.max(8,Math.min(innerWidth-w-8,x+10))+'px';pop.style.top=Math.max(8,Math.min(innerHeight-h-90,y-h/2))+'px'});setTimeout(()=>pop.remove(),10000)}

function showDetail(x){const rows=[['Niveau',x.level],['École',x.school],['Composantes',x.components],['Incantation',x.casting_time],['Portée',x.range],['Durée',x.duration],['JS',x.save],['RM',x.spell_resistance],['Conditions',x.conditions],['Source',x.source]].filter(([,v])=>v);$('#dialogBody').innerHTML=`<h2>${esc(x.name)}</h2><div class="kv">${rows.map(([k,v])=>`<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div><div class="desc">${esc(x.description||'Aucune description détaillée enregistrée.')}</div>${x.url?`<p><a class="source-link" href="${escAttr(x.url)}">Voir la source Gemmaline ↗</a></p>`:''}`;$('#detailDialog').showModal()}

const pendingNative=new Map();
window.__nativeFetchResolve=(id,body,error)=>{const p=pendingNative.get(id);if(!p)return;pendingNative.delete(id);if(error)p.reject(new Error(error));else p.resolve(body)};
function nativeFetchText(url){
  if(!window.AndroidBridge?.fetchGemmaline) return fetch(url).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text()});
  return new Promise((resolve,reject)=>{const id=`g${Date.now()}_${Math.random().toString(36).slice(2)}`;pendingNative.set(id,{resolve,reject});window.AndroidBridge.fetchGemmaline(url,id);setTimeout(()=>{if(pendingNative.has(id)){pendingNative.delete(id);reject(new Error('Délai dépassé en contactant Gemmaline.'))}},25000)});
}
function normText(s=''){return String(s).replace(/œ/gi,m=>m==='Œ'?'OE':'oe').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}
function compact(s=''){return String(s).replace(/\s+/g,' ').trim()}
function parseHtml(html){return new DOMParser().parseFromString(html,'text/html')}
function findHeading(doc,q){const nq=normText(q),heads=[...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')];return heads.find(h=>normText(h.textContent).startsWith(nq))||heads.find(h=>normText(h.textContent).includes(nq))||null}
function siblingBlock(h){const level=Number(h.tagName.slice(1));let chunks=[];for(let el=h.nextSibling;el;el=el.nextSibling){if(el.nodeType===1&&/^H[1-6]$/.test(el.tagName)&&Number(el.tagName.slice(1))<=level)break;const t=compact(el.innerText||el.textContent||'');if(t)chunks.push(t);if(chunks.join('\n').length>9000)break}return chunks.join('\n')}
function parseFields(text,keys){const out={};for(const key of keys){const next=keys.filter(k=>k!==key).map(regexEscape).join('|');const re=new RegExp(`(?:^|\\n|\\s)${regexEscape(key)}\\s*:\\s*(.*?)(?=(?:\\n|\\s)(?:${next})\\s*:|$)`,'is');const m=text.match(re);if(m)out[key]=compact(m[1])}return out}
function regexEscape(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function cleanFeatName(s){return compact(s).replace(/\s*\[[^\]]+\]\s*$/,'').trim()}

function parseSpellDoc(doc,q,url){const h=findHeading(doc,q);if(!h)return null;const name=compact(h.textContent),block=siblingBlock(h);let school='';for(const line of block.split('\n')){const s=compact(line);if(s&&!s.includes(':')&&s.length<140){school=s;break}}const f=parseFields(block,['Niveau','Composantes',"Temps d'incantation",'Portée','Durée','Jet de sauvegarde','Résistance à la magie','Source']);return {kind:'spell',name,school,level:f.Niveau||'',components:f.Composantes||'',casting_time:f["Temps d'incantation"]||'',range:f.Portée||'',duration:f.Durée||'',save:f['Jet de sauvegarde']||'',spell_resistance:f['Résistance à la magie']||'',source:f.Source||'',description:block,url}}
function parseFeatDoc(doc,q,url){let h=findHeading(doc,q);if(!h){const title=doc.querySelector('h1,h2');if(title&&normText(title.textContent).includes(normText(q)))h=title;else return null}const name=cleanFeatName(h.textContent),block=siblingBlock(h);const f=parseFields(block,['Conditions','Condition','Avantages','Avantage','Normal','Spécial','Source','Race']);const conditions=f.Conditions||f.Condition||'',adv=f.Avantages||f.Avantage||'';let desc=[];if(adv)desc.push(adv);for(const k of ['Normal','Spécial','Race'])if(f[k])desc.push(`${k}: ${f[k]}`);return {kind:'feat',name,conditions,source:f.Source||'',description:desc.join('\n')||block,url}}
function letterFor(q){const n=normText(q);if(!/^[a-z]/.test(n))throw new Error('La recherche doit commencer par une lettre A-Z.');return n[0]}
async function nativeSearch(kind,q){if(kind==='spell'){const letter=letterFor(q),url=`${GEM}/sorts/sort-${letter}.htm`,html=await nativeFetchText(url),item=parseSpellDoc(parseHtml(html),q,url);return item?[item]:[]}for(const path of FEAT_PAGES){const url=GEM+path;try{const html=await nativeFetchText(url),item=parseFeatDoc(parseHtml(html),q,url);if(item)return [item]}catch(e){console.warn(e)}}return []}
function validateGemUrl(url){let u;try{u=new URL(url)}catch{throw new Error('URL Gemmaline invalide.')}const host=u.hostname.toLowerCase();if(u.protocol!=='https:'||!['gemmaline.com','www.gemmaline.com'].includes(host)||!(u.pathname.startsWith('/sorts/')||u.pathname.startsWith('/dons/')))throw new Error('Seules les URL HTTPS de dons ou sorts Gemmaline sont autorisées.');return u.toString()}
async function nativeImport(raw,q){const url=validateGemUrl(raw),html=await nativeFetchText(url),doc=parseHtml(html),kind=new URL(url).pathname.startsWith('/dons/')?'feat':'spell';let query=q.trim();if(!query){query=compact(doc.querySelector('h1,h2,title')?.textContent||'').replace(/\s*[-|].*$/,'').trim()}const item=kind==='feat'?parseFeatDoc(doc,query,url):parseSpellDoc(doc,query,url);if(!item)throw new Error("Je n'ai pas réussi à identifier l'élément sur cette page. Indique aussi son nom dans le champ de recherche.");return item}

async function gemSearch(){const q=$('#gemQuery').value.trim();if(q.length<2)return setStatus('Entre au moins 2 caractères.',true);setStatus('Recherche…');$('#gemResults').innerHTML='';try{let items;if(window.AndroidBridge?.fetchGemmaline){items=await nativeSearch(gemKind,q)}else{const r=await fetch(`/api/gemmaline/search?kind=${encodeURIComponent(gemKind)}&q=${encodeURIComponent(q)}`);const data=await r.json();if(!r.ok)throw new Error(data.detail||'Erreur réseau');items=data.items||[]}renderGem(items);setStatus(items.length?'Résultat trouvé.':gemKind==='feat'?"Aucun résultat dans les pages de dons ciblées. Essaie l'import par URL.":'Aucun résultat.',false)}catch(e){setStatus(e.message||String(e),true)}}
async function gemImportUrl(){const url=$('#gemUrl').value.trim(),q=$('#gemQuery').value.trim();if(!url)return setStatus('Colle une URL Gemmaline.',true);setStatus('Import de la page…');try{let item;if(window.AndroidBridge?.fetchGemmaline){item=await nativeImport(url,q)}else{const r=await fetch(`/api/gemmaline/import?url=${encodeURIComponent(url)}&q=${encodeURIComponent(q)}`);const data=await r.json();if(!r.ok)throw new Error(data.detail||'Erreur');item=data.item}renderGem([item]);setStatus('Page analysée.',false)}catch(e){setStatus(e.message||String(e),true)}}
function renderGem(items){$('#gemResults').innerHTML=items.map((x,i)=>`<article class="list-item"><div class="grow"><b>${esc(x.name)}</b><small>${esc([x.level,x.conditions,x.source].filter(Boolean).join(' · '))}</small></div><button class="detailbtn" data-gem-view="${i}">Voir</button><button class="primary" data-gem-add="${i}">Ajouter</button></article>`).join('');window._gemItems=items;$$('[data-gem-view]').forEach(b=>b.onclick=()=>showDetail(items[+b.dataset.gemView]));$$('[data-gem-add]').forEach(b=>b.onclick=()=>addGem(items[+b.dataset.gemAdd]))}
function addGem(x){const dest=x.kind==='spell'?'spells':'feats';if(state[dest].some(i=>i.name.toLocaleLowerCase()===x.name.toLocaleLowerCase()))return setStatus(`${x.name} est déjà dans la fiche.`,true);state[dest].push(x);save();render();setStatus(`${x.name} ajouté à la fiche.`,false)}
function setStatus(t,err=false){$('#gemStatus').textContent=t;$('#gemStatus').className='status'+(err?' error':'')}

$$('.bottomnav button').forEach(b=>b.onclick=()=>{$$('.bottomnav button').forEach(x=>x.classList.toggle('active',x===b));$$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===b.dataset.target));scrollTo({top:0,behavior:'smooth'})});
$$('[data-kind]').forEach(b=>b.onclick=()=>{gemKind=b.dataset.kind;$$('[data-kind]').forEach(x=>x.classList.toggle('active',x===b))});
$$('[data-hp]').forEach(b=>b.onclick=()=>{state.hp.now=Math.max(0,Math.min(state.hp.max,state.hp.now+(+b.dataset.hp)));save();render()});
$('#hpSlider').oninput=e=>{state.hp.now=+e.target.value;save();$('#hpNow').textContent=state.hp.now};
$('#addSkill').onclick=()=>{const name=prompt('Nom de la compétence ?');if(!name)return;const bonus=Number(prompt('Bonus total ?', '0'));if(Number.isNaN(bonus))return;state.skills.push({name,bonus});save();render()};
$('#familiarNotes').oninput=e=>{state.familiarNotes=e.target.value;save()};
$('#gemSearch').onclick=gemSearch;$('#gemImportUrl').onclick=gemImportUrl;$('#gemQuery').onkeydown=e=>{if(e.key==='Enter')gemSearch()};
$('#dialogClose').onclick=()=>$('#detailDialog').close();
bindTapRolls();render();

function $(s){return document.querySelector(s)}function $$(s){return [...document.querySelectorAll(s)]}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function escAttr(s=''){return esc(s)}
