import { useState, useEffect } from "react";

const T = {
  n: { 0:"#FFFFFF",50:"#FAFAF9",100:"#F5F5F4",200:"#E7E5E4",300:"#D6D3D1",400:"#A8A29E",500:"#78716C",600:"#57534E",700:"#44403C",800:"#292524",900:"#1C1917",950:"#0F0E0D" },
  accent: { warm:"#C2A67D", warmLight:"#D4BFA0", warmMuted:"#A8916A", warmFaint:"rgba(194,166,125,0.08)", warmSubtle:"rgba(194,166,125,0.15)" },
  sem: { success:"#6B8F71", successL:"rgba(107,143,113,0.12)", danger:"#C07070", dangerL:"rgba(192,112,112,0.12)", warning:"#C2A24D", warningL:"rgba(194,162,77,0.12)", info:"#7D9AB5", infoL:"rgba(125,154,181,0.12)" },
  game: { p1:"#8B9E8B", p1L:"rgba(139,158,139,0.15)", p2:"#A08B7B", p2L:"rgba(160,139,123,0.15)", danger:"#C07070", dangerBg:"rgba(192,112,112,0.06)", mystery:"#B5A87D", mysteryBg:"rgba(181,168,125,0.1)", freeze:"#7D9AB5", rare:"#9B8DB5", rareBg:"rgba(155,141,181,0.1)" },
  font: { display:"'DM Serif Display',Georgia,serif", head:"'Sora',sans-serif", body:"'IBM Plex Sans',sans-serif", mono:"'IBM Plex Mono',monospace" },
  rad: { sm:"6px", md:"10px", lg:"14px", xl:"20px", full:"9999px" },
};

const useW = () => {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return w;
};

const BP = { mob: 640, tab: 900, desk: 1200 };
const layout = (w) => ({ mob: w < BP.mob, tab: w >= BP.mob && w < BP.tab, desk: w >= BP.tab });

// ===== ATOMS =====
const Badge = ({ label, variant = "neutral", size = "sm" }) => {
  const s = { neutral:{bg:T.n[100],c:T.n[500]}, success:{bg:T.sem.successL,c:T.sem.success}, danger:{bg:T.sem.dangerL,c:T.sem.danger}, warning:{bg:T.sem.warningL,c:T.sem.warning}, info:{bg:T.sem.infoL,c:T.sem.info}, accent:{bg:T.accent.warmFaint,c:T.accent.warmMuted}, rare:{bg:T.game.rareBg,c:T.game.rare} }[variant];
  return <span style={{ background:s.bg, color:s.c, borderRadius:T.rad.full, padding: size==="xs"?"2px 6px":"3px 10px", fontSize: size==="xs"?9:11, fontWeight:500, fontFamily:T.font.body, display:"inline-block", whiteSpace:"nowrap" }}>{label}</span>;
};

const WordPill = ({ word, variant = "neutral", size = "sm" }) => {
  const s = { player1:{bg:T.game.p1L,c:T.game.p1}, player2:{bg:T.game.p2L,c:T.game.p2}, danger:{bg:T.sem.dangerL,c:T.sem.danger}, mystery:{bg:T.game.mysteryBg,c:T.game.mystery}, neutral:{bg:T.n[100],c:T.n[600]} }[variant];
  return <span style={{ background:s.bg, color:s.c, borderRadius:T.rad.full, padding: size==="sm"?"4px 10px":"6px 14px", fontSize: size==="sm"?12:14, fontWeight:500, fontFamily:T.font.body, display:"inline-block" }}>{word}</span>;
};

const Btn = ({ label, variant="primary", size="md", icon, full, onClick, style:sx={} }) => {
  const vars = { primary:{bg:T.n[900],c:T.n[0],b:"none"}, secondary:{bg:T.n[0],c:T.n[700],b:`1px solid ${T.n[200]}`}, accent:{bg:T.accent.warm,c:T.n[0],b:"none"}, ghost:{bg:"transparent",c:T.n[600],b:"none"}, danger:{bg:T.sem.dangerL,c:T.sem.danger,b:"none"} };
  const sizes = { sm:{p:"7px 14px",fs:12}, md:{p:"11px 22px",fs:13}, lg:{p:"14px 28px",fs:15}, xl:{p:"16px 32px",fs:16} };
  const v=vars[variant], sz=sizes[size];
  return <button onClick={onClick} style={{ background:v.bg, color:v.c, border:v.b, borderRadius:T.rad.md, padding:sz.p, fontSize:sz.fs, fontWeight:500, fontFamily:T.font.body, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7, width:full?"100%":"auto", transition:"all 0.15s", ...sx }}>{icon&&<span style={{fontSize:sz.fs+2}}>{icon}</span>}{label}</button>;
};

const Avatar = ({ name, variant="p1", size=36 }) => {
  const c = variant==="p1"?T.game.p1:T.game.p2;
  const bg = variant==="p1"?T.game.p1L:T.game.p2L;
  return <div style={{ width:size, height:size, borderRadius:T.rad.full, background:bg, color:c, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.36, fontWeight:600, fontFamily:T.font.head, flexShrink:0 }}>{name[0].toUpperCase()}</div>;
};

