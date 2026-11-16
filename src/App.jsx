import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Users, Shuffle, Trophy, History, Plus, Trash2, Play, RotateCcw, Check, X, Clock3, Medal, UserRound, LayoutDashboard, ChevronRight, CircleHelp, Download, Pencil, Save } from 'lucide-react';

const STORE = 'openplay-v1';
const blank = { players: [], matches: [], current: null, round: 0, session: 'Open Play Session', activeTab: 'dashboard' };
const uid = () => Math.random().toString(36).slice(2, 10);
const shuffle = (a) => [...a].sort(() => Math.random() - .5);
// Fair rotation: shuffle first (random tie-break), then favour players with the fewest games played.
const fair = (a) => shuffle(a).sort((x, y) => (x.played || 0) - (y.played || 0));
const winRate = p => p.wins + p.losses ? p.wins / (p.wins + p.losses) : 0;
const record = p => `${p.wins}-${p.losses}`;

function App() {
  const [data, setData] = useState(() => { try { return { ...blank, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return blank; } });
  const [form, setForm] = useState({ name: '', gender: 'Male' });
  const [selCat, setSelCat] = useState('Mixed');
  const [notice, setNotice] = useState('');
  const [winner, setWinner] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [filter, setFilter] = useState('All');
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => localStorage.setItem(STORE, JSON.stringify(data)), [data]);
  const update = patch => setData(d => ({ ...d, ...patch }));
  const toast = msg => { setNotice(msg); window.clearTimeout(window.__opToast); window.__opToast = window.setTimeout(() => setNotice(''), 2800); };
  const players = data.players;
  const matches = data.matches;
  const eligible = () => players.filter(p => !p.paused);
  const activeCount = players.filter(p => !p.paused).length;
  const played = matches.length;
  const sortedPlayers = useMemo(() => [...players].sort((a,b) => b.wins-a.wins || winRate(b)-winRate(a) || a.losses-b.losses || a.name.localeCompare(b.name)), [players]);

  function addPlayer(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) return toast('That player is already registered.');
    update({ players: [...players, { id: uid(), name, gender: form.gender, wins: 0, losses: 0, played: 0, paused: false }] });
    setForm(f => ({ ...f, name: '' })); toast(`${name} added to the player list.`);
  }
  function removePlayer(id) {
    if (data.current?.teamA.concat(data.current.teamB).includes(id)) return toast('This player is in the active match. Finish or cancel the match first.');
    update({ players: players.filter(p => p.id !== id) });
  }
  function togglePause(id) { update({ players: players.map(p => p.id === id ? { ...p, paused: !p.paused } : p) }); }

  // Choose a four-player group for a category. Mixed matches require two men and two women.
  function chooseFour(category) {
    const pool = eligible();
    if (category === 'Genderless') return pool.length >= 4 ? fair(pool).slice(0,4) : null;
    if (category === 'Mixed') {
      const men = fair(pool.filter(p => p.gender === 'Male'));
      const women = fair(pool.filter(p => p.gender === 'Female'));
      if (men.length < 2 || women.length < 2) return null;
      return [...men.slice(0,2), ...women.slice(0,2)];
    }
    const gender = category === "Men's" ? 'Male' : 'Female';
    const group = fair(pool.filter(p => p.gender === gender));
    return group.length >= 4 ? group.slice(0,4) : null;
  }
  function createMatch(category) {
    if (data.current) return toast('Finish or cancel the active match before creating another.');
    const group = chooseFour(category);
    if (!group) return toast(category === 'Mixed' ? 'Mixed doubles needs at least 2 active men and 2 active women.' : category === 'Genderless' ? 'Genderless doubles needs at least 4 active players.' : ` ${category} needs at least 4 active players of the matching gender.`);
    let teamA, teamB;
    if (data.round === 0 || matches.length === 0 || category === 'Genderless') {
      // Round one (and every Genderless match) is intentionally random.
      const shuffled = shuffle(group);
      if (category === 'Mixed') {
        const men = shuffled.filter(p => p.gender === 'Male'); const women = shuffled.filter(p => p.gender === 'Female');
        const [m1,m2] = shuffle(men); const [w1,w2] = shuffle(women);
        teamA = [m1.id,w1.id]; teamB = [m2.id,w2.id];
      } else { teamA = shuffled.slice(0,2).map(p=>p.id); teamB = shuffled.slice(2).map(p=>p.id); }
    } else {
      const previousPairs = new Set(matches.flatMap(m => [m.teamA, m.teamB]).map(pair => [...pair].sort().join('|')));
      const combos = category === 'Mixed'
        ? group.filter(p=>p.gender==='Male').flatMap(m => group.filter(p=>p.gender==='Female').map(f=>[m,f]))
        : group.flatMap((p,i)=>group.slice(i+1).map(q=>[p,q]));
      const partitions = [];
      for (let i=0;i<combos.length;i++) for (let j=i+1;j<combos.length;j++) {
        const a=combos[i], b=combos[j];
        if (new Set([...a,...b].map(p=>p.id)).size !== 4) continue;
        const keyA=a.map(p=>p.id).sort().join('|'), keyB=b.map(p=>p.id).sort().join('|');
        const duplicate = previousPairs.has(keyA) || previousPairs.has(keyB);
        const rateA=(winRate(a[0])+winRate(a[1]))/2, rateB=(winRate(b[0])+winRate(b[1]))/2;
        const partnerGap=Math.abs(winRate(a[0])-winRate(a[1]))+Math.abs(winRate(b[0])-winRate(b[1]));
        const teamGap=Math.abs(rateA-rateB);
        // Lower is better: keep teams competitive, favor similar-record partners, and avoid repeat partners.
        const score=teamGap*5 + partnerGap*0.8 + (duplicate?100:0) + Math.random()*0.04;
        partitions.push({a,b,score});
      }
      partitions.sort((x,y)=>x.score-y.score);
      if (!partitions.length) return toast('Could not create a valid pairing for these players.');
      teamA=partitions[0].a.map(p=>p.id); teamB=partitions[0].b.map(p=>p.id);
    }
    const match={ id:uid(), round:data.round+1, category, teamA, teamB, createdAt:new Date().toISOString() };
    update({ current:match, round:data.round+1 }); setWinner(''); setScoreA(''); setScoreB('');
    toast(`Round ${match.round} pairing generated.`);
  }
  function finishMatch(e) {
    e.preventDefault();
    if (!data.current || !winner) return toast('Select the winning team.');
    const m={...data.current, winner, scoreA:scoreA===''?null:Number(scoreA), scoreB:scoreB===''?null:Number(scoreB), completedAt:new Date().toISOString()};
    const winningIds=winner==='A'?m.teamA:m.teamB; const losingIds=winner==='A'?m.teamB:m.teamA;
    const nextPlayers=players.map(p=> winningIds.includes(p.id)?{...p,wins:p.wins+1,played:p.played+1}:losingIds.includes(p.id)?{...p,losses:p.losses+1,played:p.played+1}:p);
    update({ players:nextPlayers, matches:[m,...matches], current:null }); setWinner(''); toast('Result saved. Player records updated.');
  }
  // Reverse a saved result's effect on player records.
  function applyResult(ps, m, sign) {
    const win = m.winner === 'A' ? m.teamA : m.teamB, lose = m.winner === 'A' ? m.teamB : m.teamA;
    return ps.map(p => win.includes(p.id) ? { ...p, wins: Math.max(0, p.wins + sign), played: Math.max(0, p.played + sign) } : lose.includes(p.id) ? { ...p, losses: Math.max(0, p.losses + sign), played: Math.max(0, p.played + sign) } : p);
  }
  function undoLastResult() {
    if (data.current) return toast('Finish or cancel the active match before undoing a result.');
    const m = matches[0]; if (!m) return;
    update({ players: applyResult(players, m, -1), matches: matches.slice(1), round: Math.max(0, data.round - 1) });
    toast('Last result undone. Records restored.');
  }
  function changeWinner(id) {
    const m = matches.find(x => x.id === id); if (!m) return;
    const flipped = { ...m, winner: m.winner === 'A' ? 'B' : 'A', scoreA: null, scoreB: null };
    update({ players: applyResult(applyResult(players, m, -1), flipped, 1), matches: matches.map(x => x.id === id ? flipped : x) });
    toast(`Winner changed to Team ${flipped.winner}. Scores cleared.`);
  }
  function backupJSON() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a');
    a.href = url; a.download = `openplay-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function restoreJSON(e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!Array.isArray(d.players) || !Array.isArray(d.matches)) throw new Error('bad');
        if (!window.confirm('Restore this backup? It will replace the current session.')) return;
        setData({ ...blank, ...d }); toast('Backup restored.');
      } catch { toast('That file is not a valid OpenPlay backup.'); }
    };
    reader.readAsText(file);
  }
  function cancelMatch() { update({ current:null, round:Math.max(0,data.round-1) }); toast('Active match cancelled. No records changed.'); }
  function resetSession() { update({ ...blank, players:[], matches:[], session:'Open Play Session' }); setConfirmReset(false); toast('Session reset.'); }
  function exportCSV() {
    const rows=[['Name','Gender','Wins','Losses','Win Rate','Games Played'],...sortedPlayers.map(p=>[p.name,p.gender,p.wins,p.losses,`${Math.round(winRate(p)*100)}%`,p.played])];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a');a.href=url;a.download='openplay-player-stats.csv';a.click();URL.revokeObjectURL(url);
  }
  const byId=id=>players.find(p=>p.id===id);
  const activePool=eligible(), activeMen=activePool.filter(p=>p.gender==='Male').length, activeWomen=activePool.filter(p=>p.gender==='Female').length;
  const categoryCounts=[{name:'Mixed',count:activeMen+activeWomen,ready:activeMen>=2&&activeWomen>=2},{name:"Men's",count:activeMen,ready:activeMen>=4},{name:"Women's",count:activeWomen,ready:activeWomen>=4},{name:'Genderless',count:activeMen+activeWomen,ready:activeMen+activeWomen>=4}];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={21}/></div><div><b>OPENPLAY</b><span>PICKLEBALL MANAGER</span></div></div>
      <div className="side-label">WORKSPACE</div>
      {[['dashboard','Overview',LayoutDashboard],['players','Players',Users],['matches','Matches',Trophy],['rankings','Rankings',Medal],['history','Match history',History]].map(([id,label,Icon])=><button key={id} className={`nav-item ${data.activeTab===id?'active':''}`} onClick={()=>update({activeTab:id})}><Icon size={18}/>{label}{id==='players'&&<em>{players.length}</em>}</button>)}
      <div className="sidebar-bottom"><div className="live-pill"><i/> SESSION ACTIVE</div><p>One court · Doubles play</p><small>Data is saved automatically on this device.</small></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">PICKLEBALL / OPEN PLAY</div><h1>{({dashboard:'Session overview',players:'Player management',matches:'Match center',rankings:'Player rankings',history:'Match history'})[data.activeTab]}</h1></div><div className="top-actions"><span className="court-chip"><span/> 1 COURT</span><button className="icon-btn" title="Export player statistics (CSV)" onClick={exportCSV}><Download size={17}/></button><button className="icon-btn" title="Backup session (JSON)" onClick={backupJSON}><Save size={17}/></button><label className="icon-btn" title="Restore from backup" style={{cursor:'pointer'}}><RotateCcw size={17}/><input type="file" accept="application/json,.json" onChange={restoreJSON} hidden/></label></div></header>
      {notice&&<div className="toast"><Check size={16}/>{notice}</div>}
      {data.activeTab==='dashboard'&&<>
        <section className="hero"><div className="hero-copy"><span className="hero-kicker">YOUR COURT IS READY</span><h2>Good games.<br/><i>Great rallies.</i></h2><p>Manage your open play, build fair matchups, and keep every player's progress in one place.</p><button className="primary-btn" onClick={()=>update({activeTab:'matches'})}>Go to match center <ChevronRight size={17}/></button></div><div className="hero-art"><div className="court-lines"><div className="net"/><div className="court-center"/><div className="ball"><span/></div></div><div className="hero-stamp">PLAY<br/>FAIR.</div></div></section>
        <section className="stats-grid"><Stat icon={Users} label="Registered players" value={players.length} note={`${activeCount} active in session`}/><Stat icon={Trophy} label="Matches completed" value={played} note="Results recorded"/><Stat icon={Activity} label="Rounds played" value={data.round} note="Single-court rotation"/><Stat icon={Clock3} label="Currently playing" value={data.current?'4':'0'} note={data.current?`Round ${data.current.round} in progress`:'Court available'}/></section>
        <div className="content-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">QUICK START</span><h3>Start your next match</h3></div><span className="soft-tag">RANDOM FIRST ROUND</span></div><p className="muted">Choose a division. The first round is randomized; later rounds use player records and avoid repeat partners.</p><div className="division-list">{categoryCounts.map(c=><div className="division-row" key={c.name}><div className="division-icon"><Users size={18}/></div><div className="division-info"><b>{c.name} doubles</b><span>{c.count} registered · {c.ready?'4 eligible players available':'Not enough eligible players yet'}</span></div><button disabled={!c.ready||!!data.current} className="small-primary" onClick={()=>createMatch(c.name)}>Generate <Shuffle size={14}/></button></div>)}</div></section>
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">ON THE LEADERBOARD</span><h3>Top players</h3></div><button className="text-btn" onClick={()=>update({activeTab:'rankings'})}>View all <ChevronRight size={14}/></button></div>{sortedPlayers.length?<div className="mini-ranking">{sortedPlayers.slice(0,5).map((p,i)=><PlayerRank key={p.id} player={p} rank={i+1}/>)}</div>:<Empty icon={Medal} title="No rankings yet" text="Add players and record your first match to see the leaderboard."/>}</section></div>
      </>}
      {data.activeTab==='players'&&<><section className="panel add-panel"><div className="panel-head"><div><span className="eyebrow">PLAYER ROSTER</span><h3>Add a player</h3></div><span className="soft-tag">{players.length} TOTAL</span></div><form className="player-form" onSubmit={addPlayer}><label className="field wide"><span>PLAYER NAME</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Alex Santos" maxLength={50}/></label><label className="field"><span>GENDER</span><select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option>Male</option><option>Female</option></select></label><button className="primary-btn add-btn" type="submit"><Plus size={17}/> Add player</button></form><p className="field-hint"><CircleHelp size={14}/> Choose the match category (Mixed, Men's, Women's or Genderless) in the Matches tab when you generate a game.</p></section><section className="panel table-panel"><div className="panel-head"><div><span className="eyebrow">SESSION PLAYERS</span><h3>Registered players</h3></div><select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Male</option><option>Female</option></select></div>{players.length?<div className="table-wrap"><table><thead><tr><th>PLAYER</th><th>GENDER</th><th>W / L</th><th>STATUS</th><th></th></tr></thead><tbody>{players.filter(p=>filter==='All'||p.gender===filter).map(p=><tr key={p.id}><td><div className="person-cell"><div className="avatar">{p.name.slice(0,1).toUpperCase()}</div><b>{p.name}</b></div></td><td>{p.gender}</td><td className="record">{record(p)}</td><td><button className={`status-toggle ${p.paused?'paused':''}`} onClick={()=>togglePause(p.id)}>{p.paused?'Paused':'Active'}</button></td><td><button className="delete-btn" title="Remove player" onClick={()=>removePlayer(p.id)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>:<Empty icon={Users} title="Your roster is empty" text="Register players above to get your open play session started."/>}</section></>}
      {data.activeTab==='matches'&&<><div className="match-layout"><section className="panel match-main"><div className="panel-head"><div><span className="eyebrow">LIVE COURT · COURT 1</span><h3>{data.current?`Round ${data.current.round} match`:'Ready for the next game?'}</h3></div><span className={`live-status ${data.current?'playing':''}`}><i/>{data.current?'IN PROGRESS':'COURT AVAILABLE'}</span></div>{data.current?<><div className="match-category">{data.current.category.toUpperCase()} DOUBLES <span>·</span> ROUND {data.current.round}</div><div className="versus-grid"><TeamCard label="TEAM A" ids={data.current.teamA} byId={byId} active/><div className="versus">VS</div><TeamCard label="TEAM B" ids={data.current.teamB} byId={byId} active/></div><form onSubmit={finishMatch} className="result-form"><div className="result-heading"><b>Record match result</b><span>Choose the winning team</span></div><div className="winner-options"><button type="button" className={`winner-option ${winner==='A'?'selected':''}`} onClick={()=>setWinner('A')}><span>TEAM A</span><b>Team A wins</b>{winner==='A'&&<Check size={17}/>}</button><button type="button" className={`winner-option ${winner==='B'?'selected':''}`} onClick={()=>setWinner('B')}><span>TEAM B</span><b>Team B wins</b>{winner==='B'&&<Check size={17}/>}</button></div><div className="score-row"><label>Team A score<input type="number" min="0" max="99" value={scoreA} onChange={e=>setScoreA(e.target.value)} placeholder="—"/></label><label>Team B score<input type="number" min="0" max="99" value={scoreB} onChange={e=>setScoreB(e.target.value)} placeholder="—"/></label></div><div className="result-actions"><button className="primary-btn" disabled={!winner} type="submit"><Check size={17}/> Save result</button><button className="outline-btn" type="button" onClick={cancelMatch}><X size={16}/> Cancel match</button></div></form></>:<><div className="empty-court"><div className="court-graphic"><div className="court-net"/><div className="court-ball"/></div><h4>The court is yours.</h4><p>Generate a matchup below to get the next game going.</p></div><div className="category-picker"><span className="eyebrow">MATCH CATEGORY</span><div className="division-list compact">{categoryCounts.map(c=><button type="button" key={c.name} className={`division-row category-option ${selCat===c.name?'selected':''}`} onClick={()=>setSelCat(c.name)}><div className="division-icon"><Users size={18}/></div><div className="division-info"><b>{c.name} doubles</b><span>{c.count} active · {c.ready?'Ready to play':'Need more players'}</span></div>{selCat===c.name&&<Check size={17}/>}</button>)}</div><button className="primary-btn" disabled={!categoryCounts.find(c=>c.name===selCat)?.ready} onClick={()=>createMatch(selCat)}><Shuffle size={16}/> Pair players</button></div></>}</section><aside className="panel rules-panel"><span className="eyebrow">HOW MATCHMAKING WORKS</span><h3>Fair play, by design.</h3><ol className="rules"><li><b>First round is random</b><span>Every player starts with a clean slate. Initial partners are shuffled.</span></li><li><b>Balanced next rounds</b><span>Pairings consider win/loss rates and try to keep both teams competitive.</span></li><li><b>Rotate partners</b><span>Previously paired teammates are avoided whenever a valid alternative exists.</span></li><li><b>One court at a time</b><span>Only one active match is allowed. Save a result before generating the next game.</span></li></ol><div className="rules-note"><CircleHelp size={16}/><span>Players stay in the session after a match and can be selected again for the next round.</span></div></aside></div></>}
      {data.activeTab==='rankings'&&<section className="panel table-panel"><div className="panel-head"><div><span className="eyebrow">SESSION PERFORMANCE</span><h3>Player leaderboard</h3></div><button className="outline-btn compact-btn" onClick={exportCSV}><Download size={15}/> Export CSV</button></div>{sortedPlayers.length?<div className="table-wrap"><table><thead><tr><th>RANK / PLAYER</th><th>GENDER</th><th>WINS</th><th>LOSSES</th><th>WIN RATE</th><th>GAMES</th></tr></thead><tbody>{sortedPlayers.map((p,i)=><tr key={p.id}><td><div className="person-cell"><span className={`rank-number rank-${i+1}`}>{String(i+1).padStart(2,'0')}</span><div className="avatar">{p.name.slice(0,1).toUpperCase()}</div><b>{p.name}</b></div></td><td><span className="category-tag">{p.gender}</span></td><td className="wins">{p.wins}</td><td>{p.losses}</td><td><div className="rate-cell"><div className="progress"><i style={{width:`${Math.round(winRate(p)*100)}%`}}/></div><b>{Math.round(winRate(p)*100)}%</b></div></td><td>{p.played}</td></tr>)}</tbody></table></div>:<Empty icon={Medal} title="No player stats yet" text="Player rankings appear after results have been recorded."/>}</section>}
      {data.activeTab==='history'&&<section className="panel table-panel"><div className="panel-head"><div><span className="eyebrow">SESSION LOG</span><h3>Completed matches</h3></div><span className="soft-tag">{matches.length} MATCHES</span></div>{matches.length?<div className="history-list">{matches.map(m=><div className="history-item" key={m.id}><div className="history-round"><span>ROUND</span><b>{m.round}</b></div><div className="history-details"><b>{m.category} doubles</b><span>{m.teamA.map(id=>byId(id)?.name||'Removed player').join(' & ')} <i>vs</i> {m.teamB.map(id=>byId(id)?.name||'Removed player').join(' & ')}</span><small>{new Date(m.completedAt).toLocaleString()}</small></div><div className="history-result"><span>WINNER</span><b>Team {m.winner}</b>{m.scoreA!==null&&m.scoreB!==null&&<small>{m.scoreA} – {m.scoreB}</small>}<div className="history-actions"><button type="button" onClick={()=>changeWinner(m.id)}>Change winner</button>{m.id===matches[0].id&&<button type="button" onClick={undoLastResult}>Undo</button>}</div></div></div>)}</div>:<Empty icon={History} title="No completed matches" text="Once a match result is saved, it will appear here."/>}</section>}
      <footer className="footer"><span>OPENPLAY <b>·</b> MADE FOR THE LOVE OF THE GAME</span><span>Local session storage enabled</span></footer>
    </main>
  </div>;
}
function Stat({icon:Icon,label,value,note}) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><small>{note}</small></div>; }
function PlayerRank({player,rank}) { return <div className="mini-player"><span className={`rank-number rank-${rank}`}>{String(rank).padStart(2,'0')}</span><div className="avatar">{player.name.slice(0,1).toUpperCase()}</div><div className="mini-name"><b>{player.name}</b><span>{player.gender}</span></div><div className="mini-record"><b>{player.wins} W</b><span>{player.losses} L</span></div></div>; }
function TeamCard({label,ids,byId,active}) { return <div className={`team-card ${active?'team-active':''}`}><div className="team-label">{label}</div>{ids.map(id=>{const p=byId(id);return <div className="team-player" key={id}><div className="avatar">{p?.name?.slice(0,1).toUpperCase()||'?'}</div><div><b>{p?.name||'Removed player'}</b><span>{p?.gender} · {p?.wins||0}W {p?.losses||0}L</span></div></div>})}</div>; }
function Empty({icon:Icon,title,text}) { return <div className="empty-state"><div><Icon size={22}/></div><b>{title}</b><p>{text}</p></div>; }

export default App;
