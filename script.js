
/* Aurora Pro Calculator - script.js
   - large buttons, neon background, sound, ripple
   - two-screen: main pad + advanced slide panel (open via ADV)
   - safe evaluator (tokenize -> shunting-yard -> RPN -> eval)
   - memory (MC/MR/M+/M-), percent, history (persistent)
   - deg/rad mode, constants, random, factorial
*/

/* ---------- UI elements ---------- */
const canvas = document.getElementById('bg');
const exprEl = document.getElementById('expr');
const valueEl = document.getElementById('value');
const pad = document.getElementById('pad');
const snd = document.getElementById('snd');
const advPanel = document.getElementById('advanced');
const advToggle = document.getElementById('advToggle');
const closeAdv = document.getElementById('closeAdv');
const themeBtn = document.getElementById('themeBtn');
const degBtn = document.getElementById('degBtn');
const historyList = document.getElementById('historyList');
const clearHistory = document.getElementById('clearHistory');

let expression = '';
let memory = 0;
let degMode = (localStorage.getItem('aurora_deg') || 'deg') === 'deg';
let history = JSON.parse(localStorage.getItem('aurora_history') || '[]');
let theme = localStorage.getItem('aurora_theme') || 'dark';

// initial theme & deg UI
document.body.classList.toggle('theme-dark', theme === 'dark');
document.body.classList.toggle('theme-light', theme === 'light');
themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
degBtn.textContent = degMode ? 'DEG' : 'RAD';

/* ---------- background aurora canvas ---------- */
(function bgAnim(){
  if(!canvas) return;
  const c = canvas, ctx = c.getContext('2d');
  function resize(){ c.width = innerWidth; c.height = innerHeight; }
  resize(); addEventListener('resize', resize);
  let t=0;
  function draw(){
    t += 0.01;
    ctx.clearRect(0,0,c.width,c.height);
    for(let i=0;i<3;i++){
      const grd = ctx.createLinearGradient(0,0,c.width,0);
      grd.addColorStop(0, i===0 ? 'rgba(52,224,161,0.06)' : 'rgba(59,130,246,0.04)');
      grd.addColorStop(1, i===0 ? 'rgba(59,130,246,0.06)' : 'rgba(99,102,241,0.03)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(0, c.height);
      for(let x=0;x<=c.width;x+=20){
        const y = c.height*0.5 + Math.sin((x/120) + t*(0.8 + i*0.3)) * (60 + i*20);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(c.width, c.height);
      ctx.closePath();
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ---------- helpers: sound & ripple ---------- */
function playSound(){ try{ snd.currentTime = 0; snd.play(); } catch(e){} }
function makeRipple(btn, clientX, clientY){
  const r = document.createElement('span');
  r.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.2;
  r.style.width = r.style.height = size + 'px';
  const left = (clientX || (rect.left + rect.width/2)) - rect.left - size/2;
  const top  = (clientY || (rect.top + rect.height/2)) - rect.top - size/2;
  r.style.left = left + 'px'; r.style.top = top + 'px';
  btn.appendChild(r);
  r.addEventListener('animationend', ()=> r.remove());
}

/* ---------- render ---------- */
function updateDisplay(){
  exprEl.textContent = expression || '';
  try {
    const v = evaluate(expression);
    valueEl.textContent = (v === undefined || isNaN(v)) ? '0' : formatNum(v);
  } catch(e){
    valueEl.textContent = 'Error';
  }
}
function formatNum(n){
  if(n === Infinity || n === -Infinity) return 'Infinity';
  if(Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(8);
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(10)).toString();
}

/* ---------- persistent history ---------- */
function pushHistory(eq, res){
  history.unshift({eq, res, t: Date.now()});
  if(history.length>60) history.pop();
  localStorage.setItem('aurora_history', JSON.stringify(history));
  renderHistory();
}
function renderHistory(){
  historyList.innerHTML = '';
  history.forEach(h=>{
    const li = document.createElement('li');
    li.textContent = `${h.eq} = ${h.res}`;
    li.addEventListener('click', ()=> { expression = h.res.toString(); updateDisplay(); playSound(); });
    historyList.appendChild(li);
  });
}
renderHistory();

/* ---------- keypad handling (main pad) ---------- */
pad.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button'); if(!btn) return;
  const action = btn.dataset.action; const val = btn.dataset.value;
  playSound(); makeRipple(btn, ev.clientX, ev.clientY);
  if(action === 'input') { expression += val; updateDisplay(); }
  else if(action === 'clear'){ expression = ''; updateDisplay(); }
  else if(action === 'delete'){ expression = expression.slice(0,-1); updateDisplay(); }
  else if(action === 'percent'){ applyPercent(); }
  else if(action === 'equals'){ computeEquals(); }
  else if(action === 'func'){ expression += val + '('; updateDisplay(); }
  else if(action === 'mem'){ memoryHandler(val); }
  else if(action === 'op'){ expression += val; updateDisplay(); }
});

/* ---------- advanced panel buttons ---------- */
advPanel.querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', (ev)=>{
    const action = btn.dataset.action; const val = btn.dataset.value;
    playSound(); makeRipple(btn, ev.clientX, ev.clientY);
    if(action === 'func'){ expression += val + '('; updateDisplay(); }
    else if(action === 'op'){ expression += val; updateDisplay(); }
    else if(action === 'special'){
      if(val === 'pi') expression += Math.PI.toString();
      else if(val === 'e') expression += Math.E.toString();
      else if(val === 'rand') expression += Math.random().toString();
      updateDisplay();
    } else if(action === 'mem'){ memoryHandler(val); }
    else if(action === 'special2' && val === 'fact'){ expression += 'fact('; updateDisplay(); }
  });
});

