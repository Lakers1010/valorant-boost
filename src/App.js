import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

const RANKS = ["鐵牌","銅牌","銀牌","金牌","白金","鑽石","超凡入聖","神話","賦能"];
const RANK_TIERS = ["1","2","3"];
const SERVICES = [
  { id:"boost", label:"段位代打", base:500 },
  { id:"placement", label:"定位賽代打", base:800 },
  { id:"win", label:"指定勝場", base:300 },
  { id:"coaching", label:"陪練教學", base:600 },
];
const STATUS_META = {
  pending:   { label:"待接單", color:"#f5a623", bg:"rgba(245,166,35,0.12)" },
  active:    { label:"進行中", color:"#4fc3f7", bg:"rgba(79,195,247,0.12)" },
  done:      { label:"已完成", color:"#69f0ae", bg:"rgba(105,240,174,0.12)" },
  cancelled: { label:"已取消", color:"#ef5350", bg:"rgba(239,83,80,0.12)" },
};
const C = {
  primary:"#ff4655", secondary:"#0f1923", accent:"#ff7b00",
  surface:"#1a2332", surface2:"#243040", border:"#2e3f52",
  text:"#ece8e1", muted:"#7f9ab5"
};
const BOSS_PASSWORD = "boss1234";

const uid = () => Math.random().toString(36).slice(2,9).toUpperCase();
const fmt = iso => iso ? new Date(iso).toLocaleString("zh-TW",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";
const fmtMon = iso => iso ? new Date(iso).toLocaleDateString("zh-TW",{year:"numeric",month:"long"}) : "";
const groupByMonth = orders => {
  const map = {};
  orders.forEach(o => {
    const k = fmtMon(o.createdAt);
    if (!map[k]) map[k] = { orders:[], income:0 };
    map[k].orders.push(o);
    if (o.status === "done") map[k].income += (o.price||0);
  });
  return map;
};

function useOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);
  const saveOrder = async (order) => { await setDoc(doc(db, "orders", order.id), order); };
  const updateOrder = async (id, patch) => { await setDoc(doc(db, "orders", id), patch, { merge: true }); };
  return { orders, loading, saveOrder, updateOrder };
}
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, []);
  return (
    <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:C.surface2,border:`1px solid ${C.border}`,color:C.text,padding:"12px 22px",borderRadius:10,fontSize:14,zIndex:999,boxShadow:"0 8px 30px rgba(0,0,0,0.5)",whiteSpace:"nowrap",animation:"fadeUp 0.3s ease"}}>
      {msg}
    </div>
  );
}

function Btn({ children, onClick, color="#ff4655", small, outline, disabled, style={} }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{padding:small?"6px 14px":"10px 22px",background:outline?"transparent":hover?color+"dd":color+"22",color:outline?(hover?"#fff":color):(hover?"#fff":color),border:`1.5px solid ${color}`,borderRadius:8,fontSize:small?12:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",transition:"all 0.15s",fontFamily:"'Noto Sans TC',sans-serif",opacity:disabled?0.5:1,...style}}>
      {children}
    </button>
  );
}

function Input({ label, value, onChange, type="text", style={}, ...rest }) {
  return (
    <label style={{display:"flex",flexDirection:"column",gap:4,flex:1}}>
      {label && <span style={{fontSize:11,color:C.muted,fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>{label}</span>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)}
        style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:14,outline:"none",fontFamily:"'Noto Sans TC',sans-serif",...style}} {...rest} />
    </label>
  );
}

