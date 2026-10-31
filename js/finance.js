// Registro mensile presenze e contabilità istruttore
(function () {
  const $ = id => document.getElementById(id);
  const euro = value => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(value)||0);
  const monthStart = value => value + '-01';
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data = {profiles:[],lessons:[],attendance:[],settings:{},payments:[]};

  document.addEventListener('DOMContentLoaded', () => {
    const month = $('finance-month');
    if (!month) return;
    const now = new Date();
    month.value = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    $('btn-finance-refresh').addEventListener('click', load);
    $('btn-finance-export').addEventListener('click', exportCsv);
    month.addEventListener('change', load);
    load();
  });

  async function load() {
    const month = $('finance-month').value;
    if (!month) return;
    $('finance-content').innerHTML = '<p class="text-xs text-gray-400">Caricamento tabulato...</p>';
    const sb = getSupabase();
    const start = monthStart(month);
    const endDate = new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),1);
    const end = endDate.getFullYear()+'-'+String(endDate.getMonth()+1).padStart(2,'0')+'-'+String(endDate.getDate()).padStart(2,'0');
    const [p,l,a,s,pay] = await Promise.all([
      sb.from('profiles').select('id,nome,cognome').eq('is_admin',false).order('nome'),
      sb.from('lessons').select('id,title,datetime').gte('datetime',start+'T00:00:00').lt('datetime',end+'T00:00:00').order('datetime'),
      sb.from('attendance_records').select('id,lesson_id,user_id,guest_name,status').gte('checked_at',start+'T00:00:00').lt('checked_at',end+'T00:00:00'),
      sb.from('student_payment_settings').select('*'),
      sb.from('attendance_payment_records').select('*').eq('billing_month',start)
    ]);
    const failed=[p,l,a,s,pay].find(x=>x.error);
    if(failed){ $('finance-content').innerHTML='<p class="text-sm text-brand-pink">Errore: '+esc(failed.error.message)+'. Verifica di aver eseguito supabase_finance.sql.</p>'; return; }
    data={profiles:p.data||[],lessons:l.data||[],attendance:a.data||[],settings:{},payments:pay.data||[]};
    (s.data||[]).forEach(x=>data.settings[x.user_id]=x);
    render();
  }

  function paymentFor(userId,scope,lessonId) {
    return data.payments.find(x=>x.user_id===userId && x.payment_scope===scope && (scope==='monthly' || x.lesson_id===lessonId));
  }
  function render() {
    const profiles=data.profiles, lessons=data.lessons;
    const present=data.attendance.filter(x=>x.status==='present'&&x.user_id);
    const expected=profiles.reduce((sum,p)=>{
      const st=data.settings[p.id]||{payment_method:'monthly',monthly_fee:0,lesson_fee:0};
      if(st.payment_method==='monthly') return sum+Number(st.monthly_fee||0);
      return sum+present.filter(a=>a.user_id===p.id).length*Number(st.lesson_fee||0);
    },0);
    const paid=data.payments.filter(x=>x.paid).reduce((sum,x)=>sum+Number(x.amount||0),0);
    const due=data.payments.filter(x=>!x.paid).reduce((sum,x)=>sum+Number(x.amount||0),0);
    $('finance-totals').innerHTML=[
      ['Incasso previsto',euro(expected)],['Incassato',euro(paid)],['Da riscuotere',euro(due)]
    ].map(([label,value])=>'<div class="bg-brand-dark border border-brand-border rounded-xl p-3"><div class="text-[10px] uppercase text-gray-400 font-bold">'+label+'</div><div class="text-xl font-black text-white mt-1">'+value+'</div></div>').join('');

    let html='<div class="mb-5"><h4 class="text-sm font-black uppercase text-white mb-2">Modalità e quote per allieva</h4><div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-gray-400 border-b border-brand-border"><th class="text-left p-2">Allieva</th><th class="p-2">Pagamento</th><th class="p-2">Quota mensile (€)</th><th class="p-2">Quota lezione (€)</th></tr></thead><tbody>';
    html+=profiles.map(p=>{const st=data.settings[p.id]||{payment_method:'monthly',monthly_fee:0,lesson_fee:0};return '<tr class="border-b border-brand-border"><td class="p-2 font-bold">'+esc((p.nome||'')+' '+(p.cognome||''))+'</td><td class="p-2"><select data-setting-user="'+p.id+'" data-field="payment_method" class="bg-brand-dark border border-brand-border rounded-lg p-2 text-white"><option value="monthly" '+(st.payment_method==='monthly'?'selected':'')+'>Mensile</option><option value="per_lesson" '+(st.payment_method==='per_lesson'?'selected':'')+'>A lezione</option></select></td><td class="p-2"><input data-setting-user="'+p.id+'" data-field="monthly_fee" type="number" min="0" step=".01" value="'+Number(st.monthly_fee||0)+'" class="w-24 bg-brand-dark border border-brand-border rounded-lg p-2 text-white"></td><td class="p-2"><input data-setting-user="'+p.id+'" data-field="lesson_fee" type="number" min="0" step=".01" value="'+Number(st.lesson_fee||0)+'" class="w-24 bg-brand-dark border border-brand-border rounded-lg p-2 text-white"></td></tr>';}).join('');
    html+='</tbody></table></div><button id="btn-save-settings" class="mt-3 px-4 py-2 btn-gradient text-black rounded-lg text-xs font-black uppercase">Salva modalità e quote</button></div>';
    html+='<div><h4 class="text-sm font-black uppercase text-white mb-2">Registro presenze per lezione</h4>';
    if(!lessons.length) html+='<p class="text-xs text-gray-500">Nessuna lezione programmata nel mese selezionato.</p>';
    lessons.forEach(lesson=>{
      const d=new Date(lesson.datetime), label=d.toLocaleDateString('it-IT')+' · '+d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
      const rows=data.attendance.filter(a=>a.lesson_id===lesson.id);
      html+='<div class="bg-brand-dark border border-brand-border rounded-xl p-3 mb-3"><div class="font-black text-white text-sm">'+esc(lesson.title)+' <span class="text-brand-cyan text-xs">'+label+'</span></div>';
      if(!rows.length) html+='<p class="text-xs text-gray-500 mt-2">Nessuna presenza registrata.</p>';
      rows.forEach(a=>{
        const p=profiles.find(x=>x.id===a.user_id), name=p?((p.nome||'')+' '+(p.cognome||'')):a.guest_name||'Partecipante';
        const st=a.user_id?data.settings[a.user_id]||{payment_method:'monthly',monthly_fee:0,lesson_fee:0}:null;
        const isPresent=a.status==='present';
        const scope=st&&st.payment_method==='per_lesson'?'lesson':'monthly';
        const rec=a.user_id&&isPresent?paymentFor(a.user_id,scope,scope==='lesson'?lesson.id:null):null;
        const amount=st?(scope==='monthly'?Number(st.monthly_fee||0):Number(st.lesson_fee||0)):0;
        const badge=isPresent?(scope==='monthly'?'Quota mensile':'Lezione singola'):'Non presente';
        html+='<div class="flex flex-wrap justify-between items-center gap-2 border-t border-brand-border mt-2 pt-2 text-xs"><span class="text-white">'+esc(name)+' <span class="'+(isPresent?'text-brand-lime':'text-brand-pink')+'">'+badge+'</span></span>';
        if(isPresent&&st) html+='<span class="text-gray-300">'+euro(rec?rec.amount:amount)+'</span><button data-pay-user="'+a.user_id+'" data-pay-lesson="'+(scope==='lesson'?lesson.id:'')+'" data-pay-scope="'+scope+'" data-pay-amount="'+amount+'" class="px-3 py-1.5 rounded-lg text-[10px] font-black '+(rec&&rec.paid?'bg-brand-lime/20 text-brand-lime':'bg-brand-pink/10 text-brand-pink')+'">'+(rec&&rec.paid?'PAGATO':'SEGNA PAGATO')+'</button>';
        else if(!a.user_id) html+='<span class="text-gray-500">Partecipante non registrata</span>';
        html+='</div>';
      });
      html+='</div>';
    });
    html+='</div>';
    $('finance-content').innerHTML=html;
    $('btn-save-settings').addEventListener('click',saveSettings);
    $('finance-content').querySelectorAll('[data-pay-user]').forEach(btn=>btn.addEventListener('click',()=>togglePayment(btn)));
  }

  async function saveSettings(){
    const sb=getSupabase(), map={};
    $('finance-content').querySelectorAll('[data-setting-user]').forEach(el=>{
      const id=el.dataset.settingUser; map[id]=map[id]||{user_id:id};
      map[id][el.dataset.field]=el.type==='number'?Number(el.value):el.value;
    });
    const rows=Object.values(map);
    const {error}=await sb.from('student_payment_settings').upsert(rows,{onConflict:'user_id'});
    if(error){alert('Errore salvataggio quote: '+error.message);return;}
    alert('Modalità e quote salvate.'); await load();
  }
  async function togglePayment(btn){
    const sb=getSupabase(), userId=btn.dataset.payUser, scope=btn.dataset.payScope;
    const lessonId=btn.dataset.payLesson||null, month=monthStart($('finance-month').value);
    const existing=paymentFor(userId,scope,lessonId);
    const nextPaid=!(existing&&existing.paid);
    const payload={user_id:userId,lesson_id:lessonId,billing_month:month,payment_scope:scope,amount:existing?existing.amount:Number(btn.dataset.payAmount||0),paid:nextPaid,paid_at:nextPaid?new Date().toISOString():null};
    const {error}=await sb.from('attendance_payment_records').upsert(payload,{onConflict:scope==='monthly'?'user_id,billing_month':'user_id,lesson_id'});
    if(error){alert('Errore aggiornamento pagamento: '+error.message);return;}
    await load();
  }
  function exportCsv(){
    const rows=[['Data','Lezione','Allieva','Presenza','Modalita','Importo','Pagato']];
    data.lessons.forEach(l=>data.attendance.filter(a=>a.lesson_id===l.id).forEach(a=>{
      const p=data.profiles.find(x=>x.id===a.user_id), st=a.user_id?data.settings[a.user_id]:null;
      const scope=st&&st.payment_method==='per_lesson'?'lesson':'monthly';
      const rec=a.user_id&&a.status==='present'?paymentFor(a.user_id,scope,scope==='lesson'?l.id:null):null;
      rows.push([new Date(l.datetime).toLocaleDateString('it-IT'),l.title,p?((p.nome||'')+' '+(p.cognome||'')):a.guest_name||'Partecipante',a.status==='present'?'Presente':'Assente',st?(scope==='monthly'?'Mensile':'A lezione'):'-',rec?rec.amount:(st?(scope==='monthly'?st.monthly_fee:st.lesson_fee):0),rec&&rec.paid?'Sì':'No']);
    }));
    const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');
    a.href=url;a.download='presenze_contabilita_'+$('finance-month').value+'.csv';a.click();URL.revokeObjectURL(url);
  }
})();