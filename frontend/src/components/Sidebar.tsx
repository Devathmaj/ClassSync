import {} from 'react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  external?: boolean;
  color?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
      { id: 'timetables', label: 'My Timetables', icon: '📅' },
      { id: 'calendar', label: 'Calendar', icon: '📆' },
      { id: 'analytics', label: 'Reports & Analytics', icon: '📊' },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { id: 'users', label: 'Users', icon: '👥' },
      { id: 'master-data', label: 'Master Data', icon: '🗃️' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ],
  },
  {
    label: 'HELP & SUPPORT',
    items: [
      { id: 'help', label: 'Help Docs', icon: '📖' },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [{ id: 'logout', label: 'Logout', icon: '🚪' }],
  },
];

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string, timetableId?: string) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();

  const handleNav = (id: string) => {
    if (id === 'logout') { logout(); return; }
    onNavigate(id);
  };

  return (
    <header className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">CS</div>
        <div className="sidebar-logo-text">Class<span>Sync</span></div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map(section => {
          const items = section.items.filter(item => {
            if (user?.role === 'faculty' && ['users', 'master-data', 'analytics', 'settings'].includes(item.id)) return false;
            return true;
          });
          
          if (items.length === 0) return null;

          return (
            <div key={section.label} style={{ display: 'flex', alignItems: 'center' }}>
              <div className="nav-section-label" style={{ display: 'none' }}>{section.label}</div>
              {items.map(item => (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  className={`nav-item${activePage === item.id ? ' active' : ''}`}
                  onClick={() => handleNav(item.id)}
                >
                  <span style={item.color ? { color: item.color } : {}}>{item.icon}</span>
                  <span className="nav-external">
                    {item.label}
                    {item.external && <span style={{ fontSize: 11 }}>↗</span>}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="sidebar-profile">
        <div className="avatar">{user ? getInitials(user.full_name) : 'U'}</div>
        <div className="profile-info">
          <div className="profile-name">{user?.full_name || 'User'}</div>
          <div className="profile-email">@{user?.username}</div>
        </div>
      </div>
    </header>
  );
}