function Sel({ label, value, onChange, options, style={} }) {
  return (
    <label style={{display:"flex",flexDirection:"column",gap:4,flex:1}}>
      {label && <span style={{fontSize:11,color:C.muted,fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>{label}</span>}
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:14,outline:"none",fontFamily:"'Noto Sans TC',sans-serif",...style}}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function OrderCard({ order, onClaim, onDone, onCancel, onDelete, agentName, isBoss }) {
  const sm = STATUS_META[order.status];
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",marginBottom:10,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:sm.color,borderRadius:"12px 0 0 12px"}} />
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
            <span style={{fontFamily:"monospace",fontSize:12,color:C.muted}}>#{order.id}</span>
            <span style={{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:sm.bg,color:sm.color}}>{sm.label}</span>
            {order.urgent && <span style={{padding:"2px 8px",borderRadius:20,fontSize:11,background:"rgba(255,70,85,0.15)",color:"#ff4655",fontWeight:600}}>🔥 加急</span>}
          </div>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:C.text}}>{SERVICES.find(s=>s.id===order.service)?.label}</div>
          <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>
            <span>👤 {order.clientName}</span>
            {order.gameId && <span style={{marginLeft:12}}>🎮 {order.gameId}</span>}
          </div>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>
            {order.fromRank && <span>📊 {order.fromRank} → {order.toRank}</span>}
            {order.wins && <span>🏆 {order.wins} 勝</span>}
          </div>
          {order.note && <div style={{marginTop:6,fontSize:12,color:C.muted,fontStyle:"italic"}}>💬 {order.note}</div>}
        </div>
        <div style={{textAlign:"right",minWidth:80}}>
          <div style={{fontSize:22,fontWeight:800,color:C.primary,letterSpacing:-1}}>NT${order.price}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmt(order.createdAt)}</div>
          {order.claimedBy && <div style={{fontSize:11,color:"#4fc3f7",marginTop:4}}>⚡ {order.claimedBy}</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
        {agentName && order.status==="pending" && <Btn onClick={()=>onClaim(order.id)} color="#4fc3f7" small>⚡ 接單</Btn>}
        {agentName && order.status==="active" && order.claimedBy===agentName && <Btn onClick={()=>onDone(order.id)} color="#69f0ae" small>✅ 完成</Btn>}
        {isBoss && (
  <>
    {order.status==="pending" && (
      <Btn onClick={()=>onCancel(order.id)} color="#ef5350" small outline>取消訂單</Btn>
    )}
    {order.status==="active" && (
      <>
        <Btn onClick={()=>onDone(order.id)} color="#69f0ae" small>✅ 標記完成</Btn>
        <Btn onClick={()=>onCancel(order.id)} color="#ef5350" small outline>取消訂單</Btn>
      </>
    )}
    {(order.status==="done"||order.status==="cancelled") && (
      <Btn onClick={()=>onDelete(order.id)} color="#ef5350" small outline>🗑️ 刪除</Btn>
    )}
  </>
)}
  <>
    {(order.status==="pending"||order.status==="active") && (
      <>
        {order.status==="active" && <Btn onClick={()=>onDone(order.id)} color="#69f0ae" small>✅ 標記完成</Btn>}
        <Btn onClick={()=>onCancel(order.id)} color="#ef5350" small outline>取消訂單</Btn>
      </>
    )}
    {order.status==="done" && (
      <Btn onClick={()=>onDelete(order.id)} color="#ef5350" small outline>🗑️ 刪除</Btn>
    )}
  </>
)} && (
          <>
            {order.status==="active" && <Btn onClick={()=>onDone(order.id)} color="#69f0ae" small>✅ 標記完成</Btn>}
            <Btn onClick={()=>onCancel(order.id)} color="#ef5350" small outline>取消訂單</Btn>
          </>
        )}
      </div>
    </div>
  );
}
function NewOrderForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({clientName:"",gameId:"",service:"boost",fromRank:"鐵牌",fromTier:"1",toRank:"銀牌",toTier:"1",wins:"5",note:"",urgent:false,price:""});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const svc = SERVICES.find(s=>s.id===form.service);
  const handleSubmit = () => {
    if (!form.clientName.trim()) { alert("請輸入客戶名稱"); return; }
    if (!form.price || isNaN(form.price)) { alert("請輸入有效價格"); return; }
    const id = uid();
    onSubmit({
      id, ...form, price: Number(form.price),
      fromRank: form.service==="boost" ? `${form.fromRank} ${form.fromTier}` : null,
      toRank:   form.service==="boost" ? `${form.toRank} ${form.toTier}` : null,
      wins:     form.service==="win"   ? form.wins : null,
      status:"pending", claimedBy:null,
      createdAt: new Date().toISOString(),
    });
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}}>
      <div style={{background:C.secondary,border:`1px solid ${C.border}`,borderRadius:16,padding:28,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{fontSize:18,fontWeight:800,color:C.text,margin:0}}>➕ 新增訂單</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:10}}>
            <Input label="客戶名稱 *" value={form.clientName} onChange={v=>set("clientName",v)} placeholder="Discord / Line 名稱" />
            <Input label="遊戲ID" value={form.gameId} onChange={v=>set("gameId",v)} placeholder="Riot ID#TAG" />
          </div>
          <Sel label="服務項目" value={form.service} onChange={v=>set("service",v)} options={SERVICES.map(s=>({value:s.id,label:s.label}))} />
          {form.service==="boost" && (
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <Sel label="目前段位" value={form.fromRank} onChange={v=>set("fromRank",v)} options={RANKS.map(r=>({value:r,label:r}))} style={{minWidth:100}} />
              <Sel label="等級" value={form.fromTier} onChange={v=>set("fromTier",v)} options={RANK_TIERS.map(t=>({value:t,label:t}))} style={{maxWidth:80}} />
              <Sel label="目標段位" value={form.toRank} onChange={v=>set("toRank",v)} options={RANKS.map(r=>({value:r,label:r}))} style={{minWidth:100}} />
              <Sel label="等級" value={form.toTier} onChange={v=>set("toTier",v)} options={RANK_TIERS.map(t=>({value:t,label:t}))} style={{maxWidth:80}} />
            </div>
          )}
          {form.service==="win" && <Input label="指定勝場數" value={form.wins} onChange={v=>set("wins",v)} type="number" />}
          <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
            <Input label="報價 (NT$) *" value={form.price} onChange={v=>set("price",v)} type="number" placeholder={String(svc?.base)} />
            <label style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,cursor:"pointer",whiteSpace:"nowrap"}}>
              <input type="checkbox" checked={form.urgent} onChange={e=>set("urgent",e.target.checked)} style={{accentColor:C.primary,width:16,height:16}} />
              <span style={{fontSize:14,color:C.muted}}>🔥 加急</span>
            </label>
          </div>
          <Input label="備註" value={form.note} onChange={v=>set("note",v)} placeholder="特殊要求..." />
        </div>
        <div style={{display:"flex",gap:10,marginTop:22,justifyContent:"flex-end"}}>
          <Btn onClick={onClose} color={C.muted} outline>取消</Btn>
          <Btn onClick={handleSubmit} color={C.primary}>確認新增</Btn>
        </div>
      </div>
    </div>
  );
}

