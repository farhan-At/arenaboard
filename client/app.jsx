import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {probability} from '../src/rules.js';

async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function post(body, key) {
  return {method:'POST', headers:{'content-type':'application/json', 'x-organiser-key':key || ''}, body:JSON.stringify(body)};
}
function Setup({onCreate}) {
  const defaults = [['Kestrel',1700],['Rook',1580],['Finch',1510],['Swift',1420]];
  return <form onSubmit={onCreate} className="setup"><h2>Register a tournament</h2>
    <label>Tournament name<input name="title" defaultValue="Campus Open" required maxLength="64"/></label>
    <div className="row labels"><span>Player alias</span><span>Opening Elo</span></div>
    {defaults.map(([name,rating], i) => <div className="row" key={i}><input aria-label={'Player '+(i+1)} name={'p'+i} defaultValue={name} maxLength="30" required/><input type="number" aria-label={'Rating '+(i+1)} name={'r'+i} defaultValue={rating} min="0" max="3000" required/></div>)}
    <p>Four players. Two semifinals. Opening ratings determine seeding. Equal ratings follow registration order.</p><button>Create bracket</button></form>;
}
function Match({match, players, canEdit, submit}) {
  const a = players.find(p => p.id === match.a);
  const b = players.find(p => p.id === match.b);
  const result = match.result;
  const chance = result?.chance ?? (a && b ? probability(a.rating, b.rating) : null);
  return <article><div className="match-label">{match.id === 'F' ? 'Final' : 'Semifinal '+match.id.slice(1)}<span>{result ? 'Complete' : a && b ? 'Ready' : 'Pending'}</span></div>
    {[a,b].map((player,i) => <div className="side" key={i}><strong>{player?.name || 'Awaiting winner'}</strong><b>{result ? [result.left,result.right][i] : '–'}</b></div>)}
    {chance !== null && <p>{a.name} · {Math.round(chance*100)}% pre-match win chance</p>}
    {!result && a && b && canEdit && <form className="scores" onSubmit={e=>submit(e,match.id)}><input aria-label={a.name+' score'} type="number" name="left" required min="0" max="999"/><input aria-label={b.name+' score'} type="number" name="right" required min="0" max="999"/><button>Save score</button></form>}</article>;
}
function App() {
  const [id,setId] = useState(new URLSearchParams(location.search).get('board'));
  const [board,setBoard] = useState(null);
  const [error,setError] = useState('');
  const [live,setLive] = useState(false);
  const key = id && sessionStorage.getItem('organiser-'+id);
  function accept(next) {setBoard(old => !old || next.revision >= old.revision ? next : old);}
  useEffect(() => {
    if (!id) return;
    let active = true, timer, socket;
    request('/api/boards/'+id).then(b => {if(active) accept(b);}).catch(e => {if(active) setError(e.message);});
    function connect() {
      socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://')+location.host+'/live/'+id);
      socket.onmessage = event => {if(active) {accept(JSON.parse(event.data)); setLive(true);}};
      socket.onclose = event => {if(active) {setLive(false); if(event.code !== 1008) timer = setTimeout(connect,1200);}};
    }
    connect();
    return () => {active = false; clearTimeout(timer); socket.close();};
  },[id]);
  async function create(event) {
    event.preventDefault(); setError('');
    const f = new FormData(event.currentTarget);
    try {
      const players = Array.from({length:4},(_,i)=>({name:f.get('p'+i),rating:Number(f.get('r'+i))}));
      const data = await request('/api/boards',post({name:f.get('title'),players}));
      sessionStorage.setItem('organiser-'+data.id,data.key);
      history.replaceState(null,'','?board='+data.id);
      setBoard(data.board); setId(data.id);
    } catch(e) {setError(e.message);}
  }
  async function submit(event,match) {
    event.preventDefault(); setError('');
    const f = new FormData(event.currentTarget);
    try {accept(await request('/api/boards/'+id+'/matches/'+match,post({left:Number(f.get('left')),right:Number(f.get('right')),revision:board.revision},key)));}
    catch(e) {setError(e.message);}
  }
  const ranked = board && [...board.players].sort((a,b)=>b.wins-a.wins || b.rating-a.rating || board.seeds.indexOf(a.id)-board.seeds.indexOf(b.id));
  return <><header><a href="/">ArenaBoard</a><span>Tournament desk</span></header>
    <section className="hero"><div className="kicker">Single elimination</div><h1>{board?.name || 'Tournament desk'}</h1>{board && <p>{key ? 'Organiser' : 'Spectator'} view · {live ? 'Live updates connected' : 'Connecting'} · Revision {board.revision}</p>}</section>
    {error && <p role="alert">{error}</p>}
    {!id ? <Setup onCreate={create}/> : board && <><div className="heading"><h2>Match bracket</h2><a href={location.href} onClick={e=>{e.preventDefault(); navigator.clipboard.writeText(location.href).then(()=>setError('Spectator link copied.')).catch(()=>setError(location.href));}}>Copy spectator link</a></div>
    <div className="bracket">{board.matches.map(m=><Match key={m.id} match={m} players={board.players} canEdit={!!key} submit={submit}/>)}</div>
    <h2>Leaderboard</h2><table><thead><tr>{['Rank','Player','Seed','Wins','Current Elo'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{ranked.map((p,i)=><tr key={p.id}><td>{i+1}</td><td>{p.name}</td><td>{board.seeds.indexOf(p.id)+1}</td><td>{p.wins}</td><td>{p.rating}</td></tr>)}</tbody></table><p className="note">Seeds follow opening Elo, then registration order. Standings follow wins, current Elo and original seed.</p></>}</>;
}
createRoot(document.getElementById('root')).render(<App/>);
