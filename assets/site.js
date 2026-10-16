(()=>{
const english=document.documentElement.lang==='en';
try{if(localStorage.getItem('site-theme')==='light')document.documentElement.dataset.theme='light'}catch{}
const theme=document.getElementById('themeToggle');if(theme)theme.addEventListener('click',()=>{const light=document.documentElement.dataset.theme!=='light';document.documentElement.dataset.theme=light?'light':'dark';try{localStorage.setItem('site-theme',light?'light':'dark')}catch{}});
const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
const cards=[...document.querySelectorAll('.project-card')],filters=[...document.querySelectorAll('[data-filter]')];
function filter(key){let count=0;for(const c of cards){const show=key==='all'||(key==='featured'?c.dataset.featured==='true':c.dataset.category===key);c.hidden=!show;if(show)count++}for(const b of filters)b.setAttribute('aria-pressed',String(b.dataset.filter===key));const out=document.getElementById('projectCount');if(out)out.textContent=english?`${count} projects · frontend demos with fictional data`:`${count} proyectos · demos del frontend con datos ficticios`}
for(const b of filters)b.addEventListener('click',()=>filter(b.dataset.filter));if(cards.length)filter('featured');
})();