function SnapView({ orders }) {
  const [copied, setCopied] = useState(false);
  const pending = orders.filter(o=>o.status==="pending");
  const lines = pending.length === 0 ? ["目前沒有待接訂單"] : [
    `🎮 VALORANT 接單板`, `${"─".repeat(28)}`,
    ...pending.flatMap(o => [
      ``,`📋 #${o.id}${o.urgent?" 🔥加急":""}`,
      `服務 ▸ ${SERVICES.find(s=>s.id===o.service)?.label}`,
      `客戶 ▸ ${o.clientName}${o.gameId?" ("+o.gameId+")":""}`,
      ...(o.fromRank ? [`段位 ▸ ${o.fromRank} → ${o.toRank}`] : []),
      ...(o.wins ? [`目標 ▸ ${o.wins} 勝`] : []),
      `報酬 ▸ NT$${o.price}`,
      ...(o.note ? [`備注 ▸ ${o.note}`] : []),
    ]),
    ``, `共 ${pending.length} 筆待接單`,
  ];
  const copyText = () => {
    navigator.clipboard.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <span style={{color:C.muted,fontSize:14}}>待接單 · 共 {pending.length} 筆</span>
        <Btn onClick={copyText} color={copied?"#69f0ae":C.accent} small>{copied?"✅ 已複製":"📋 複製文字"}</Btn>
      </div>
      <div style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:18,fontFamily:"monospace",fontSize:13,color:C.text,whiteSpace:"pre-wrap",lineHeight:1.8}}>
        {lines.join("\n")}
      </div>
    </div>
  );
}

