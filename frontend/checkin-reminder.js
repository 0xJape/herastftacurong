(()=>{
  const modal=document.getElementById('checkin-reminder'),go=document.getElementById('checkin-reminder-go'),later=document.getElementById('checkin-reminder-later');
  if(!modal||!go||!later)return;
  const today=()=>new Date().toLocaleDateString('en-CA');let userId;
  const dismissKey=()=>`hera.checkin-reminder.dismissed.${userId}.${today()}`;
  let previousFocus=null;
  const close=()=>{modal.hidden=true;localStorage.setItem(dismissKey(),'true');previousFocus?.focus()};
  const open=()=>{previousFocus=document.activeElement;modal.hidden=false;go.focus()};
  async function check(){if(document.getElementById('app')?.hidden||location.hash==='#sleep'||localStorage.getItem(dismissKey()))return;try{const response=await fetch('/api/checkins/1?limit=1',{cache:'no-store'});if(!response.ok)return;const latest=(await response.json()).checkins?.[0];if(latest?.date!==today())open()}catch{}}
  go.addEventListener('click',()=>{modal.hidden=true;location.hash='checkin'});
  later.addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(modal.hidden)return;if(event.key==='Escape')close();if(event.key==='Tab'){const first=go,last=later;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
  document.getElementById('enter-dashboard')?.addEventListener('click',()=>userId&&setTimeout(check,350));
  fetch('/api/auth/me',{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject()).then(({user})=>{userId=user.id;if(!document.getElementById('app')?.hidden)setTimeout(check,350)}).catch(()=>{});
})();
