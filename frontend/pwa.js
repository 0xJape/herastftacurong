(()=>{
  const prompt=document.getElementById('install-app'),install=document.getElementById('install-app-button'),close=document.getElementById('install-app-close');
  let installEvent=null;
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(error=>console.warn('HERA offline support unavailable:',error)));
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;if(!standalone&&!sessionStorage.getItem('hera.install.dismissed'))prompt.hidden=false});
  install?.addEventListener('click',async()=>{if(!installEvent)return;prompt.hidden=true;installEvent.prompt();await installEvent.userChoice;installEvent=null});
  close?.addEventListener('click',()=>{prompt.hidden=true;sessionStorage.setItem('hera.install.dismissed','true')});
  window.addEventListener('appinstalled',()=>{prompt.hidden=true;installEvent=null});
})();
