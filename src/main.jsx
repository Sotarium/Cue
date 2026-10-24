import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const iconPaths = {
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
  sliders: <><path d="M4 6h16M7 12h13M4 18h16" /><circle cx="8" cy="6" r="1.7" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1.7" fill="currentColor" stroke="none" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  arrowUp: <><path d="M5 16 16 5" /><path d="M7 5h9v9" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  play: <path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none" />,
  settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1a1.6 1.6 0 0 1-2.3 2.3l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a1.6 1.6 0 0 1-3.2 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a1.6 1.6 0 0 1-2.3-2.3l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a1.6 1.6 0 0 1 0-3.2h.2A1.6 1.6 0 0 0 6.2 6.4l-.1-.1a1.6 1.6 0 0 1 2.3-2.3l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.2a1.6 1.6 0 0 1 3.2 0V3a1.6 1.6 0 0 0 2.7 1.1l.1-.1a1.6 1.6 0 0 1 2.3 2.3l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a1.6 1.6 0 0 1 0 3.2h-.2a1.6 1.6 0 0 0-1.1 2.7Z" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  checkCircle: <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  command: <><path d="M18 4a3 3 0 1 0 0 6h-6V4h6Z" /><path d="M6 20a3 3 0 1 0 0-6h6v6H6Z" /><path d="M4 6a3 3 0 1 0 6 0V4H4v2ZM20 18a3 3 0 1 0-6 0v2h6v-2Z" /><path d="M12 10h2a3 3 0 1 1 0 6h-2V10Z" /></>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  bot: <><rect x="5" y="7" width="14" height="12" rx="3" /><path d="M12 3v4M9 13h.01M15 13h.01M9 16h6" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  zap: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  folder: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />,
  plug: <><path d="M8 12V5M16 12V5M5 9h14" /><path d="M7 12a5 5 0 0 0 10 0" /><path d="M12 17v4" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  activity: <><path d="M4 12h3l2-6 4 12 2-6h5" /></>,
  pencil: <><path d="m4 17.5-.8 3.3 3.3-.8L18.9 7.6a2.1 2.1 0 0 0-3-3L4 17.5Z" /><path d="m14.5 6.5 3 3" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  users: <><path d="M16 20v-1.5a4.5 4.5 0 0 0-9 0V20" /><circle cx="11.5" cy="8" r="3" /><path d="M17 11a3 3 0 0 1 3 3v1M16.5 5.2a3 3 0 0 1 0 5.6" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.7-4L3 10" /><path d="M3 5v5h5M4 13a8 8 0 0 0 14.7 4L21 14" /><path d="M21 19v-5h-5" /></>,
}

function Icon({ name, size = 18, className = '' }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name] || iconPaths.more}</svg>
}

const navigation = [
  { id: 'computers', label: 'Computers', icon: 'monitor' },
  { id: 'agents', label: 'Agents', icon: 'bot' },
  { id: 'library', label: 'Library', icon: 'book' },
  { id: 'creations', label: 'Creations', icon: 'layers' },
  { id: 'automations', label: 'Automations', icon: 'zap' },
  { id: 'plugins', label: 'Plugins', icon: 'plug' },
  { id: 'more', label: 'More', icon: 'more' },
]