/* ---------- transform ADV toggle ---------- */
advToggle.addEventListener('click', ()=> {
  playSound(); advPanel.classList.toggle('show');
});
document.getElementById('closeAdv')?.addEventListener('click', ()=> advPanel.classList.remove('show'));

/* ---------- deg/rad toggle ---------- */
degBtn.addEventListener('click', ()=> {
  playSound();
  degMode = !degMode;
  degBtn.textContent = degMode ? 'DEG' : 'RAD';
  localStorage.setItem('aurora_deg', degMode ? 'deg':'rad');
});

/* ---------- theme toggle ---------- */
themeBtn.addEventListener('click', ()=> {
  playSound();
  theme = (theme === 'dark') ? 'light' : 'dark';
  localStorage.setItem('aurora_theme', theme);
  document.body.classList.toggle('theme-dark', theme === 'dark');
  document.body.classList.toggle('theme-light', theme === 'light');
  themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
});

/* ---------- clear history ---------- */
clearHistory?.addEventListener('click', ()=> { playSound(); history=[]; localStorage.removeItem('aurora_history'); renderHistory(); });

/* ---------- percent: convert last number to n/100 ---------- */
function applyPercent(){
  const match = expression.match(/(\d+\.?\d*)$/);
  if(match){
    const n = parseFloat(match[1]);
    const idx = match.index;
    expression = expression.slice(0, idx) + '(' + (n/100) + ')';
    updateDisplay();
  }
}

/* ---------- equals ---------- */
function computeEquals(){
  try {
    const val = evaluate(expression);
    const res = formatNum(val);
    pushHistory(expression, res);
    expression = res.toString();
    updateDisplay();
  } catch(e) {
    valueEl.textContent = 'Error';
  }
}

/* ---------- memory ---------- */
function memoryHandler(cmd){
  const cur = parseFloat(valueEl.textContent) || 0;
  if(cmd === 'MC') memory = 0;
  else if(cmd === 'MR') { expression += memory.toString(); updateDisplay(); }
  else if(cmd === 'M+') memory += cur;
  else if(cmd === 'M-') memory -= cur;
}

/* ---------- Expression evaluator (Shunting-yard -> RPN -> eval) ---------- */

function evaluate(input){
  if(!input || input.trim()==='') return 0;
  const tokens = tokenize(input);
  const rpn = toRPN(tokens);
  const value = evalRPN(rpn);
  return value;
}