function StatsView({ orders }) {
  const monthly = groupByMonth(orders);
  const months = Object.keys(monthly).sort((a,b)=>b.localeCompare(a));
  const totalIncome = orders.filter(o=>o.status==="done").reduce((s,o)=>s+(o.price||0),0);
  const totalDone = orders.filter(o=>o.status==="done").length;
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:24}}>
        {[
          {label:"總訂單", value:orders.length, color:"#4fc3f7"},
          {label:"已完成", value:totalDone, color:"#69f0ae"},
          {label:"總收入", value:`NT$${totalIncome.toLocaleString()}`, color:C.primary},
          {label:"完成率", value:`${orders.length?Math.round(totalDone/orders.length*100):0}%`, color:C.accent},
        ].map(card=>(
          <div key={card.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16,textAlign:"center"}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>{card.label}</div>
            <div style={{fontSize:26,fontWeight:800,color:card.color,marginTop:4}}>{card.value}</div>
          </div>
        ))}
      </div>
      {months.map(mon => {
        const { orders:mo, income } = monthly[mon];
        return (
          <div key={mon} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontWeight:700,color:C.text,fontSize:15}}>{mon}</span>
              <div style={{display:"flex",gap:16}}>
                <span style={{fontSize:13,color:C.muted}}>{mo.length} 筆</span>
                <span style={{fontSize:15,fontWeight:800,color:C.primary}}>NT${income.toLocaleString()}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {Object.entries(STATUS_META).map(([k,sm]) => {
                const cnt = mo.filter(o=>o.status===k).length;
                if (!cnt) return null;
                return <span key={k} style={{padding:"3px 10px",borderRadius:20,fontSize:12,background:sm.bg,color:sm.color}}>{sm.label} {cnt}</span>;
              })}
            </div>
          </div>
        );
      })}
      {months.length===0 && <div style={{textAlign:"center",color:C.muted,padding:"40px 0"}}>尚無訂單資料</div>}
    </div>
  );
}
function LoginScreen({ onEnterAgent, onEnterBoss }) {
  const [name, setName] = useState("");
  const [showBoss, setShowBoss] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [clicks, setClicks] = useState(0);

  const handleTitleClick = () => {
    const n = clicks + 1; setClicks(n);
    if (n >= 5) { setShowBoss(true); setClicks(0); }
  };
  const handleBossLogin = () => {
    if (pw === BOSS_PASSWORD) { onEnterBoss(); }
    else { setPwErr(true); setPw(""); setTimeout(()=>setPwErr(false),1500); }
  };

  return (
    <div style={{background:C.secondary,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Noto Sans TC',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;800&display=swap'); *{box-sizing:border-box;} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{marginBottom:6,display:"flex",alignItems:"center",gap:8,userSelect:"none",cursor:"default"}} onClick={handleTitleClick}>
        <div style={{width:"100vw",position:"relative",left:"50%",transform:"translateX(-50%)",marginBottom:16}}>
  <img src="https://raw.githubusercontent.com/Lakers1010/valorant-boost/main/public/663373622_1670831787406626_3063837288362313925_n.jpg" style={{width:"100%",height:"auto",objectFit:"cover",display:"block"}} />
</div>
<span style={{fontWeight:800,fontSize:28,color:"#f5a623",marginBottom:4,display:"block",textAlign:"center"}}>EZ遊戲代打</span>
      </div>
      <p style={{color:C.muted,fontSize:13,marginBottom:44}}>接單管理系統</p>
      <div style={{width:"100%",maxWidth:340}}>
        {!showBoss ? (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:28}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <span style={{fontSize:32}}>⚡</span>
              <div style={{fontSize:15,fontWeight:700,color:C.text,marginTop:8}}>打手登入</div>
              <div style={{fontSize:12,color:C.muted,marginTop:4}}>輸入你的名字就能開始接單</div>
            </div>
            <input value={name} onChange={e=>setName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&name.trim()&&onEnterAgent(name.trim())}
              placeholder="你的名字（例如：阿志）" maxLength={20} autoFocus
              style={{width:"100%",background:C.surface2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"12px 14px",color:C.text,fontSize:15,outline:"none",fontFamily:"'Noto Sans TC',sans-serif",marginBottom:14,boxSizing:"border-box"}} />
            <button onClick={()=>name.trim()&&onEnterAgent(name.trim())} disabled={!name.trim()}
              style={{width:"100%",padding:13,background:name.trim()?"#4fc3f7":"transparent",border:`1.5px solid ${name.trim()?"#4fc3f7":C.border}`,borderRadius:10,color:name.trim()?C.secondary:C.muted,fontSize:15,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed",fontFamily:"'Noto Sans TC',sans-serif",transition:"all 0.15s"}}>
              進入接單介面 →
            </button>
          </div>
        ) : (
          <div style={{background:C.surface,border:`1.5px solid ${C.primary}`,borderRadius:16,padding:28}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <span style={{fontSize:32}}>🔐</span>
              <div style={{fontSize:15,fontWeight:700,color:C.text,marginTop:8}}>老闆模式</div>
              <div style={{fontSize:12,color:C.muted,marginTop:4}}>輸入管理密碼</div>
            </div>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleBossLogin()} placeholder="密碼" autoFocus
              style={{width:"100%",background:C.surface2,border:`1.5px solid ${pwErr?"#ef5350":C.border}`,borderRadius:10,padding:"12px 14px",color:C.text,fontSize:15,outline:"none",fontFamily:"'Noto Sans TC',sans-serif",marginBottom:pwErr?8:14,boxSizing:"border-box"}} />
            {pwErr && <div style={{fontSize:12,color:"#ef5350",marginBottom:12,textAlign:"center"}}>❌ 密碼錯誤</div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowBoss(false);setPw("");setClicks(0);}}
                style={{flex:1,padding:11,background:"none",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>取消</button>
              <button onClick={handleBossLogin}
                style={{flex:2,padding:11,background:`${C.primary}20`,border:`1.5px solid ${C.primary}`,borderRadius:10,color:C.primary,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>進入</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default function App() {
  const { orders, loading, saveOrder, updateOrder } = useOrders();
  const [tab, setTab] = useState("orders");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = msg => setToast(msg);
  const isBoss = mode === "boss";
  const agentName = (!isBoss && mode) ? mode : null;

  const addOrder = async (order) => {
    await saveOrder(order);
    setShowForm(false); showToast("✅ 訂單已新增！");
  };
  const claimOrder = async (id) => {
    await updateOrder(id, { status:"active", claimedBy:agentName });
    showToast("⚡ 已接單！");
  };
  const doneOrder = async (id) => {
    await updateOrder(id, { status:"done" });
    showToast("🎉 訂單完成！");
  };
  const cancelOrder = async (id) => {
    if (!window.confirm("確認取消此訂單？")) return;
    await updateOrder(id, { status:"cancelled" });
    showToast("訂單已取消");
  };
  const deleteOrder = async (id) => {
  if (!window.confirm("確認刪除此訂單？刪除後無法復原")) return;
  await deleteDoc(doc(db, "orders", id));
  showToast("🗑️ 訂單已刪除");
};

  const BOSS_TABS = [{id:"orders",label:"📋 訂單"},{id:"snap",label:"📸 拍單"},{id:"stats",label:"📊 統計"}];
  const AGENT_TABS = [{id:"orders",label:"📋 接單"},{id:"snap",label:"📸 拍單"}];
  const TABS = isBoss ? BOSS_TABS : AGENT_TABS;

  const visibleOrders = agentName
    ? orders.filter(o => o.status==="pending" || o.claimedBy===agentName)
    : orders;
  const filtered = filter==="all" ? visibleOrders : visibleOrders.filter(o=>o.status===filter);

  if (!mode) return <LoginScreen onEnterAgent={n=>{setMode(n);setTab("orders");}} onEnterBoss={()=>{setMode("boss");setTab("orders");}} />;

  return (
    <div style={{background:C.secondary,minHeight:"100vh",color:C.text,fontFamily:"'Noto Sans TC',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;800&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-track{background:${C.secondary};} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        select option{background:${C.surface2};}
        input::placeholder{color:${C.muted};}
      `}</style>

      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",position:"sticky",top:0,zIndex:50}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.primary,boxShadow:`0 0 8px ${C.primary}`}} />
            <span style={{fontWeight:800,fontSize:15}}>VALORANT 代打管理</span>
          </div>
          <div style={{fontSize:11,marginTop:2}}>
            {isBoss
              ? <span style={{color:C.muted}}>{orders.filter(o=>o.status==="pending").length} 待接 · {orders.filter(o=>o.status==="active").length} 進行中</span>
              : <span style={{color:"#4fc3f7"}}>⚡ {agentName} 的接單介面</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {loading && <span style={{fontSize:11,color:C.muted}}>同步中...</span>}
          <button onClick={()=>{setMode(null);setTab("orders");setFilter("all");}}
            style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
            登出
          </button>
        </div>
      </div>

      <div style={{display:"flex",background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 16px"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"12px 16px",background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?C.primary:"transparent"}`,color:tab===t.id?C.text:C.muted,fontSize:13,fontWeight:tab===t.id?700:400,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif",transition:"all 0.15s",whiteSpace:"nowrap"}}>
            {t.label}
          </button>
        ))}
        {isBoss && tab==="orders" && (
          <div style={{flex:1,display:"flex",justifyContent:"flex-end",alignItems:"center",paddingRight:4}}>
            <Btn onClick={()=>setShowForm(true)} color={C.primary} small>+ 新增訂單</Btn>
          </div>
        )}
      </div>

      <div style={{padding:16,maxWidth:700,margin:"0 auto"}}>
        {tab==="orders" && (
          <>
            <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
              {[{v:"all",l:"全部"},...Object.entries(STATUS_META).map(([v,m])=>({v,l:m.label}))].map(({v,l})=>{
                const cnt = v==="all" ? visibleOrders.length : visibleOrders.filter(o=>o.status===v).length;
                return (
                  <button key={v} onClick={()=>setFilter(v)}
                    style={{padding:"5px 14px",borderRadius:20,fontSize:12,border:`1px solid ${filter===v?C.primary:C.border}`,background:filter===v?`${C.primary}22`:"transparent",color:filter===v?C.primary:C.muted,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif",transition:"all 0.15s"}}>
                    {l} <span style={{opacity:0.7}}>{cnt}</span>
                  </button>
                );
              })}
            </div>
            {loading && orders.length===0
              ? <div style={{textAlign:"center",padding:"60px 0",color:C.muted}}>載入中...</div>
              : filtered.length===0
                ? <div style={{textAlign:"center",padding:"60px 0",color:C.muted}}>{agentName?"目前沒有可接的訂單":"沒有訂單"}</div>
                : filtered.map(o=>(
                    <OrderCard key={o.id} order={o}
                     onClaim={claimOrder} onDone={doneOrder} onCancel={cancelOrder} onDelete={deleteOrder}
                      agentName={agentName} isBoss={isBoss}
                    />
                  ))
            }
          </>
        )}
        {tab==="snap"  && <SnapView orders={orders} />}
        {tab==="stats" && isBoss && <StatsView orders={orders} />}
      </div>

      {showForm && <NewOrderForm onSubmit={addOrder} onClose={()=>setShowForm(false)} />}
      {toast && <Toast msg={toast} onDone={()=>setToast(null)} />}
    </div>
  );
}