const seedAgents = [
  {
    id: 'atlas', name: 'Atlas Researcher', short: 'Atlas', type: 'Research', description: 'Turns a question into a sourced, decision-ready brief.',
    instructions: 'You are Atlas, a pragmatic research teammate. Start with the decision the user needs to make. Gather the minimum set of high-quality sources, separate facts from inference, and end with a clear recommendation and open questions.',
    model: 'Claude Sonnet 4', runs: '128', lastUsed: '12 min ago', updated: '2 days ago', status: 'Live', tone: 'violet', avatar: 'A', favorite: true,
    activity: ['Built a competitive landscape brief', 'Added 12 verified sources to a project', 'Summarized the Q3 product review'],
  },
  {
    id: 'scout', name: 'Scout', short: 'Scout', type: 'Signal finder', description: 'Finds the useful signal hiding inside a noisy feed.',
    instructions: 'You are Scout. Scan the provided material for meaningful changes, outliers, and patterns. Prioritize what is new, explain why it matters, and cite the exact evidence for every claim.',
    model: 'GPT-5', runs: '84', lastUsed: 'Yesterday', updated: '5 days ago', status: 'Live', tone: 'mint', avatar: 'S', favorite: false,
    activity: ['Flagged 4 changes in the launch tracker', 'Compared this week with the previous 4 weeks', 'Created a Monday signal digest'],
  },
  {
    id: 'northstar', name: 'Northstar', short: 'North', type: 'Planning', description: 'Makes the next step obvious when a project gets complicated.',
    instructions: 'You are Northstar, a calm planning partner. Decompose ambiguous goals into milestones, identify dependencies, and propose a smallest useful next step. Ask one sharp question when context is missing.',
    model: 'Claude Sonnet 4', runs: '46', lastUsed: 'Tue, 4:42 PM', updated: '1 week ago', status: 'Live', tone: 'amber', avatar: 'N', favorite: true,
    activity: ['Turned a product note into a 3-week plan', 'Sequenced 18 open tasks', 'Drafted a kickoff agenda'],
  },
  {
    id: 'relay', name: 'Relay', short: 'Relay', type: 'Writing', description: 'Adapts a strong idea to every surface without losing its edge.',
    instructions: 'You are Relay, an editorial partner. Preserve the core idea and the writer\'s voice. Offer a clean first draft, then a sharper alternative. Keep structure intentional and never pad the copy.',
    model: 'GPT-5 mini', runs: '31', lastUsed: 'Jun 18', updated: '2 weeks ago', status: 'Draft', tone: 'blue', avatar: 'R', favorite: false,
    activity: ['Drafted a launch email sequence', 'Refined a long-form announcement', 'Adapted a customer story for social'],
  },
  {
    id: 'pulse', name: 'Pulse Monitor', short: 'Pulse', type: 'Operations', description: 'Keeps a lightweight watch on the metrics that matter.',
    instructions: 'You are Pulse. Review the supplied operating metrics, identify movement that deserves attention, and summarize in three parts: what changed, likely cause, recommended action.',
    model: 'GPT-5 mini', runs: '19', lastUsed: 'Jun 14', updated: '3 weeks ago', status: 'Paused', tone: 'rose', avatar: 'P', favorite: false,
    activity: ['Published the weekly health check', 'Noted an unusual retention dip', 'Reviewed 7 operating metrics'],
  },
]

const sectionCopy = {
  computers: { eyebrow: 'Workspace', title: 'Computers', desc: 'Your active workspaces and remote sessions, all in one place.' },
  library: { eyebrow: 'Workspace', title: 'Library', desc: 'Reusable prompts, templates, and building blocks for your team.' },
  creations: { eyebrow: 'Workspace', title: 'Creations', desc: 'A home for the useful things your agents have made.' },
  automations: { eyebrow: 'Workspace', title: 'Automations', desc: 'Keep small workflows moving in the background.' },
  plugins: { eyebrow: 'Workspace', title: 'Plugins', desc: 'Connect Sotarium to the tools your work already lives in.' },
  more: { eyebrow: 'Workspace', title: 'More', desc: 'Workspace tools and utilities, gathered in one place.' },
}

function Logo() {
  return <div className="brand" aria-label="Sotarium home"><span className="brand-mark"><i></i><i></i><i></i><i></i><i></i><i></i></span><span>Sotarium<span className="brand-dot">.</span></span></div>
}