const TimerBar = ({ percent=50, danger=false }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, width:"100%" }}>
    <div style={{ flex:1, height:5, background:T.n[200], borderRadius:T.rad.full, overflow:"hidden" }}>
      <div style={{ width:`${percent}%`, height:"100%", background:danger?T.sem.danger:T.n[400], borderRadius:T.rad.full, transition:"width 0.3s" }} />
    </div>
    <span style={{ fontSize:12, fontWeight:600, fontFamily:T.font.mono, color:danger?T.sem.danger:T.n[600], minWidth:24, textAlign:"right" }}>{danger?"5s":"12s"}</span>
  </div>
);

const Card = ({ children, style:sx={}, onClick }) => (
  <div onClick={onClick} style={{ border:`1px solid ${T.n[200]}`, borderRadius:T.rad.xl, background:T.n[0], overflow:"hidden", cursor:onClick?"pointer":"default", transition:"border-color 0.15s", ...sx }}
    onMouseEnter={e => { if(onClick) e.currentTarget.style.borderColor = T.n[300]; }}
    onMouseLeave={e => { if(onClick) e.currentTarget.style.borderColor = T.n[200]; }}
  >{children}</div>
);

const StatBox = ({ label, value, sub }) => (
  <div style={{ textAlign:"center", flex:1 }}>
    <div style={{ fontSize:20, fontWeight:600, fontFamily:T.font.head, color:T.n[900] }}>{value}</div>
    <div style={{ fontSize:11, color:T.n[400], fontFamily:T.font.body, marginTop:2 }}>{label}</div>
    {sub && <div style={{ fontSize:10, color:T.sem.success, fontFamily:T.font.mono, marginTop:2 }}>{sub}</div>}
  </div>
);

// ===== SIDEBAR (Desktop/Tablet) =====
const Sidebar = ({ navTab, onNav, collapsed }) => {
  const w = collapsed ? 64 : 220;
  const items = [
    { id:"home", icon:"🏠", label:"Home" },
    { id:"league", icon:"🏅", label:"Leagues" },
    { id:"profile", icon:"👤", label:"Profile" },
  ];
  return (
    <div style={{ width:w, height:"100vh", background:T.n[0], borderRight:`1px solid ${T.n[200]}`, display:"flex", flexDirection:"column", padding: collapsed ? "20px 8px" : "24px 14px", position:"fixed", left:0, top:0, transition:"width 0.2s", zIndex:200 }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? "0 0 20px" : "0 6px 24px", borderBottom:`1px solid ${T.n[100]}`, marginBottom:16, textAlign: collapsed ? "center" : "left" }}>
        {collapsed
          ? <div style={{ fontFamily:T.font.display, fontSize:20, color:T.n[900] }}>CB</div>
          : <>
              <div style={{ fontFamily:T.font.display, fontSize:20, color:T.n[900] }}>Chain Battle</div>
              <div style={{ fontSize:10, color:T.n[400], fontFamily:T.font.mono, marginTop:2 }}>Word Slinger · ELO 1,280</div>
            </>
        }
      </div>

      {/* Nav items */}
      <div style={{ display:"flex", flexDirection:"column", gap:2, flex:1 }}>
        {items.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)} style={{
            display:"flex", alignItems:"center", gap:10, padding: collapsed ? "10px" : "10px 12px",
            background: navTab === n.id ? T.n[100] : "transparent", border:"none", borderRadius:T.rad.md,
            cursor:"pointer", transition:"all 0.12s", justifyContent: collapsed ? "center" : "flex-start",
          }}
            onMouseEnter={e => { if(navTab !== n.id) e.currentTarget.style.background = T.n[50]; }}
            onMouseLeave={e => { if(navTab !== n.id) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontSize:18 }}>{n.icon}</span>
            {!collapsed && <span style={{ fontSize:13, fontWeight: navTab === n.id ? 500 : 400, fontFamily:T.font.body, color: navTab === n.id ? T.n[900] : T.n[500] }}>{n.label}</span>}
          </button>
        ))}
      </div>

      {/* Play button at bottom */}
      <div style={{ borderTop:`1px solid ${T.n[100]}`, paddingTop:14 }}>
        <Btn label={collapsed ? "▶" : "Play now"} variant="primary" size={collapsed ? "md" : "lg"} full icon={collapsed ? "" : "▶"} onClick={() => onNav("matching")} />
      </div>
    </div>
  );
};

// ===== BOTTOM NAV (Mobile) =====
const BottomNav = ({ navTab, onNav }) => (
  <div style={{ position:"fixed", bottom:0, left:0, width:"100%", background:T.n[0], borderTop:`1px solid ${T.n[200]}`, display:"flex", justifyContent:"space-around", padding:"6px 0 env(safe-area-inset-bottom, 8px)", zIndex:200 }}>
    {[{ id:"home", icon:"🏠", label:"Home" }, { id:"league", icon:"🏅", label:"League" }, { id:"matching", icon:"▶", label:"Play" }, { id:"profile", icon:"👤", label:"Profile" }].map(n => (
      <button key={n.id} onClick={() => onNav(n.id)} style={{
        display:"flex", flexDirection:"column", alignItems:"center", gap:2, background: n.id === "matching" ? T.n[900] : "none", border:"none", cursor:"pointer",
        padding: n.id === "matching" ? "8px 20px" : "6px 12px", borderRadius: n.id === "matching" ? T.rad.full : 0,
        color: n.id === "matching" ? T.n[0] : navTab === n.id ? T.n[900] : T.n[400], transition:"color 0.15s",
        marginTop: n.id === "matching" ? -12 : 0,
      }}>
        <span style={{ fontSize: n.id === "matching" ? 16 : 18 }}>{n.icon}</span>
        <span style={{ fontSize:10, fontWeight:500, fontFamily:T.font.body }}>{n.label}</span>
      </button>
    ))}
  </div>
);