function tokenize(s){
  const tokens = []; let i=0;
  const isLetter = c => /[a-zA-Z]/.test(c);
  const isDigit = c => /[0-9]/.test(c);
  while(i<s.length){
    const c = s[i];
    if(c === ' '){ i++; continue; }
    if(isDigit(c) || (c === '.' && isDigit(s[i+1]))){
      let j=i+1; while(j<s.length && /[0-9.]/.test(s[j])) j++;
      tokens.push(s.slice(i,j)); i=j; continue;
    }
    if(isLetter(c)){
      let j=i+1; while(j<s.length && isLetter(s[j])) j++;
      tokens.push(s.slice(i,j)); i=j; continue;
    }
    if(c === '-' ){
      const prev = tokens[tokens.length-1];
      if(!prev || prev==='(' || isOperator(prev)) tokens.push('0');
      tokens.push('-'); i++; continue;
    }
    if('+-*/^()'.includes(c)){ tokens.push(c); i++; continue; }
    if(c === '×' || c === 'x'){ tokens.push('*'); i++; continue; }
    if(c === '÷'){ tokens.push('/'); i++; continue; }
    i++;
  }
  return tokens;
}
function isOperator(tok){ return ['+','-','*','/','^'].includes(tok); }
function precedence(op){ if(op==='+'||op==='-') return 2; if(op==='*'||op==='/') return 3; if(op==='^') return 4; return 0; }
function isRightAssociative(op){ return op === '^'; }

function toRPN(tokens){
  const out = []; const ops = [];
  for(const tok of tokens){
    if(/^\d+(\.\d+)?$/.test(tok)) out.push({type:'num', value: parseFloat(tok)});
    else if(isOperator(tok)){
      while(ops.length){
        const top = ops[ops.length-1];
        if(top === '(') break;
        if((precedence(top) > precedence(tok)) || (precedence(top) === precedence(tok) && !isRightAssociative(tok))){
          out.push({type:'op', value: ops.pop()});
        } else break;
      }
      ops.push(tok);
    } else if(tok === '(') ops.push(tok);
    else if(tok === ')'){
      while(ops.length && ops[ops.length-1] !== '(') out.push({type:'op', value: ops.pop()});
      if(ops.length && ops[ops.length-1] === '(') ops.pop();
      // if function before '(' it remains on ops and will be handled
    } else if(/^[a-zA-Z]+$/.test(tok)){
      // function name
      ops.push(tok);
    } else { /* ignore */ }
  }
  while(ops.length){
    const v = ops.pop();
    if(isOperator(v)) out.push({type:'op', value: v});
    else out.push({type:'func', value: v});
  }
  return out;
}

function evalRPN(rpn){
  const stack = [];
  for(const node of rpn){
    if(node.type === 'num'){ stack.push(node.value); }
    else if(node.type === 'op'){
      const b = stack.pop(); const a = stack.pop();
      if(a === undefined || b === undefined) throw new Error('Invalid');
      let res;
      switch(node.value){
        case '+': res = a + b; break;
        case '-': res = a - b; break;
        case '*': res = a * b; break;
        case '/': res = a / b; break;
        case '^': res = Math.pow(a, b); break;
        default: throw new Error('Unknown op');
      }
      stack.push(res);
    } else if(node.type === 'func'){
      const name = node.value;
      const arg = stack.pop();
      if(arg === undefined) throw new Error('Missing arg');
      if(['sin','cos','tan'].includes(name)){
        const angle = degMode ? (arg * Math.PI / 180) : arg;
        if(name === 'sin') stack.push(Math.sin(angle));
        if(name === 'cos') stack.push(Math.cos(angle));
        if(name === 'tan') stack.push(Math.tan(angle));
      } else if(name === 'log') stack.push(Math.log10(arg));
      else if(name === 'ln') stack.push(Math.log(arg));
      else if(name === 'sqrt') stack.push(Math.sqrt(arg));
      else if(name === 'abs') stack.push(Math.abs(arg));
      else if(name === 'fact'){
        // factorial wrapper: only integer >=0
        const n = Math.floor(arg);
        if(n < 0) throw new Error('Invalid factorial');
        let f = 1;
        for(let i=2;i<=n;i++) f *= i;
        stack.push(f);
      } else throw new Error('Unknown func ' + name);
    }
  }
  if(stack.length !== 1) throw new Error('Invalid eval');
  return stack[0];
}

/* initial render */
updateDisplay();

