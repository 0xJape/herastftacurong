(()=>{
  const rootId='nutrition-root';
  let aiGuidance=null,aiRequest=null;
  const escape=value=>String(value??'').replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
  const cycleText=cycle=>!cycle?.phaseAvailable?'Unavailable — add cycle history':cycle.currentEstimatedPhase||'Available, phase not reported';
  const checkinText=checkin=>!checkin?'Unavailable — no check-in reported':`Hydration ${escape(checkin.hydration)}/5 · ${escape(checkin.date)}`;
  const wearableText=wearable=>!wearable?'Unavailable — no wearable activity today':wearable.wearing?escape(wearable.activity||'Available, activity not classified'):'Unavailable — device not worn';

  function markup(data){
    const water=Math.min(10000,Math.max(0,Number(data.water?.milliliters)||0));
    const target=Number(data.targetMilliliters)||0;
    const recommendations=Array.isArray(data.recommendations)?data.recommendations:[];
    const activity=data.recentActivity||{};
    const foodSuggestion=recommendations.find(item=>/food|meal|nutrition|grain|protein/i.test(`${item.title} ${item.detail}`));
    const engine=aiGuidance?'AI-personalized · based on available HERA data':'Rules-based guidance · AI personalization loading';
    return `<div class="nutrition-grid">
      <article class="card"><p class="card-label">TODAY'S WATER</p><p class="water-total"><span id="water-total">${water}</span> <small>ml of ${target?escape(target):'unavailable'} ml</small></p><progress class="water-progress" max="${target||1}" value="${Math.min(water,target||water)}" aria-label="Water intake: ${water} milliliters of ${target||'unknown'} milliliters">${water} ml</progress><div class="water-actions" aria-label="Update water intake"><button type="button" data-water-add="250">+250 ml</button><button type="button" data-water-add="500">+500 ml</button><button type="button" data-water-reset>Reset to 0</button></div><p class="nutrition-status muted" id="nutrition-status" role="status"></p></article>
      <article class="card"><p class="card-label">CURRENT CONTEXT</p><div class="data-list"><div class="data-row"><span>Cycle</span><strong>${escape(cycleText(data.cycle))}</strong></div><div class="data-row"><span>Phase food suggestion</span><strong>${foodSuggestion?escape(foodSuggestion.detail):'Unavailable for current phase'}</strong></div><div class="data-row"><span>Latest self-reported hydration</span><strong>${checkinText(data.checkin)}</strong></div><div class="data-row"><span>Current activity</span><strong>${wearableText(data.wearable)}</strong></div><div class="data-row"><span>Recent activity coverage</span><strong>${Math.min(7,Number(activity.coveredDays)||0)} of 7 days · ${Number(activity.activeReadings)||0} active detections</strong></div></div></article>
      <article class="card full"><p class="card-label">CURRENT GUIDANCE</p><p><span class="preview-badge" id="nutrition-engine">${engine}</span></p><div class="nutrition-recommendations" id="nutrition-guidance">${aiGuidance?`<section class="nutrition-recommendation nutrition-ai-guidance"><h3>Personalized HERA guidance</h3><p>${escape(aiGuidance)}</p><span class="nutrition-source">Source: AI interpretation of available HERA data</span></section>`:''}${recommendations.length?recommendations.map(item=>`<section class="nutrition-recommendation"><h3>${escape(item.title)}</h3><p>${escape(item.detail)}</p><span class="nutrition-source">Source: ${escape(item.source||'Not provided')}</span></section>`).join(''):'<p class="muted">No recommendations available from current data.</p>'}</div><p class="nutrition-ai-status muted" id="nutrition-ai-status" role="status">${aiGuidance?'AI guidance is informational and non-diagnostic.':'Personalizing guidance…'}</p></article>
      <aside class="nutrition-disclaimer full" role="note"><strong>Wellness guidance, not medical care.</strong> ${escape(data.disclaimer||'Backend disclaimer unavailable. Nutrition guidance does not diagnose conditions or prescribe treatment.')}</aside>
    </div>`;
  }

  async function load(){
    const root=document.getElementById(rootId);
    if(!root||root.dataset.loading)return;
    root.dataset.initialized='true';
    root.dataset.loading='true';
    try{
      const response=await fetch('/api/nutrition/1',{cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
      if(!document.body.contains(root))return;
      root.dataset.date=data.date||'';
      root.innerHTML=markup(data);
      loadAiGuidance(root,data);
    }catch(error){
      if(document.body.contains(root))root.innerHTML=`<div class="card nutrition-error" role="alert"><p class="card-label">NUTRITION UNAVAILABLE</p><p>Could not load nutrition data: ${escape(error.message)}</p><button class="primary-button" type="button" data-nutrition-retry>Try again</button></div>`;
    }finally{delete root.dataset.loading}
  }

  async function loadAiGuidance(root,data){
    if(aiGuidance){return}
    if(aiRequest){await aiRequest;if(document.body.contains(root))root.innerHTML=markup(data);return}
    const status=document.getElementById('nutrition-ai-status');
    aiRequest=(async()=>{
      try{
        const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Using only my available HERA data, give concise nutrition and activity guidance for my current cycle phase. Suggest practical foods and mention gentle activity only when supported by my recent activity data. Use 2 to 4 plain-text sentences. Do not diagnose or prescribe.',history:[]})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
        aiGuidance=String(result.reply||'').replace(/[**#`]/g,'').trim();
        if(!aiGuidance)throw new Error('No guidance returned');
        if(document.body.contains(root))root.innerHTML=markup(data);
      }catch(error){
        if(status&&document.body.contains(status))status.textContent=`AI personalization unavailable. Rules-based guidance remains available.`;
      }finally{aiRequest=null}
    })();
    await aiRequest;
  }

  async function save(total,button){
    const root=document.getElementById(rootId),status=document.getElementById('nutrition-status');
    if(!root||!status)return;
    const milliliters=Math.min(10000,Math.max(0,Math.round(total)));
    root.querySelectorAll('button').forEach(item=>item.disabled=true);
    status.textContent='Saving…';
    try{
      const response=await fetch('/api/nutrition/1/water',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:root.dataset.date,milliliters})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
      status.textContent='Saved. Refreshing…';
      await load();
    }catch(error){
      status.textContent=`Could not save: ${error.message}`;
      root.querySelectorAll('button').forEach(item=>item.disabled=false);
      button?.focus();
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-water-add],[data-water-reset],[data-nutrition-retry]');
    if(!button)return;
    if(button.hasAttribute('data-nutrition-retry'))return load();
    const current=Number(document.getElementById('water-total')?.textContent)||0;
    save(button.hasAttribute('data-water-reset')?0:current+Number(button.dataset.waterAdd),button);
  });
  new MutationObserver(()=>{const root=document.getElementById(rootId);if(root&&!root.dataset.initialized)load()}).observe(document.getElementById('page-content'),{childList:true});
  load();
})();