function Sidebar({ activeSection, onNavigate, onNewTask }) {
  return <aside className="sidebar">
    <div className="sidebar-top">
      <Logo />
      <button className="new-task" onClick={onNewTask}><span className="new-task-plus"><Icon name="plus" size={15} /></span><span>New task</span><kbd><Icon name="command" size={12} />⇧O</kbd></button>
    </div>
    <div className="nav-label">Workspace</div>
    <nav className="nav-list" aria-label="Primary navigation">
      {navigation.map(item => <button key={item.id} className={`nav-item ${activeSection === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={17} /><span>{item.label}</span>{item.id === 'agents' && <span className="nav-count">5</span>}</button>)}
    </nav>
    <div className="sidebar-spacer"></div>
    <div className="sidebar-foot">
      <button className="rail-link" onClick={() => onNavigate('settings')}><Icon name="settings" size={17} /><span>Settings</span></button>
      <div className="workspace-card"><div className="workspace-avatar">AC</div><div className="workspace-meta"><strong>Acme workspace</strong><span>Personal</span></div><Icon name="chevron" size={15} /></div>
    </div>
  </aside>
}

function Topbar({ onSearch, query, onNewTask, onNavigate }) {
  return <header className="topbar">
    <div className="mobile-brand"><Logo /></div>
    <div className="crumbs"><span>Workspace</span><span className="crumb-sep">/</span><strong>Agents</strong></div>
    <div className="topbar-actions">
      <label className="top-search"><Icon name="search" size={16} /><input value={query} onChange={e => onSearch(e.target.value)} placeholder="Search anything" /><kbd>⌘ K</kbd></label>
      <button className="icon-button top-icon" aria-label="Notifications"><Icon name="bell" size={18} /><span className="notification-dot"></span></button>
      <button className="avatar-button" onClick={() => onNavigate('settings')} aria-label="Open profile">JD</button>
    </div>
  </header>
}

function StatusPill({ status }) {
  const icon = status === 'Live' ? 'checkCircle' : status === 'Paused' ? 'clock' : 'pencil'
  return <span className={`status-pill ${status.toLowerCase()}`}><Icon name={icon} size={12} />{status}</span>
}

function AgentAvatar({ agent, large = false }) {
  return <div className={`agent-avatar ${agent.tone} ${large ? 'large' : ''}`}><span>{agent.avatar}</span><i></i></div>
}

function AgentCard({ agent, onSelect, onFavorite, compact }) {
  return <article className={`agent-card ${compact ? 'compact-card' : ''}`} onClick={() => onSelect(agent)}>
    <div className="card-top"><AgentAvatar agent={agent} /><button className={`favorite-button ${agent.favorite ? 'is-favorite' : ''}`} onClick={e => { e.stopPropagation(); onFavorite(agent.id) }} aria-label={agent.favorite ? 'Remove from favorites' : 'Add to favorites'}><Icon name="star" size={16} /></button></div>
    <div className="card-copy"><div className="agent-name-row"><h3>{agent.name}</h3><Icon name="arrowUp" size={15} className="card-arrow" /></div><p>{agent.description}</p></div>
    <div className="card-footer"><span className="agent-type">{agent.type}</span><span className="card-status"><span className={`status-dot ${agent.status.toLowerCase()}`}></span>{agent.status}</span></div>
    {!compact && <div className="card-runline"><span><Icon name="activity" size={13} />{agent.runs} runs</span><span><Icon name="clock" size={13} />{agent.lastUsed}</span></div>}
  </article>
}

function SectionPlaceholder({ section, onCreate }) {
  const copy = sectionCopy[section]
  return <div className="placeholder-page"><div className="placeholder-icon"><Icon name={navigation.find(item => item.id === section)?.icon || 'layers'} size={25} /></div><div className="eyebrow">{copy.eyebrow}</div><h1>{copy.title}</h1><p>{copy.desc}</p><button className="primary-button" onClick={onCreate}><Icon name="plus" size={16} />Create something</button></div>
}

function SettingsView({ compact, setCompact, onToast }) {
  return <div className="settings-page"><div className="eyebrow">Workspace</div><div className="settings-heading"><div><h1>Settings</h1><p>Make Sotarium feel like home for the way you work.</p></div><div className="settings-badge"><Icon name="shield" size={15} />Workspace owner</div></div>
    <div className="settings-layout"><div className="settings-nav"><button className="settings-nav-active">General</button><button>Members <span>3</span></button><button>Notifications</button><button>Integrations</button></div><div className="settings-panels">
      <section className="settings-panel"><div className="panel-heading"><div><h2>Workspace preferences</h2><p>Small details that shape your daily Sotarium experience.</p></div><Icon name="settings" size={18} /></div>
        <ToggleRow icon="bell" title="Smart notifications" desc="Only show alerts that need your attention." checked={true} onChange={() => onToast('Notification preferences saved')} />
        <ToggleRow icon="lock" title="Private workspace" desc="Keep agents and creations visible to your workspace only." checked={true} onChange={() => onToast('Privacy settings saved')} />
        <ToggleRow icon="panel" title="Compact cards" desc="Fit more agents on screen with a denser layout." checked={compact} onChange={() => setCompact(!compact)} />
      </section>
      <section className="settings-panel danger-panel"><div className="panel-heading"><div><h2>Workspace access</h2><p>Review who can use this workspace and what they can do.</p></div><Icon name="users" size={18} /></div><div className="access-row"><div className="access-avatars"><span>JD</span><span>AM</span><span>RK</span></div><div><strong>3 workspace members</strong><p>2 editors · 1 viewer</p></div><button className="secondary-button" onClick={() => onToast('Member management is ready to connect')}>Manage members <Icon name="arrow" size={14} /></button></div></section>
    </div></div></div>
}

function ToggleRow({ icon, title, desc, checked, onChange }) {
  return <div className="toggle-row"><div className="toggle-icon"><Icon name={icon} size={17} /></div><div className="toggle-copy"><strong>{title}</strong><p>{desc}</p></div><button className={`toggle ${checked ? 'checked' : ''}`} onClick={onChange} aria-label={`Toggle ${title}`}><span></span></button></div>
}

function AgentsPage({ agents, query, setQuery, filter, setFilter, compact, setCompact, onSelect, onFavorite, onCreate }) {
  const visible = useMemo(() => agents.filter(agent => {
    const matchesQuery = [agent.name, agent.type, agent.description].join(' ').toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All agents' || (filter === 'Favorites' && agent.favorite) || (filter === 'Live' && agent.status === 'Live')
    return matchesQuery && matchesFilter
  }), [agents, query, filter])
  return <div className="agents-page">
    <div className="page-heading"><div><div className="eyebrow">Workspace / Agents</div><h1>Shape the teammate.</h1><p>Build focused AI teammates for the work you do more than once.</p></div><button className="primary-button create-button" onClick={onCreate}><Icon name="plus" size={17} />Create agent</button></div>
    <div className="signal-bar"><div className="signal-left"><span className="signal-mark"><span></span><span></span><span></span></span><div><strong>Your agents are ready when the work is.</strong><p>5 active teammates · 308 runs this month</p></div></div><button className="text-button" onClick={() => onSelect(agents[0])}>View activity <Icon name="arrow" size={14} /></button></div>
    <div className="toolbar"><div className="filter-tabs">{['All agents', 'Favorites', 'Live'].map(item => <button className={filter === item ? 'selected' : ''} key={item} onClick={() => setFilter(item)}>{item}{item === 'All agents' && <span>5</span>}{item === 'Favorites' && <span>2</span>}</button>)}</div><div className="toolbar-right"><label className="inline-search"><Icon name="search" size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find an agent" /></label><button className="filter-button"><Icon name="sliders" size={16} />Filter</button><div className="view-toggle"><button className={!compact ? 'active' : ''} onClick={() => setCompact(false)} aria-label="Grid view"><Icon name="grid" size={16} /></button><button className={compact ? 'active' : ''} onClick={() => setCompact(true)} aria-label="Compact view"><Icon name="list" size={16} /></button></div></div></div>
    <div className={`agents-grid ${compact ? 'compact' : ''}`}>{visible.map(agent => <AgentCard key={agent.id} agent={agent} compact={compact} onSelect={onSelect} onFavorite={onFavorite} />)}{visible.length === 0 && <div className="empty-state"><div className="empty-icon"><Icon name="search" size={22} /></div><h3>No agents found</h3><p>Try another search or create a new teammate.</p><button className="secondary-button" onClick={onCreate}>Create agent <Icon name="arrow" size={14} /></button></div>}</div>
    <div className="agents-footer"><span>Showing {visible.length} of {agents.length} agents</span><span><Icon name="shield" size={13} />All agents are private to your workspace</span></div>
  </div>
}

function DetailDrawer({ agent, onClose, onSave, onRun, onToast }) {
  const [tab, setTab] = useState('Overview')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(agent)
  const [instructionDraft, setInstructionDraft] = useState(agent.instructions)
  const save = () => { onSave({ ...agent, ...draft, instructions: instructionDraft }); setEditing(false); onToast(`${draft.name} updated`) }
  return <div className="drawer-backdrop" onClick={onClose}><aside className="detail-drawer" onClick={e => e.stopPropagation()}>
    <div className="drawer-header"><div className="drawer-breadcrumb"><span>Agents</span><span>/</span><strong>{agent.short}</strong></div><div className="drawer-actions"><button className="icon-button" onClick={() => onToast('Agent link copied')} aria-label="Copy agent link"><Icon name="copy" size={17} /></button><button className="icon-button" onClick={onClose} aria-label="Close details"><Icon name="x" size={19} /></button></div></div>
    <div className="drawer-identity"><AgentAvatar agent={agent} large /><div><div className="drawer-title-line"><h2>{agent.name}</h2><StatusPill status={agent.status} /></div><p>{agent.type} teammate · Created 2 weeks ago</p></div></div>
    <div className="drawer-tabbar">{['Overview', 'Instructions', 'Activity'].map(item => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}{item === 'Activity' && <span className="tab-count">{agent.activity.length}</span>}</button>)}</div>
    <div className="drawer-content">{tab === 'Overview' && <>
      <div className="drawer-summary"><p>{agent.description}</p><div className="drawer-stat-grid"><div><span>Runs</span><strong>{agent.runs}</strong></div><div><span>Last used</span><strong>{agent.lastUsed}</strong></div><div><span>Model</span><strong>{agent.model}</strong></div></div></div>
      <div className="detail-section"><div className="section-label">Capabilities</div><div className="capability-list"><span><Icon name="search" size={14} />Web research</span><span><Icon name="book" size={14} />Source notes</span><span><Icon name="copy" size={14} />Structured output</span></div></div>
      <div className="detail-section"><div className="section-label">Latest activity</div>{agent.activity.slice(0, 2).map((item, index) => <div className="activity-line" key={item}><span className="activity-index">0{index + 1}</span><div><strong>{item}</strong><span>{index === 0 ? '12 minutes ago' : 'Yesterday'}</span></div></div>)}</div>
    </>}
    {tab === 'Instructions' && <div className="instructions-panel">{editing ? <><label>Agent name<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label>Description<textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows="3" /></label><label>Instructions<textarea className="instruction-editor" value={instructionDraft} onChange={e => setInstructionDraft(e.target.value)} rows="10" /></label><div className="edit-actions"><button className="secondary-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" onClick={save}><Icon name="check" size={15} />Save changes</button></div></> : <><div className="instruction-heading"><div><span className="section-label">System instructions</span><p>These are the rules that guide how {agent.short} works.</p></div><button className="secondary-button" onClick={() => setEditing(true)}><Icon name="pencil" size={14} />Edit</button></div><pre>{agent.instructions}</pre></>}</div>}
    {tab === 'Activity' && <div className="activity-feed">{agent.activity.map((item, index) => <div className="feed-item" key={item}><div className="feed-marker"><Icon name={index === 0 ? 'checkCircle' : 'activity'} size={15} /></div><div><strong>{item}</strong><p>{index === 0 ? 'Completed successfully with a clean output.' : 'Available in the workspace activity log.'}</p><span>{index === 0 ? '12 minutes ago' : `${index + 1} days ago`}</span></div></div>)}</div>}</div>
    <div className="drawer-footer"><button className={`icon-button drawer-star ${agent.favorite ? 'is-favorite' : ''}`} aria-label="Favorite agent"><Icon name="star" size={17} /></button><button className="secondary-button" onClick={() => setEditing(true)}><Icon name="pencil" size={15} />Edit agent</button><button className="primary-button run-button" onClick={onRun}><Icon name="play" size={14} />Run agent</button></div>
  </aside></div>
}

function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('Research')
  const [model, setModel] = useState('Claude Sonnet 4')
  const [instructions, setInstructions] = useState('')
  const canCreate = name.trim().length > 1
  const create = () => { if (!canCreate) return; onCreate({ name: name.trim(), type, model, instructions: instructions.trim() || `You are ${name.trim()}, a focused AI teammate. Keep your work clear, useful, and grounded in the user\'s goal.` }) }
  return <div className="modal-backdrop" onClick={onClose}><section className="create-modal" onClick={e => e.stopPropagation()}><div className="modal-header"><div><div className="eyebrow">New teammate</div><h2>Shape your agent.</h2><p>Start with a clear role. You can shape the details later.</p></div><button className="icon-button" onClick={onClose}><Icon name="x" size={19} /></button></div><div className="modal-form"><label>Agent name<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Briefing partner" /></label><div className="form-grid"><label>Role<select value={type} onChange={e => setType(e.target.value)}><option>Research</option><option>Planning</option><option>Writing</option><option>Operations</option><option>Signal finder</option></select></label><label>Model<select value={model} onChange={e => setModel(e.target.value)}><option>Claude Sonnet 4</option><option>GPT-5</option><option>GPT-5 mini</option></select></label></div><label>Instructions <span className="optional">Optional</span><textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows="5" placeholder="What should this teammate be great at?" /></label></div><div className="modal-footer"><span><Icon name="shield" size={14} />Private to your workspace</span><div><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!canCreate} onClick={create}>Create agent <Icon name="arrow" size={14} /></button></div></div></section></div>
}

function DownloadPage() {
  return <main className="download-page"><div className="download-card"><div className="download-logo"><span className="download-mark"><i></i><i></i><i></i><i></i><i></i><i></i></span><strong>Sotarium</strong></div><h1>Download Sotarium</h1><a className="download-button" href="https://github.com/Sotarium/Cue/releases/latest/download/Sotarium.exe">Download for Windows</a><a className="store-link" href="https://apps.microsoft.com/detail/9PDXFBWZNTNJ?hl=en-us&gl=CA&ocid=pdpshare">Microsoft Store</a></div></main>
}

const conversationSeeds = [
  { id: 'resume', name: 'Resume Update', preview: 'Here’s a revised introduction that...', time: '19:53', tone: 'blue', agent: 'Atlas' },
  { id: 'work', name: 'Work Assistant', preview: 'Your calendar is clear at 11:30 A...', time: '19:53', tone: 'brown', agent: 'Work Assistant' },
  { id: 'tokyo', name: 'Tokyo Trip', preview: 'Here’s a draft plan for three days...', time: '14:32', tone: 'coral', agent: 'Scout' },
  { id: 'birthday', name: 'Birthday Ideas', preview: 'What does your friend enjoy doin...', time: 'Thursday', tone: 'yellow', agent: 'Northstar' },
  { id: 'reading', name: 'Weekend Reading', preview: 'Are you in the mood for a quick r...', time: 'Sep 22', tone: 'gray', agent: 'Relay' },
  { id: 'movie', name: 'Movie Night', preview: 'Want something light and funny,...', time: 'Sep 22', tone: 'gold', agent: 'Pulse' },
  { id: 'launch', name: 'Launch Planning', preview: 'I’ve built the timeline around the...', time: 'Sep 22', tone: 'blue', agent: 'Atlas' },
  { id: 'grocery', name: 'Grocery List', preview: 'I’ve grouped everything by aisle.', time: 'Sep 21', tone: 'blue', agent: 'Scout' },
  { id: 'english', name: 'English Practice', preview: 'Congrats on starting your first se...', time: 'Sep 21', tone: 'coral', agent: 'Relay' },
]

function CharacterAvatar({ tone = 'blue', small = false, double = false }) {
  return <span className={`character-avatar ${tone} ${small ? 'small' : ''} ${double ? 'double' : ''}`}><i></i><b></b></span>
}

function SotariumWorkspace() {
  const [active, setActive] = useState('launch')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [sent, setSent] = useState(false)
  const activeConversation = conversationSeeds.find(item => item.id === active) || conversationSeeds[6]
  const visibleConversations = conversationSeeds.filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
  const sendMessage = () => { if (!draft.trim()) return; setSent(true); setDraft('') }
  return <div className="sotarium-desktop">
    <aside className="conversation-rail">
      <div className="rail-topline"><Logo /><div className="rail-actions"><button aria-label="New conversation"><Icon name="plus" size={18} /></button><button aria-label="Search conversations"><Icon name="search" size={17} /></button></div></div>
      <label className="conversation-search"><Icon name="search" size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" /></label>
      <div className="conversation-list">{visibleConversations.map(item => <button key={item.id} className={`conversation-row ${active === item.id ? 'active' : ''}`} onClick={() => { setActive(item.id); setSent(false) }}><CharacterAvatar tone={item.tone} small /><span className="conversation-copy"><strong>{item.name}</strong><small>{item.preview}</small></span><time>{item.time}</time></button>)}</div>
      <div className="rail-bottom"><button className="memory-link"><Icon name="refresh" size={16} /><span>Memory</span><small>Updated today</small></button><button className="profile-link"><span className="profile-avatar">JD</span><span><strong>Jordan Davis</strong><small>Personal workspace</small></span><Icon name="chevron" size={15} /></button></div>
    </aside>
    <main className="conversation-main">
      <header className="conversation-header"><div className="conversation-title"><CharacterAvatar tone={activeConversation.tone} small /><strong>{activeConversation.name}</strong></div><div className="conversation-header-actions"><button aria-label="Open computer"><Icon name="monitor" size={17} /></button><button aria-label="Open details"><Icon name="settings" size={17} /></button></div></header>
      <div className="message-stage">
        <div className="time-stamp">9:40</div>
        <div className="user-message">Help me get ready for Friday’s launch. I need an announcement and a timeline.</div>
        <div className="agent-message"><div className="message-author"><CharacterAvatar tone="blue" small /><strong>Copy Assistant</strong></div><p>Here’s a draft for the announcement:</p><div className="quote-message">“Meet your new team of agents. Bring them together in one chat to get more done.”</div><div className="handoff-message"><CharacterAvatar tone="gray" small /><strong>Schedule assistant</strong><span>Can you leave time for a copy review before we publish?</span></div></div>
        <div className="time-stamp second">9:47</div>
        <div className="agent-message schedule"><div className="message-author"><CharacterAvatar tone="gray" small /><strong>Schedule Assistant</strong></div><p>I’ve built the timeline around the copy review:</p><ul><li>Wednesday: review the announcement</li><li>Thursday: run final product checks</li><li>Friday: publish</li></ul><p>Does this timing work for you?</p><div className="reaction-row"><span>♥</span><span>👍</span><span>☺</span><span>💪</span><small>+2</small></div></div>
        {sent && <div className="user-message sent-message">{sent === true ? 'Can you make the announcement a little warmer?' : sent}</div>}
      </div>
      <div className="composer-wrap"><div className="composer"><button aria-label="Add attachment"><Icon name="plus" size={18} /></button><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Message your agents" /><button className="send-button" onClick={sendMessage} aria-label="Send message"><Icon name="arrow" size={17} /></button></div><div className="composer-hint">Sotarium can bring the right agent into any conversation.</div></div>
    </main>
  </div>
}

function App() {
  const [activeSection, setActiveSection] = useState('agents')
  const [agents, setAgents] = useState(seedAgents)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All agents')
  const [compact, setCompact] = useState(false)
  const [toast, setToast] = useState(null)
  const notify = (message) => { setToast(message); window.clearTimeout(window.__cueToast); window.__cueToast = window.setTimeout(() => setToast(null), 2800) }
  const navigate = (section) => { setActiveSection(section); setSelectedAgent(null); if (section !== 'agents') notify(`${section[0].toUpperCase() + section.slice(1)} is ready to connect`) }
  const toggleFavorite = (id) => setAgents(current => current.map(agent => agent.id === id ? { ...agent, favorite: !agent.favorite } : agent))
  const saveAgent = (updated) => { setAgents(current => current.map(agent => agent.id === updated.id ? updated : agent)); setSelectedAgent(updated) }
  const createAgent = (newAgent) => { const agent = { ...newAgent, id: `${Date.now()}`, short: newAgent.name.split(' ')[0], description: `A focused ${newAgent.type.toLowerCase()} teammate, tuned for the way your team works.`, runs: '0', lastUsed: 'Not yet used', updated: 'Just now', status: 'Draft', tone: ['violet', 'mint', 'amber', 'blue'][agents.length % 4], avatar: newAgent.name.slice(0, 1).toUpperCase(), favorite: false, activity: ['Agent created and ready to shape'] }; setAgents(current => [agent, ...current]); setShowCreate(false); setSelectedAgent(agent); notify(`${agent.name} created`) }
  const isDesktopApp = window.location.protocol === 'file:' || window.location.pathname === '/app'
  if (!isDesktopApp) return <DownloadPage />
  return <SotariumWorkspace />
}

createRoot(document.getElementById('root')).render(<App />)
