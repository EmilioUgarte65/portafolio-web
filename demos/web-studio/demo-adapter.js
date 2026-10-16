/* Datos sintéticos: la UI original trabaja sobre un proyecto en memoria. */
(async()=>{
const nativeFetch=window.fetch.bind(window);
let markReady;const ready=new Promise(resolve=>markReady=resolve);
const initial=await nativeFetch('seed.json').then(r=>r.json());let state=structuredClone(initial),rev=1;Object.assign(state,{id:'horizontes-demo',nombre:'Proyecto de ejemplo',tiene_plan:true,historial:[],salidas:{}});
const reply=(v,status=200)=>Promise.resolve(new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}}));
function view(){
 let t=0;state.vista.grupos=(state.plan.timeline||[]).map((g,gi)=>{const start=t;const tomas=(g.tomas||[]).map((c,k)=>{const old=initial.vista.grupos?.[0]?.tomas?.[0]||{};const x={...old,...c,g:gi,k,ti:k,si:null,t0:t,dur:c.dur,consumo:c.dur,efectos:[]};t+=c.dur;return x});return {g:gi,id:g.id,etiqueta:g.etiqueta,t0:start,dur:t-start,tomas,efectos:[]}});state.vista.total=t;
 state.vista.overlays=(state.plan.overlays||[]).map((o,i)=>({i,id:o.id,tipo:'texto',etiqueta:o.texto,t_in:o.t_in||0,t_out:typeof o.t_out==='number'?o.t_out:t,fin:o.t_out==='fin',pista:o.pista||1,anim:o.anim||'fade',escala:o.escala||1,opacidad:1,keyframes:[]}));state.vista.marcadores=(state.plan.marcadores||[]).map((m,i)=>({...m,i}));state.hash='demo-'+(++rev);return state;
}
function operation(o){
 if(!o)return;if(o.op==='lote'){o.ops.forEach(operation);return}
 const g=state.plan.timeline[o.g||0],take=g?.tomas[o.k||0];
 if(o.op==='toma_props'&&take)Object.assign(take,o.props);
 else if(o.op==='toma_duplicar'&&take)g.tomas.splice(o.k+1,0,structuredClone(take));
 else if(o.op==='toma_borrar'&&take)g.tomas.splice(o.k,1);
 else if(o.op==='toma_insertar')g.tomas.splice(o.k,0,structuredClone(o.toma));
 else if(o.op==='toma_recortar'&&take){const d=o.delta||0;take.dur=Math.max(.1,take.dur+(o.lado==='inicio'?-d:d));if(o.lado==='inicio')take.inicio=Math.max(0,(take.inicio||0)+d)}
 else if(o.op==='toma_dividir'){for(const grp of state.vista.grupos){const x=grp.tomas.find(x=>o.t>x.t0&&o.t<x.t0+x.dur);if(x){const a=state.plan.timeline[x.g].tomas[x.k],b=structuredClone(a),cut=o.t-x.t0;b.inicio=(a.inicio||0)+cut;b.dur=a.dur-cut;a.dur=cut;state.plan.timeline[x.g].tomas.splice(x.k+1,0,b);break}}}
 else if(o.op==='lista_nuevo'){const key=o.lista;(state.plan[key]??=[]).push(structuredClone(o.item))}
 else if(o.op==='lista_props'){const x=state.plan[o.lista]?.[o.i];if(x)Object.assign(x,o.props)}
 else if(o.op==='lista_borrar')state.plan[o.lista]?.splice(o.i,1);
 else if(o.op==='lista_duplicar'){const x=structuredClone(state.plan[o.lista][o.i]);state.plan[o.lista].push(x)}
 else if(o.op==='seccion_props'){const parts=o.seccion.split('.');let obj=state.plan;for(const part of parts)obj=obj[part]??={};Object.assign(obj,o.props);if(o.seccion==='proyecto.look')state.vista.look=obj}
 else throw Error('Esta operación usa el motor de la aplicación completa. En esta demo puedes reproducir, cortar, duplicar, borrar y editar texto.');
 view();
}
window.fetch=(input,init={})=>{
 const raw=typeof input==='string'?input:input.url,url=new URL(raw,location.href),p=url.pathname;
 if(!p.startsWith('/api/')){
  if(url.origin===location.origin&&!p.startsWith('/openapi'))return nativeFetch(input,init);
  return reply({},403);
 }
 
 const profile={id:'principal',nombre:'Perfil demo',color:'#BCA3FF',avatar:'D',prefs:{},sesion:{},estilo:{}};
 if(p==='/api/proyectos')return ready.then(()=>reply({proyectos:[{id:'horizontes-demo',nombre:'Proyecto demo',modificado:new Date().toISOString(),medios:1,tiene_plan:true,salida:null}],perfil:profile,raiz:'Espacio de demostración'}));
 if(p==='/api/perfiles/actual')return reply(profile);
 if(p==='/api/perfiles')return reply({actual:'principal',perfiles:[profile],preguntar_al_iniciar:false});
 if(p==='/api/uso')return reply({llamadas:[]});
 if(p==='/api/ajustes/primer-arranque')return reply({faltan:[]});
 if(p.endsWith('/estado'))return reply({ocupado:false,tarea:null,estado:'listo',pct:0,plan:true,errores:[]});
 if(p.endsWith('/chat'))return reply({mensajes:[],eventos:[]});
 if(p.includes('/chat/')||p.includes('/perfiles/actual/'))return reply({ok:true});
 if(p==='/api/plantillas')return reply({plantillas:[]});

 if(p==='/api/editor/modulos')return reply({modulos:[]});
 if(p==='/api/editor/catalogo')return reply({efectos:[],presets:[],transiciones:[],anims:[],anims_schema:[],tipografias:[],categorias:{}});
 if(p.endsWith('/editor/op')){try{const data=JSON.parse(init.body||'{}');operation(data.op);const sel=data.op?.op==='lista_nuevo'?{tipo:data.op.lista,i:state.plan[data.op.lista].length-1}:undefined;return reply({...structuredClone(state),info:{desc:'Edición local de demostración',sel}})}catch(e){return reply({detail:e.message},422)}}
 if(p.endsWith('/editor/plan')){state.plan=JSON.parse(init.body).plan;view();return reply(state)}
 if(p.endsWith('/editor/overlays_todos')||p.endsWith('/editor/overlays'))return reply({overlays:state.plan.overlays.map((o,i)=>{const text=String(o.texto||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="180"><text x="450" y="110" text-anchor="middle" font-family="Arial,sans-serif" font-size="75" font-weight="700" fill="white" stroke="#211637" stroke-width="1">${text}</text></svg>`;return {...state.vista.overlays[i],url:'data:image/svg+xml,'+encodeURIComponent(svg),cx:640,cy:360,w:900,h:180,escala:1,rotacion:0,opacidad:1,anim:o.anim||'fade',dur:Math.max(.1,o.t_out-o.t_in),keyframes:[]}})});
 if(p.includes('/proxies'))return reply({proxies:{escena:{estado:'listo'}}});
 if(p.endsWith('/editor/versiones'))return reply({versiones:[]});
 if(/\/api\/proyectos\/[^/]+$/.test(p))return ready.then(()=>reply(structuredClone(state)));
 if(p.endsWith('/editor')||/\/api\/proyectos\/[^/]+$/.test(p))return reply(structuredClone(state));
 return reply({detail:'Disponible en la aplicación completa. Esta demo muestra el frontend sin servicios conectados.'},403);
};

sessionStorage.setItem('wdvs-tour-visto','1');sessionStorage.setItem('wdvs-perfil-ok','principal');
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.append(s)});
for(const src of ['app.js','chat.js','editor.js','estilo_panel.js','plugins_panel.js','perfiles.js','colab.js'])await load(src);
window.__demoStudioReady=true;markReady();
})();
