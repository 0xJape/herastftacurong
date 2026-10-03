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
    const waterPercent=target?Math.min(100,Math.round(water/target*100)):0;
    const remaining=Math.max(0,target-water);
    const recommendations=Array.isArray(data.recommendations)?data.recommendations:[];
    const activity=data.recentActivity||{};
    const foodSuggestion=recommendations.find(item=>/food|meal|nutrition|grain|protein/i.test(`${item.title} ${item.detail}`));
    const engine=aiGuidance?'Personalized from your HERA signals':'Preparing your personalized briefing';
    return `<div class="nutrition-grid">
      <article class="card hydration-card" style="--water-level:${waterPercent}%"><div class="hydration-head"><div><p class="card-label">TODAY'S WATER <span class="hydration-live"><i></i> LIVE</span></p><p class="water-total"><span id="water-total">${water}</span><small> / ${target?escape(target):'—'} ml</small></p><p class="hydration-message">${waterPercent>=100?'Daily goal complete — beautifully done.':remaining?`${remaining} ml until today’s goal`:'Set a hydration target to begin'}</p></div><div class="water-orb" role="img" aria-label="Water intake ${waterPercent}% complete"><div class="water-liquid"><span></span><span></span></div><strong>${waterPercent}%</strong><small>HYDRATED</small></div></div><div class="hydration-meter" role="progressbar" aria-label="Water intake" aria-valuemin="0" aria-valuemax="${target||1}" aria-valuenow="${water}"><span></span></div><div class="hydration-scale"><span>0 ml</span><span>Goal ${target?escape(target):'—'} ml</span></div><div class="water-actions" aria-label="Update water intake"><button type="button" data-water-add="250"><span>＋</span><strong>250</strong><small>ml</small></button><button type="button" data-water-add="500"><span>＋</span><strong>500</strong><small>ml</small></button><button class="water-reset" type="button" data-water-reset aria-label="Reset water intake to zero">↺ <span>Reset</span></button></div><p class="nutrition-status muted" id="nutrition-status" role="status"></p></article>
      <article class="card nutrition-context-card"><div class="context-head"><div><p class="card-label">CURRENT CONTEXT <span class="context-live"><i></i> SYNCED</span></p><h3>Your wellness signals</h3><p>Live context shaping today’s guidance.</p></div><span class="context-orbit" aria-hidden="true">✦</span></div><div class="context-grid"><section class="context-tile context-cycle"><span class="context-icon" aria-hidden="true">◒</span><div><small>CYCLE PHASE</small><strong>${escape(cycleText(data.cycle))}</strong></div></section><section class="context-tile context-activity"><span class="context-icon" aria-hidden="true">↗</span><div><small>ACTIVITY NOW</small><strong>${wearableText(data.wearable)}</strong></div></section><section class="context-tile context-hydration"><span class="context-icon" aria-hidden="true">◉</span><div><small>SELF-REPORT</small><strong>${checkinText(data.checkin)}</strong></div></section><section class="context-tile context-coverage"><span class="context-icon" aria-hidden="true">▥</span><div><small>7-DAY COVERAGE</small><strong>${Math.min(7,Number(activity.coveredDays)||0)} days · ${Number(activity.activeReadings)||0} active signals</strong></div></section></div><div class="context-suggestion"><span aria-hidden="true">✦</span><div><small>PHASE-AWARE FOOD SIGNAL</small><strong>${foodSuggestion?escape(foodSuggestion.detail):'Add more cycle data to unlock a suggestion.'}</strong></div></div></article>
      <article class="card full guidance-card"><header class="guidance-head"><div><p class="card-label">CURRENT GUIDANCE</p><h2>Your daily wellness briefing</h2><p>Practical ideas shaped by signals available today.</p></div><span class="guidance-engine" id="nutrition-engine"><i>✦</i>${engine}</span></header><div class="nutrition-recommendations" id="nutrition-guidance">${aiGuidance?`<section class="nutrition-recommendation nutrition-ai-guidance"><div class="ai-guidance-head"><span class="ai-mark" aria-hidden="true">✦</span><div><small>HERA INTELLIGENCE</small><h3>Personalized focus</h3></div><span class="ai-ready"><i></i> READY</span></div><p>${escape(aiGuidance)}</p><footer><span>Generated from available cycle, nutrition, check-in, and wearable context</span><span>Today</span></footer></section>`:''}${recommendations.length?recommendations.map((item,index)=>`<section class="nutrition-recommendation guidance-action"><span class="guidance-number">${String(index+1).padStart(2,'0')}</span><div><small>FOUNDATION</small><h3>${escape(item.title)}</h3><p>${escape(item.detail)}</p><span class="nutrition-source">Based on ${escape(item.source||'available HERA data')}</span></div></section>`).join(''):'<p class="muted">No recommendations available from current data.</p>'}</div><div class="guidance-safety"><span aria-hidden="true">ⓘ</span><p id="nutrition-ai-status" role="status">${aiGuidance?'Informational wellness guidance — not diagnosis or medical treatment.':'Personalizing guidance…'}</p></div></article>
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
        aiGuidance=String(result.reply||'').replace(/^[\s#*`]*(personalized\s+hera\s+guidance:?)[\s#*`-]*/i,'').replace(/[*#`]/g,'').trim();
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