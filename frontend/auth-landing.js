(()=>{
  const card=document.querySelector('body>main');
  if(!card)return;
  const silk=document.createElement('canvas');
  silk.id='silk';
  silk.setAttribute('aria-hidden','true');
  document.body.prepend(silk);
  card.classList.add('auth-card');
  const intro=document.createElement('section');
  intro.className='landing-intro';
  intro.innerHTML='<div class="brand"><img src="assets/HERA_LOGO.jpg" alt="">HERA</div><p class="landing-eyebrow">Your body. Your rhythm. Your care.</p><h1>Health insight that moves <em>with you.</em></h1><p>Bring cycle awareness, sleep patterns, daily wellness, and live wearable signals into one calm, private space.</p><div class="landing-benefits"><span>Private account</span><span>Personal wellness trends</span><span>Connected wearable</span></div>';
  const layout=document.createElement('div');
  layout.className='landing-layout';
  card.before(layout);
  layout.append(intro,card);
})();
