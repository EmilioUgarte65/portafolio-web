/* Datos ficticios; conserva íntegra la interfaz original del portal. */
(()=>{
const today=new Date().toISOString().slice(0,10),contacts=[],assignments=[];
const rows=Array.from({length:8},(_,i)=>({customer_no:'DEMO-'+String(i+1).padStart(2,'0'),customer_name:'Cliente de ejemplo '+(i+1),store_no:i%2?'DEMO-B':'DEMO-A',salesperson_code:'Equipo demo',recency_segment:['En ventana','Vencido','En riesgo','Probable perdida'][i%4],last_purchase:today,estimated_next_purchase:today,average_gap_days:14+i,days_since_last:15+i*3,overdue_ratio:1+i*.2,priority_score:95-i*6,priority:95-i*6,purchase_count:12+i,net_sales:12500+i*1700,total_sales:12500+i*1700,average_ticket:1500+i*100,estimated_purchase:1500+i*100,opportunity_value:1500+i*100,expected_margin:350+i*50,reason:'Ejemplo de priorización con datos ficticios',reasons:['Cadencia de ejemplo','Historial sintético'],phone:'',whatsapp_phone:'',privacy_blocked:true,behavior_segment:'Recurrente',customer_group:'Grupo demo',offer:'Seguimiento de ejemplo'}));
const quotes=rows.slice(0,3).map((r,i)=>({...r,quote_no:'COT-DEMO-0'+(i+1),document_no:'COT-DEMO-0'+(i+1),quote_date:today,appointment_date:today,expiration_date:today,total:2400+i*500,amount_including_vat:2400+i*500,next_appointment_date:today,amount:2400+i*500,net_amount_including_vat:2400+i*500,next_appointment_date:today,amount:2400+i*500,expired_appointment:i>0,days_overdue:i+1,status:'Ejemplo',source:'Datos de demostración'}));
const months=Array.from({length:8},(_,i)=>({period:'2026-'+String(i+1).padStart(2,'0'),net_sales:40000+i*3500,sales:40000+i*3500,margin_sales:40000+i*3500,margin_amount:10000+i*900,margin_pct:25,margin_coverage_pct:100,average_ticket:1300,sales:40000+i*3500,margin:10000+i*900,profit:10000+i*900,tickets:30+i*4,customers:20+i,partial:false}));
const summary={customers:8,total:8,repeat_customers:6,active_90_days:8,median_gap_days:18,p25_gap_days:14,p75_gap_days:22,customers_with_cadence:6,sales:42000,net_sales:42000,margin:11000,profit:11000,count:8};
const base=()=>({rows:[],total:0,page:1,page_size:50,pages:1,summary:{...summary},stats:{...summary},totals:{...summary},customers:0,net_sales:0,sales:0,margin:0,profit:0,tickets:0,groups:[],categories:[],stores:[],branches:[],items:[],bands:[],routes:[],sources:[],diagnosis:[],by_store:[],months:[],next_months:[],years:[],best:[],worst:[],pending:[],offers:[],segments:[],rules:[],opportunities:[],lift:[],quote_owners:[],behavior_segments:[],customer_groups:[],assessment:{readiness:'demo',rules:[]}});
window.demoRadarAPI=async(path,options={})=>{
 const u=new URL(path,location.href),p=u.pathname;
 if(p==='/api/stores')return ['DEMO-A','DEMO-B'];
 if(p==='/api/opportunities'){
  let list=rows.filter(r=>(!u.searchParams.get('q')||(r.customer_name+' '+r.customer_no).toLowerCase().includes(u.searchParams.get('q').toLowerCase()))&&(!u.searchParams.get('segment')||r.recency_segment===u.searchParams.get('segment'))&&(!u.searchParams.get('store')||r.store_no===u.searchParams.get('store')));
  return {...base(),rows:list,total:list.length,segments:['En ventana','Vencido','En riesgo','Probable perdida'].map(segment=>({segment,customers:rows.filter(r=>r.recency_segment===segment).length})),snapshot:{available:true,profiles:8,eligible:8,history_months:8,data_as_of:today,created_at:today},degraded:false};
 }
 if(p==='/api/quotes/live')return {...base(),rows:quotes,total:quotes.length,expired_total:2,source:'Datos ficticios',data_as_of:today};
 if(p==='/api/insights')return {...base(),customer_frequency:summary,stores:[{store_no:'DEMO-A',net_sales:23000},{store_no:'DEMO-B',net_sales:19000}],categories:[{category_code:'DEMO',sales_last_90_days:42000,sales_previous_90_days:38000}],quote_owners:[{salesperson_code:'Equipo demo',expired_quotes:2,upcoming_quotes:1}],customer_groups:[{customer_group:'Grupo demo',customers:8}],behavior_segments:[{behavior_segment:'Recurrente',customers:6}]};
 if(p==='/api/monthly'||p==='/api/digest')return {...base(),months,last_12_sales:420000,prior_12_sales:380000,last_12_margin:110000,prior_12_margin:95000,text:'Resumen ficticio para explorar la interfaz original.'};
 if(p==='/api/quality')return {...base(),data_as_of:today,server_today:today,assessment:{readiness:'ready',rules:[{title:'Datos de demostración',detail:'Este conjunto no representa clientes ni operaciones reales.',state:'ready',count:8}]}};
 if(p==='/api/projects')return {...base(),categories:[],basis:'Datos ficticios'};
 if(p==='/api/hourly')return Array.from({length:8},(_,i)=>({hour:i+9,sales:1000+i*400,profit:250+i*100,tickets:4+i}));
 if(p==='/api/contacts'){if(options.method==='POST')contacts.push({...JSON.parse(options.body||'{}'),date:today});return {rows:contacts,total:contacts.length};}
 if(p==='/api/assignments')return {...base(),pending:assignments,summary:{total:assignments.length,pending:assignments.length}};
 if(p.startsWith('/api/customer/')){const id=decodeURIComponent(p.split('/').pop()),r=rows.find(r=>r.customer_no===id)||rows[0];return {...base(),profile:r,customer:r,summary:{...summary,...r,purchase_count:r.purchase_count},purchases:[],categories:[],whatsapp_phone:'',privacy_blocked:true};}
 if(p==='/api/growth')return {...base(),prior_active:8,returned:6,lapsed:2,retention_pct:75,margin_pct_used:25,sales_per_returned:1500,margin_per_returned:375,expected_margin:2250,value_per_point:300};
 if(p==='/api/operating-cost')return {...base(),monthly_expense:12000,total_expense:12000,promotion:{}};
 if(p==='/api/seasonality')return {...base(),months,years:[2026],best:[],worst:[],next_months:[]};
 if(p==='/api/freshness')return {...base(),sources:[],diagnosis:[],stalled:false};
 if(options.method==='POST')return {ok:true,simulated:true,...base()};
 return base();
};
})();
