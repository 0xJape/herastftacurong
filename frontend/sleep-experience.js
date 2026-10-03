(()=>{
  const today=()=>new Date().toLocaleDateString('en-CA');
  const modal=document.getElementById('sleep-prompt');
  const logButton=document.getElementById('sleep-prompt-log');
  const checkinButton=document.getElementById('sleep-prompt-checkin');
  const closeButton=document.getElementById('sleep-prompt-close');
  let previousFocus;

  function close(){
    if(!modal)return;
    modal.hidden=true;
    sessionStorage.setItem(`hera.sleep-prompt.${today()}`,'closed');
    previousFocus?.focus();
  }

  function open(){
    if(!modal||!modal.hidden||sessionStorage.getItem(`hera.sleep-prompt.${today()}`))return;
    previousFocus=document.activeElement;
    modal.hidden=false;
    logButton.focus();
  }

  async function addChart(root){
    const hero=root.querySelector('.sleep-hero');
    if(!hero||hero.querySelector('.sleep-chart'))return;
    try{
      const response=await fetch('/api/sleep/1?limit=14',{cache:'no-store'});
      if(!response.ok)return;
      const records=(await response.json()).records.filter(record=>record.estimatedSleepTime&&record.wakeTime).slice(0,7).reverse();
      if(!records.length)return;
      const minutes=value=>Number(value.slice(0,2))*60+Number(value.slice(3));
      const points=records.map(record=>({date:new Date(`${record.date}T00:00:00`),hours:((minutes(record.wakeTime)-minutes(record.estimatedSleepTime)+1440)%1440)/60}));
      const average=points.reduce((sum,point)=>sum+point.hours,0)/points.length;
      const chart=document.createElement('section');
      chart.className='sleep-chart';
      chart.setAttribute('aria-label',`Recent sleep duration. Average ${average.toFixed(1)} hours.`);
      chart.innerHTML=`<header><div><small>AVERAGE SLEEP</small><strong>${average.toFixed(1)}<span> hours</span></strong></div><p>Last ${points.length} logged ${points.length===1?'night':'nights'}</p></header><div class="sleep-bars">${points.map(point=>`<div class="sleep-bar" title="${point.hours.toFixed(1)} hours"><i style="--sleep-height:${Math.min(point.hours/10*100,100)}%"><b>${point.hours.toFixed(1)}h</b></i><span>${point.date.toLocaleDateString(undefined,{weekday:'short'})}</span></div>`).join('')}</div>`;
      hero.append(chart);
    }catch{}
  }

  async function addAssessment(root){
    const hero=root.querySelector('.sleep-hero');
    if(!hero||hero.querySelector('.sleep-assessment'))return;
    const assessment=document.createElement('section');
    assessment.className='sleep-assessment';
    assessment.setAttribute('aria-live','polite');
    assessment.innerHTML='<div class="sleep-assessment-head"><span aria-hidden="true">✦</span><div><small>HERA AI SLEEP SUMMARY</small><strong>Reviewing recent sleep logs…</strong></div></div>';
    hero.prepend(assessment);
    try{
      const response=await fetch('/api/sleep/1/assessment',{cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Assessment unavailable');
      assessment.innerHTML=`<div class="sleep-assessment-head"><span aria-hidden="true">✦</span><div><small>HERA AI SLEEP SUMMARY · ${result.confidence.toUpperCase()} CONFIDENCE</small><strong>${result.recordsReviewed} recent ${result.recordsReviewed===1?'log':'logs'} reviewed</strong></div></div><p>${result.summary}</p><small class="sleep-assessment-note">${result.disclaimer}</small>`;
    }catch(error){
      assessment.innerHTML=`<div class="sleep-assessment-head"><span aria-hidden="true">✦</span><div><small>HERA AI SLEEP SUMMARY</small><strong>Summary unavailable</strong></div></div><p>${error.message}</p>`;
    }
  }

  function enhance(){
    const root=document.getElementById('sleep-root');
    const form=document.getElementById('sleep-form');
    const history=root?.querySelector('.sleep-history');
    if(!root||!form||form.dataset.experience)return;
    form.dataset.experience='true';
    addAssessment(root);
    addChart(root);

    form.firstElementChild?.insertAdjacentHTML('beforeend','<p class="sleep-form-intro">Use last night’s best estimate. Move each scale from 1 (low) to 5 (high), then save to update your score.</p><ol class="sleep-steps" aria-label="How to log sleep"><li><b>1</b><span>Add your sleep times</span></li><li><b>2</b><span>Rate how sleep felt</span></li><li><b>3</b><span>Save your nightly log</span></li></ol>');

    form.querySelectorAll('.sleep-scale input').forEach(input=>{
      const label=input.closest('label');
      const hint=document.createElement('small');
      hint.className='sleep-scale-hint';
      hint.textContent=input.name==='sleepOnsetDifficulty'||input.name==='sleepDisturbances'||input.name==='morningSleepiness'?'1 = none · 5 = severe':'1 = low · 5 = high';
      label?.append(hint);
    });

    if(history){
      const rows=[...history.children];
      rows.forEach((row,index)=>row.hidden=index>=7);
      if(rows.length>7){
        const toggle=document.createElement('button');
        toggle.type='button';
        toggle.className='sleep-history-toggle text-button';
        toggle.textContent=`Show all ${rows.length} logs`;
        toggle.setAttribute('aria-expanded','false');
        toggle.addEventListener('click',()=>{
          const expanded=toggle.getAttribute('aria-expanded')==='true';
          rows.forEach((row,index)=>row.hidden=expanded&&index>=7);
          toggle.setAttribute('aria-expanded',String(!expanded));
          toggle.textContent=expanded?`Show all ${rows.length} logs`:'Show recent only';
        });
        history.after(toggle);
      }
    }
    open();
  }

  logButton?.addEventListener('click',()=>{close();document.getElementById('sleep-form')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>document.querySelector('#sleep-form input')?.focus(),350)});
  checkinButton?.addEventListener('click',()=>{close();location.hash='checkin'});
  closeButton?.addEventListener('click',close);
  modal?.querySelector('.sleep-prompt-backdrop')?.addEventListener('click',close);
  document.addEventListener('keydown',event=>{
    if(!modal||modal.hidden)return;
    if(event.key==='Escape')close();
    if(event.key==='Tab'){
      const controls=[logButton,checkinButton,closeButton],first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
  });
  new MutationObserver(enhance).observe(document.getElementById('page-content'),{childList:true,subtree:true});
  enhance();
})();