(()=>{
  const descriptions={
    mood:['Very low','Low','Okay','Good','Great'],
    stress:['Calm','Light','Moderate','High','Very high'],
    energy:['Drained','Low','Steady','Energized','Very high'],
    sleep:['Very poor','Poor','Fair','Good','Restful'],
    hydration:['Very low','Low','Okay','Good','Well hydrated']
  };
  const escape=value=>String(value??'').replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'})[char]);

  function select(input,value){
    input.value=String(value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    const group=input.closest('.guided-metric')?.querySelector('.choice-grid');
    group?.querySelectorAll('button').forEach(button=>{
      const active=Number(button.dataset.value)===value;
      button.classList.toggle('selected',active);
      button.setAttribute('aria-pressed',String(active));
    });
    updateProgress(input.form);
  }

  function updateProgress(form){
    if(!form)return;
    const selected=[...form.querySelectorAll('[data-range]')].filter(input=>input.dataset.chosen==='true').length;
    const bar=form.querySelector('.checkin-progress span'),text=form.querySelector('[data-checkin-progress]');
    if(bar)bar.style.width=`${selected/5*100}%`;
    if(text)text.textContent=selected===5?'Ready to save':`${selected} of 5 areas answered`;
    const button=form.querySelector('button[type="submit"]');
    if(button)button.disabled=selected<5;
  }

  function enhance(){
    const form=document.getElementById('checkin-form');
    if(!form||form.dataset.guided)return;
    form.dataset.guided='true';
    const heading=form.firstElementChild;
    heading?.insertAdjacentHTML('beforeend','<div class="checkin-progress-copy"><span data-checkin-progress>0 of 5 areas answered</span><small>Choose what feels closest today.</small></div><div class="checkin-progress" aria-hidden="true"><span></span></div>');
    form.querySelectorAll('[data-range]').forEach(input=>{
      const row=input.closest('.range-row');
      if(!row)return;
      const name=input.name,label=row.querySelector('span')?.textContent?.trim()||name;
      row.classList.add('guided-metric');
      input.classList.add('guided-range-source');
      input.tabIndex=-1;
      input.setAttribute('aria-hidden','true');
      const output=input.nextElementSibling;
      output?.setAttribute('hidden','');
      const choices=document.createElement('div');
      choices.className='choice-grid';
      choices.setAttribute('role','group');
      choices.setAttribute('aria-label',label);
      descriptions[name].forEach((description,index)=>{
        const button=document.createElement('button');
        button.type='button';
        button.dataset.value=String(index+1);
        button.setAttribute('aria-pressed','false');
        button.innerHTML=`<strong>${index+1}</strong><span>${escape(description)}</span>`;
        button.addEventListener('click',()=>{input.dataset.chosen='true';select(input,index+1)});
        choices.append(button);
      });
      row.append(choices);
    });
    form.querySelectorAll('.symptom-options input').forEach(input=>input.addEventListener('change',()=>input.closest('label')?.classList.toggle('selected',input.checked)));
    updateProgress(form);
    prefill(form);
  }

  async function prefill(form){
    try{
      const response=await fetch('/api/checkins/1?limit=1',{cache:'no-store'});
      if(!response.ok)return;
      const latest=(await response.json()).checkins?.[0];
      const today=new Date().toISOString().slice(0,10);
      if(!latest||latest.date!==today||!document.body.contains(form))return;
      for(const name of Object.keys(descriptions)){
        const input=form.elements[name];
        input.dataset.chosen='true';
        select(input,Number(latest[name]));
      }
      for(const symptom of latest.symptoms||[]){
        const input=form.querySelector(`input[name="symptoms"][value="${CSS.escape(symptom)}"]`);
        if(input){input.checked=true;input.closest('label')?.classList.add('selected')}
      }
      form.elements.notes.value=latest.notes||'';
      const note=document.getElementById('form-note');
      if(note)note.textContent="Today's saved check-in loaded. Saving updates it.";
    }catch{}
  }

  new MutationObserver(enhance).observe(document.getElementById('page-content'),{childList:true});
  enhance();
})();
