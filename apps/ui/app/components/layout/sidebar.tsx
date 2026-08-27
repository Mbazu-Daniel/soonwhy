import { Link } from '@tanstack/react-router';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Projects', href: '/projects', icon: '📁' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export function Sidebar() {
  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/" className="text-lg font-bold">
          Soonwhy
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <span>{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </nav>
      <div className="border-t p-4">
        <div className="text-sm text-muted-foreground">Soonwhy v0.1.0</div>
      </div>
    </div>
  );
}