// ===== SCREEN: HOME =====
const HomeScreen = ({ onNav, L }) => {
  const modes = [
    { name:"Classic Duel", desc:"Best of 5 rounds", icon:"⚔️", players:"2P", time:"3-5 min", featured:true },
    { name:"Speed Round", desc:"Pure speed, no power-ups", icon:"⚡", players:"2P", time:"60-90s" },
    { name:"Theme Battle", desc:"Today: Animals", icon:"🎯", players:"2P", time:"3-5 min" },
    { name:"Daily Gauntlet", desc:"1 attempt per day", icon:"🏆", players:"vs 5", time:"~10 min" },
    { name:"Endless Co-op", desc:"Build the longest chain", icon:"♾️", players:"2P", time:"Until fail" },
    { name:"King of Chain", desc:"Last standing wins", icon:"👑", players:"4P", time:"3-7 min" },
  ];
  const recentMatches = [
    { opp:"Priya", result:"W", score:"3-1", words:22, ago:"2h ago" },
    { opp:"Marcus", result:"L", score:"1-3", words:16, ago:"5h ago" },
    { opp:"Yuki", result:"W", score:"3-2", words:31, ago:"1d ago" },
  ];

  return (
    <div>
      {/* Header — desktop has more space, mobile is compact */}
      {L.mob && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:T.font.display, fontSize:24, color:T.n[900] }}>Chain Battle</div>
            <div style={{ fontSize:11, color:T.n[400], fontFamily:T.font.mono, marginTop:2 }}>Word Slinger · ELO 1,280</div>
          </div>
          <Avatar name="You" variant="p1" size={38} />
        </div>
      )}

      {L.desk && (
        <div style={{ marginBottom:28 }}>
          <div style={{ fontFamily:T.font.display, fontSize:28, color:T.n[900] }}>Welcome back</div>
          <div style={{ fontSize:13, color:T.n[400], marginTop:4 }}>Ready to battle?</div>
        </div>
      )}

      {/* Play button — mobile only (desktop has it in sidebar) */}
      {L.mob && <Btn label="Play now" variant="primary" size="lg" icon="▶" full onClick={() => onNav("matching")} style={{ marginBottom:18 }} />}

      {/* Top section: stats + challenge — side by side on desktop */}
      <div style={{ display: L.desk ? "flex" : "block", gap:16, marginBottom: L.mob ? 18 : 24 }}>
        {/* Stats */}
        <div style={{ display:"flex", gap:8, flex:1, marginBottom: L.desk ? 0 : 12 }}>
          {[["Wins","142","+3 today"],["Streak","🔥 7",null],["Best chain","34",null],["ELO","1,280","+12"]].map(([l,v,s],i) => (
            <Card key={i} style={{ flex:1, padding: L.mob ? "10px" : "14px 16px" }}>
              <StatBox label={l} value={v} sub={s} />
            </Card>
          ))}
        </div>

        {/* Daily challenge */}
        <Card style={{ padding: L.mob ? "12px 14px" : "16px 20px", background:T.accent.warmFaint, borderColor:T.accent.warmLight, flex: L.desk ? "0 0 320px" : "auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:22 }}>📩</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, fontFamily:T.font.head, color:T.n[800] }}>Priya challenged you!</div>
              <div style={{ fontSize:12, color:T.n[500] }}>"Beat my 18-word chain?"</div>
            </div>
            <Btn label="Accept" variant="accent" size="sm" />
          </div>
        </Card>
      </div>

      {/* Game modes */}
      <div style={{ marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", color:T.n[400] }}>Game modes</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns: L.mob ? "1fr 1fr" : L.tab ? "1fr 1fr 1fr" : "1fr 1fr 1fr", gap:8, marginBottom: L.mob ? 18 : 24 }}>
        {modes.map((m, i) => (
          <Card key={i} onClick={() => onNav("matching")} style={{ padding: L.mob ? "12px" : "16px", borderColor: m.featured ? T.n[400] : T.n[200] }}>
            <div style={{ fontSize: L.mob ? 20 : 24, marginBottom:6 }}>{m.icon}</div>
            <div style={{ fontSize: L.mob ? 12 : 13, fontWeight:500, fontFamily:T.font.head, color:T.n[800], marginBottom:2 }}>{m.name}</div>
            <div style={{ fontSize:11, color:T.n[400], marginBottom:8 }}>{m.desc}</div>
            <div style={{ display:"flex", gap:4 }}>
              <Badge label={m.players} variant="neutral" size="xs" />
              <Badge label={m.time} variant="neutral" size="xs" />
            </div>
          </Card>
        ))}
      </div>

      {/* Recent matches — on desktop, show as a compact table-like layout */}
      <div style={{ marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", color:T.n[400] }}>Recent matches</span>
      </div>
      <Card style={{ overflow:"hidden" }}>
        {recentMatches.map((m, i) => (
          <div key={i} style={{ padding: L.mob ? "10px 14px" : "12px 20px", display:"flex", alignItems:"center", gap: L.mob ? 10 : 14, borderBottom: i < recentMatches.length - 1 ? `1px solid ${T.n[100]}` : "none" }}>
            <Avatar name={m.opp} variant="p2" size={L.mob ? 30 : 34} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, fontFamily:T.font.head, color:T.n[800] }}>vs {m.opp}</div>
              <div style={{ fontSize:11, color:T.n[400], fontFamily:T.font.mono }}>{m.words} words · {m.ago}</div>
            </div>
            <Badge label={m.result === "W" ? "Victory" : "Defeat"} variant={m.result === "W" ? "success" : "danger"} />
            <span style={{ fontSize:13, fontWeight:600, fontFamily:T.font.mono, color:T.n[700], minWidth:32, textAlign:"right" }}>{m.score}</span>
            {!L.mob && <Btn label="Rematch" variant="ghost" size="sm" onClick={() => onNav("matching")} />}
          </div>
        ))}
      </Card>
    </div>
  );
};

// ===== SCREEN: MATCHMAKING =====
const MatchingScreen = ({ onNav, L }) => {
  const [dots, setDots] = useState("");
  useEffect(() => { const i = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500); return () => clearInterval(i); }, []);
  useEffect(() => { const t = setTimeout(() => onNav("game"), 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight: L.mob ? "100vh" : "80vh", textAlign:"center", padding:20 }}>
      <div style={{ width:72, height:72, borderRadius:T.rad.full, border:`3px solid ${T.n[200]}`, borderTopColor:T.n[900], animation:"spin 1s linear infinite", marginBottom:24 }} />
      <div style={{ fontFamily:T.font.display, fontSize: L.mob ? 22 : 26, color:T.n[900], marginBottom:4 }}>Finding opponent{dots}</div>
      <div style={{ fontSize:13, color:T.n[400], marginBottom:28 }}>Classic Duel · Best of 5</div>
      <div style={{ display:"flex", alignItems:"center", gap:28, marginBottom:28 }}>
        <div style={{ textAlign:"center" }}>
          <Avatar name="You" variant="p1" size={52} />
          <div style={{ fontSize:12, fontWeight:500, fontFamily:T.font.head, color:T.n[700], marginTop:6 }}>You</div>
          <div style={{ fontSize:10, color:T.n[400], fontFamily:T.font.mono }}>ELO 1,280</div>
        </div>
        <span style={{ fontSize:14, fontWeight:500, color:T.n[300] }}>VS</span>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:52, height:52, borderRadius:T.rad.full, background:T.n[100], border:`2px dashed ${T.n[200]}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:T.n[300] }}>?</div>
          <div style={{ fontSize:12, fontWeight:500, fontFamily:T.font.head, color:T.n[400], marginTop:6 }}>Searching</div>
          <div style={{ fontSize:10, color:T.n[300], fontFamily:T.font.mono }}>ELO ±200</div>
        </div>
      </div>
      <Btn label="Cancel" variant="ghost" size="sm" onClick={() => onNav("home")} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ===== SCREEN: GAME =====
const GameScreen = ({ onNav, L }) => {
  const [time, setTime] = useState(73);
  const [inputVal, setInputVal] = useState("");
  const [showPower, setShowPower] = useState(false);
  const chain = [
    {w:"tiger",p:1},{w:"rabbit",p:2},{w:"top",p:1},{w:"penguin",p:2},
    {w:"never",p:1},{w:"reptile",p:2},{w:"eagle",p:1},{w:"early",p:2},
    {w:"yoga",p:1},{w:"animals",p:2},{w:"snowflake",p:1},
  ];
  const lastLetter = chain[chain.length - 1].w.slice(-1).toUpperCase();
  useEffect(() => { const i = setInterval(() => setTime(t => t > 0 ? t - 1 : 0), 1000); return () => clearInterval(i); }, []);

  const powers = [
    { icon:"❄️", name:"Freeze", count:2 },
    { icon:"💣", name:"Letter Bomb", count:1 },
    { icon:"🛡️", name:"Second Life", count:1 },
  ];

  // Desktop: wider layout with chain + sidebar info
  if (L.desk) {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 1px)" }}>
        {/* Top bar */}
        <div style={{ background:T.n[0], borderBottom:`1px solid ${T.n[200]}`, padding:"12px 28px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => onNav("home")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:T.n[400], padding:4 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:600, fontFamily:T.font.head, color:T.n[900] }}>Classic Duel</div>
            <div style={{ fontSize:11, color:T.n[400], fontFamily:T.font.mono }}>Round 3 of 5</div>
          </div>
          <div style={{ fontSize:20, fontWeight:600, fontFamily:T.font.mono, color:T.n[800] }}>2 – 1</div>
        </div>

        {/* Main area: chain + sidebar */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {/* Chain area */}
          <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
            {/* Players */}
            <div style={{ padding:"12px 28px", display:"flex", alignItems:"center", borderBottom:`1px solid ${T.n[100]}`, background:T.n[0] }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
                <Avatar name="You" variant="p1" size={34} />
                <div>
                  <div style={{ fontSize:13, fontWeight:500, fontFamily:T.font.head, color:T.n[800] }}>You</div>
                  <div style={{ fontSize:11, color:T.n[400], fontFamily:T.font.mono }}>142 pts</div>
                </div>
              </div>
              <span style={{ fontSize:12, color:T.n[300], fontWeight:500, padding:"0 16px" }}>VS</span>
              <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, justifyContent:"flex-end" }}>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:500, fontFamily:T.font.head, color:T.n[800] }}>Priya</div>
                  <div style={{ fontSize:11, color:T.n[400], fontFamily:T.font.mono }}>128 pts</div>
                </div>
                <Avatar name="Priya" variant="p2" size={34} />
              </div>
            </div>

            {/* Chain */}
            <div style={{ flex:1, overflow:"auto", padding:"24px 28px", display:"flex", flexWrap:"wrap", gap:8, alignContent:"center", justifyContent:"center" }}>
              {chain.map((c, i) => (
                <WordPill key={i} word={c.w} variant={c.p===1?"player1":"player2"} size="md" />
              ))}
            </div>

            {/* Timer + Input */}
            <div style={{ background:T.n[0], borderTop:`1px solid ${T.n[200]}`, padding:"14px 28px 18px" }}>
              <div style={{ marginBottom:12, maxWidth:600 }}>
                <TimerBar percent={time} />
              </div>
              <div style={{ display:"flex", gap:10, maxWidth:600 }}>
                <button onClick={() => setShowPower(!showPower)} style={{ background:showPower?T.n[900]:T.n[100], color:showPower?T.n[0]:T.n[600], border:`1px solid ${showPower?T.n[900]:T.n[200]}`, borderRadius:T.rad.md, padding:"12px 14px", cursor:"pointer", fontSize:16, transition:"all 0.15s" }}>⚡</button>
                <input value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder={`Type a word starting with ${lastLetter}…`} style={{ flex:1, border:`1px solid ${T.n[200]}`, borderRadius:T.rad.md, padding:"12px 18px", fontSize:16, fontFamily:T.font.body, color:T.n[900], outline:"none" }} />
                <Btn label="Play" variant="primary" size="lg" onClick={() => onNav("result")} />
              </div>
            </div>
          </div>

          {/* Right sidebar — power-ups + reactions */}
          <div style={{ width:220, background:T.n[0], borderLeft:`1px solid ${T.n[200]}`, padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", color:T.n[400] }}>Power-ups</div>
            {powers.map((p, i) => (
              <button key={i} style={{ background:T.n[50], border:`1px solid ${T.n[200]}`, borderRadius:T.rad.md, padding:"10px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, textAlign:"left", width:"100%" }}>
                <span style={{ fontSize:18 }}>{p.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:T.n[700], fontFamily:T.font.body }}>{p.name}</div>
                  <div style={{ fontSize:10, color:T.n[400], fontFamily:T.font.mono }}>×{p.count}</div>
                </div>
              </button>
            ))}

            <div style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", color:T.n[400], marginTop:8 }}>Reactions</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
              {["🔥","😱","💀","👏","😤","🤯"].map((e,i) => (
                <button key={i} style={{ background:T.n[50], border:`1px solid ${T.n[200]}`, borderRadius:T.rad.md, padding:"8px", cursor:"pointer", fontSize:20, textAlign:"center", transition:"all 0.12s" }}
                  onMouseEnter={ev => { ev.currentTarget.style.background = T.n[100]; }}
                  onMouseLeave={ev => { ev.currentTarget.style.background = T.n[50]; }}
                >{e}</button>
              ))}
            </div>

            <div style={{ flex:1 }} />
            <div style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", color:T.n[400] }}>Match info</div>
            <div style={{ fontSize:12, color:T.n[500], lineHeight:1.6 }}>
              <div>Chain length: <span style={{ fontFamily:T.font.mono, color:T.n[800] }}>{chain.length}</span></div>
              <div>Your words: <span style={{ fontFamily:T.font.mono, color:T.game.p1 }}>6</span></div>
              <div>Their words: <span style={{ fontFamily:T.font.mono, color:T.game.p2 }}>5</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile / Tablet game layout
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:T.n[50] }}>
      <div style={{ background:T.n[0], borderBottom:`1px solid ${T.n[200]}`, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={() => onNav("home")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:T.n[400], padding:4 }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, fontFamily:T.font.head, color:T.n[900] }}>Classic Duel</div>
          <div style={{ fontSize:11, color:T.n[400], fontFamily:T.font.mono }}>Round 3 of 5</div>
        </div>
        <div style={{ fontSize:16, fontWeight:600, fontFamily:T.font.mono, color:T.n[800] }}>2 – 1</div>
      </div>

      <div style={{ background:T.n[0], padding:"10px 14px", display:"flex", alignItems:"center", borderBottom:`1px solid ${T.n[100]}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
          <Avatar name="You" variant="p1" size={28} />
          <div>
            <div style={{ fontSize:12, fontWeight:500, fontFamily:T.font.head, color:T.n[800] }}>You</div>
            <div style={{ fontSize:10, color:T.n[400], fontFamily:T.font.mono }}>142 pts</div>
          </div>
        </div>
        <span style={{ fontSize:11, color:T.n[300], fontWeight:500 }}>VS</span>
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, justifyContent:"flex-end" }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:12, fontWeight:500, fontFamily:T.font.head, color:T.n[800] }}>Priya</div>
            <div style={{ fontSize:10, color:T.n[400], fontFamily:T.font.mono }}>128 pts</div>
          </div>
          <Avatar name="Priya" variant="p2" size={28} />
        </div>
      </div>

      <div style={{ flex:1, overflow:"auto", padding:14, display:"flex", flexWrap:"wrap", gap:6, alignContent:"center", justifyContent:"center" }}>
        {chain.map((c,i) => <WordPill key={i} word={c.w} variant={c.p===1?"player1":"player2"} size="sm" />)}
      </div>

      <div style={{ background:T.n[0], borderTop:`1px solid ${T.n[200]}`, padding:"10px 14px 12px" }}>
        <div style={{ marginBottom:10 }}><TimerBar percent={time} /></div>
        {showPower && (
          <div style={{ display:"flex", gap:6, marginBottom:10, overflowX:"auto" }}>
            {powers.map((p,i) => (
              <button key={i} style={{ background:T.n[100], border:`1px solid ${T.n[200]}`, borderRadius:T.rad.md, padding:"6px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:5, fontSize:12, fontFamily:T.font.body, color:T.n[700], whiteSpace:"nowrap", flexShrink:0 }}>
                <span>{p.icon}</span><span style={{ fontWeight:500 }}>{p.name}</span><span style={{ fontSize:10, color:T.n[400], fontFamily:T.font.mono }}>×{p.count}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => setShowPower(!showPower)} style={{ background:showPower?T.n[900]:T.n[100], color:showPower?T.n[0]:T.n[600], border:`1px solid ${showPower?T.n[900]:T.n[200]}`, borderRadius:T.rad.md, padding:"10px 12px", cursor:"pointer", fontSize:16, transition:"all 0.15s" }}>⚡</button>
          <input value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder={`Word starting with ${lastLetter}…`} style={{ flex:1, border:`1px solid ${T.n[200]}`, borderRadius:T.rad.md, padding:"10px 12px", fontSize:15, fontFamily:T.font.body, color:T.n[900], outline:"none", minWidth:0 }} />
          <Btn label="→" variant="primary" size="md" onClick={() => onNav("result")} />
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:8 }}>
          {["🔥","😱","💀","👏","😤","🤯"].map((e,i) => <button key={i} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", padding:3, opacity:0.5 }}>{e}</button>)}
        </div>
      </div>
    </div>
  );
};

// ===== SCREEN: RESULT =====
const ResultScreen = ({ onNav, L }) => {
  const chain = ["tiger","rabbit","top","penguin","never","reptile","eagle","early","yoga","animals","snowflake","elephant","tundra","antelope"];
  const maxW = L.desk ? 720 : 520;
  return (
    <div style={{ padding: L.mob ? "20px 16px 100px" : "32px 40px" }}>
      <div style={{ maxWidth:maxW, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:6 }}>🏆</div>
          <div style={{ fontFamily:T.font.display, fontSize: L.mob ? 26 : 32, color:T.n[900], marginBottom:4 }}>Victory!</div>
          <div style={{ fontSize:13, color:T.n[400] }}>Classic Duel · 14-word chain</div>
        </div>

        {/* Desktop: score + chain side by side */}
        <div style={{ display: L.desk ? "flex" : "block", gap:16, marginBottom:16 }}>
          <Card style={{ padding: L.mob ? "16px" : "22px", flex: L.desk ? 1 : "auto", marginBottom: L.desk ? 0 : 12 }}>
            <div style={{ display:"flex", justifyContent:"space-around", alignItems:"center", marginBottom:16 }}>
              <div style={{ textAlign:"center" }}>
                <Avatar name="You" variant="p1" size={44} />
                <div style={{ fontSize:13, fontWeight:500, fontFamily:T.font.head, color:T.game.p1, marginTop:6 }}>You</div>
                <div style={{ fontSize:32, fontWeight:600, fontFamily:T.font.head, color:T.n[900] }}>3</div>
              </div>
              <div style={{ fontSize:13, color:T.n[300], fontWeight:500 }}>VS</div>
              <div style={{ textAlign:"center" }}>
                <Avatar name="Priya" variant="p2" size={44} />
                <div style={{ fontSize:13, fontWeight:500, fontFamily:T.font.head, color:T.game.p2, marginTop:6 }}>Priya</div>
                <div style={{ fontSize:32, fontWeight:600, fontFamily:T.font.head, color:T.n[400] }}>1</div>
              </div>
            </div>
            <div style={{ display:"flex", borderTop:`1px solid ${T.n[100]}`, paddingTop:12 }}>
              <StatBox label="Words" value="14" />
              <StatBox label="Best" value="snowflake" />
              <StatBox label="XP" value="+150" sub="×1.5" />
            </div>
          </Card>

          <Card style={{ padding: L.mob ? "14px" : "18px", flex: L.desk ? 1 : "auto", textAlign:"left" }}>
            <div style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", color:T.n[400], marginBottom:8 }}>Full chain</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {chain.map((w,i) => <WordPill key={i} word={w} variant={i%2===0?"player1":"player2"} size="sm" />)}
            </div>
          </Card>
        </div>

        {/* Bottom cards */}
        <div style={{ display: L.desk ? "flex" : "block", gap:12, marginBottom:20 }}>
          <Card style={{ padding: L.mob ? "12px 14px" : "16px 18px", flex:1, marginBottom: L.desk ? 0 : 8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <span style={{ fontSize:16 }}>⚡</span>
              <span style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em", color:T.n[400] }}>Power-ups used</span>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {[{icon:"❄️",name:"Freeze",by:"You"},{icon:"💣",name:"Letter Bomb",by:"Priya"}].map((p,i) => (
                <div key={i} style={{ background:T.n[50], border:`1px solid ${T.n[200]}`, borderRadius:T.rad.md, padding:"8px 10px", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:14 }}>{p.icon}</span>
                  <div><div style={{ fontSize:11, fontWeight:500, color:T.n[700] }}>{p.name}</div><div style={{ fontSize:10, color:T.n[400] }}>by {p.by}</div></div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ padding: L.mob ? "12px 14px" : "16px 18px", flex:1, background:T.accent.warmFaint, borderColor:T.accent.warmLight }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>🏅</span>
              <div>
                <div style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em", color:T.accent.warmMuted, marginBottom:2 }}>Achievement unlocked</div>
                <div style={{ fontSize:14, fontWeight:500, fontFamily:T.font.head, color:T.n[800] }}>Chain Forger</div>
                <div style={{ fontSize:11, color:T.n[500] }}>Win 50 matches + 20-word chain</div>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <Btn label="Rematch" variant="primary" size="lg" full onClick={() => onNav("matching")} />
          <Btn label="Share" variant="secondary" size="lg" icon="↗" />
          <Btn label="Home" variant="ghost" size="lg" onClick={() => onNav("home")} />
        </div>
      </div>
    </div>
  );
};

// ===== SCREEN: PROFILE =====
const ProfileScreen = ({ onNav, L }) => {
  const badges = [
    {icon:"📚",name:"Vocab Lord",done:true},{icon:"⚡",name:"Speed Demon",done:true},
    {icon:"🔗",name:"Chain Master",done:false},{icon:"🔄",name:"Comeback King",done:true},
    {icon:"🌍",name:"Linguist",done:false},{icon:"💀",name:"Danger Dweller",done:false},
    {icon:"⚔️",name:"Rival Hunter",done:true},{icon:"🏆",name:"Tournament Victor",done:false},
  ];
  const rivals = [{name:"Priya",record:"8-5",elo:1340},{name:"Marcus",record:"3-6",elo:1420},{name:"Yuki",record:"5-5",elo:1290}];

  return (
    <div style={{ maxWidth: L.desk ? 760 : 640, margin:"0 auto" }}>
      {/* Desktop: profile header side by side with XP */}
      <div style={{ display: L.desk ? "flex" : "block", gap:16, marginBottom:20 }}>
        <Card style={{ padding: L.mob ? "18px" : "24px", textAlign:"center", flex: L.desk ? "0 0 240px" : "auto", marginBottom: L.desk ? 0 : 12 }}>
          <Avatar name="You" variant="p1" size={L.mob ? 52 : 64} />
          <div style={{ fontFamily:T.font.display, fontSize: L.mob ? 20 : 24, color:T.n[900], marginTop:8 }}>ChainMaster42</div>
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:6 }}>
            <Badge label="Chain Forger" variant="info" />
            <Badge label="ELO 1,280" variant="neutral" />
          </div>
        </Card>

        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:12 }}>
          <Card style={{ padding: L.mob ? "14px" : "18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontSize:12, fontWeight:500, fontFamily:T.font.head, color:T.n[700] }}>Level 14</span>
              <span style={{ fontSize:11, color:T.n[400], fontFamily:T.font.mono }}>2,450 / 3,000 XP</span>
            </div>
            <div style={{ height:6, background:T.n[200], borderRadius:T.rad.full, overflow:"hidden" }}>
              <div style={{ width:"82%", height:"100%", background:T.accent.warm, borderRadius:T.rad.full }} />
            </div>
            <div style={{ fontSize:11, color:T.n[400], marginTop:6 }}>Next: Neon chain theme at Level 15</div>
          </Card>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
            {[["Matches","312"],["Wins","142"],["Win %","45.5%"],["Best","34"]].map(([l,v],i) => (
              <Card key={i} style={{ padding:"12px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:600, fontFamily:T.font.head, color:T.n[900] }}>{v}</div>
                <div style={{ fontSize:10, color:T.n[400], marginTop:2 }}>{l}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Badges + Rivals: side by side on desktop */}
      <div style={{ display: L.desk ? "flex" : "block", gap:16 }}>
        <div style={{ flex:1 }}>
          <div style={{ marginBottom:6 }}><span style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", color:T.n[400] }}>Badges</span></div>
          <div style={{ display:"grid", gridTemplateColumns: L.mob ? "1fr 1fr" : "1fr 1fr", gap:8, marginBottom: L.desk ? 0 : 20 }}>
            {badges.map((b,i) => (
              <Card key={i} style={{ padding:"10px 12px", display:"flex", alignItems:"center", gap:8, opacity:b.done?1:0.4 }}>
                <span style={{ fontSize:18 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:500, color:T.n[700] }}>{b.name}</div>
                  <div style={{ fontSize:10, color:b.done?T.sem.success:T.n[400] }}>{b.done?"Earned":"Locked"}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ marginBottom:6 }}><span style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", color:T.n[400] }}>Rivals</span></div>
          {rivals.map((r,i) => (
            <Card key={i} style={{ padding: L.mob ? "10px 14px" : "12px 16px", marginBottom:6, display:"flex", alignItems:"center", gap:10 }}>
              <Avatar name={r.name} variant="p2" size={32} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500, fontFamily:T.font.head, color:T.n[800] }}>{r.name}</div>
                <div style={{ fontSize:11, color:T.n[400], fontFamily:T.font.mono }}>ELO {r.elo}</div>
              </div>
              <div style={{ fontSize:13, fontWeight:600, fontFamily:T.font.mono, color:T.n[700] }}>{r.record}</div>
              <Btn label="Challenge" variant="secondary" size="sm" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

// ===== SCREEN: LEAGUE =====
const LeagueScreen = ({ onNav, L }) => {
  const members = [
    {name:"Priya",w:18,l:4,pts:1840,streak:5,you:false},
    {name:"You",w:14,l:6,pts:1620,streak:3,you:true},
    {name:"Marcus",w:12,l:8,pts:1380,streak:0,you:false},
    {name:"Yuki",w:10,l:10,pts:1200,streak:2,you:false},
    {name:"Alex",w:8,l:12,pts:980,streak:0,you:false},
  ];
  return (
    <div style={{ maxWidth: L.desk ? 760 : 640, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:T.font.display, fontSize: L.mob ? 20 : 24, color:T.n[900] }}>Word Nerds 🧠</div>
          <div style={{ fontSize:12, color:T.n[400], fontFamily:T.font.mono }}>Season 12 · Ends in 3 days</div>
        </div>
        <Btn label="Invite" variant="secondary" size="sm" icon="+" />
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {[["Total matches","62"],["Members","5"],["Best chain","47"]].map(([l,v],i) => (
          <Card key={i} style={{ flex:1, padding:"12px", textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:600, fontFamily:T.font.head, color:T.n[900] }}>{v}</div>
            <div style={{ fontSize:10, color:T.n[400] }}>{l}</div>
          </Card>
        ))}
      </div>

      <Card style={{ overflow:"hidden" }}>
        <div style={{ display:"flex", padding: L.mob ? "10px 14px" : "10px 20px", background:T.n[50], borderBottom:`1px solid ${T.n[200]}`, fontSize:10, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em", color:T.n[400] }}>
          <div style={{ width:32, textAlign:"center" }}>#</div>
          <div style={{ flex:1, paddingLeft:8 }}>Player</div>
          <div style={{ width:50, textAlign:"center" }}>W</div>
          <div style={{ width:50, textAlign:"center" }}>L</div>
          <div style={{ width:60, textAlign:"center" }}>Streak</div>
          <div style={{ width:70, textAlign:"right" }}>Points</div>
          {L.desk && <div style={{ width:100 }} />}
        </div>
        {members.map((m,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", padding: L.mob ? "10px 14px" : "12px 20px", borderBottom:i<members.length-1?`1px solid ${T.n[100]}`:"none", background:m.you?T.game.p1L:"transparent" }}>
            <div style={{ width:32, textAlign:"center", fontSize:13, fontWeight:600, fontFamily:T.font.mono, color:i===0?T.accent.warm:T.n[500] }}>{i+1}</div>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, paddingLeft:8 }}>
              <Avatar name={m.name} variant={m.you?"p1":"p2"} size={L.mob?26:30} />
              <span style={{ fontSize:13, fontWeight:500, fontFamily:T.font.head, color:T.n[800] }}>{m.name}</span>
              {m.you && <span style={{ fontSize:10, color:T.n[400] }}>(you)</span>}
            </div>
            <div style={{ width:50, textAlign:"center", fontSize:12, fontFamily:T.font.mono, color:T.sem.success }}>{m.w}</div>
            <div style={{ width:50, textAlign:"center", fontSize:12, fontFamily:T.font.mono, color:T.sem.danger }}>{m.l}</div>
            <div style={{ width:60, textAlign:"center", fontSize:12, fontFamily:T.font.mono, color:T.n[600] }}>{m.streak>0?`🔥${m.streak}`:"—"}</div>
            <div style={{ width:70, textAlign:"right", fontSize:13, fontWeight:600, fontFamily:T.font.mono, color:T.n[800] }}>{m.pts.toLocaleString()}</div>
            {L.desk && <div style={{ width:100, textAlign:"right" }}><Btn label="Challenge" variant="ghost" size="sm" onClick={() => onNav("matching")} /></div>}
          </div>
        ))}
      </Card>
    </div>
  );
};

// ===== MAIN APP =====
export default function App() {
  const [screen, setScreen] = useState("home");
  const [navTab, setNavTab] = useState("home");
  const w = useW();
  const L = layout(w);

  const onNav = (s) => {
    setScreen(s);
    if (["home","profile","league"].includes(s)) setNavTab(s);
  };

  const showNav = !["game","matching"].includes(screen);
  const showSidebar = !L.mob && showNav;
  const sidebarW = L.tab ? 64 : 220;

  const renderScreen = () => {
    switch (screen) {
      case "home": return <HomeScreen onNav={onNav} L={L} />;
      case "matching": return <MatchingScreen onNav={onNav} L={L} />;
      case "game": return <GameScreen onNav={onNav} L={L} />;
      case "result": return <ResultScreen onNav={onNav} L={L} />;
      case "profile": return <ProfileScreen onNav={onNav} L={L} />;
      case "league": return <LeagueScreen onNav={onNav} L={L} />;
      default: return <HomeScreen onNav={onNav} L={L} />;
    }
  };

  return (
    <div style={{ fontFamily:T.font.body, color:T.n[800], background:T.n[50], minHeight:"100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Desktop/Tablet sidebar */}
      {showSidebar && <Sidebar navTab={navTab} onNav={onNav} collapsed={L.tab} />}

      {/* Main content area */}
      <div style={{
        marginLeft: showSidebar ? sidebarW : 0,
        padding: L.mob ? "16px 16px 80px" : showSidebar ? "28px 36px" : 0,
        transition: "margin-left 0.2s",
        minHeight: "100vh",
      }}>
        {renderScreen()}
      </div>

      {/* Mobile bottom nav */}
      {L.mob && showNav && <BottomNav navTab={navTab} onNav={onNav} />}
    </div>
  );
}
