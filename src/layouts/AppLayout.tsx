import {
  Activity,
  Bell,
  Briefcase,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import { MatterFormModal } from '../components/matters/MatterFormModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { fetchNotifications } from '../services/notificationService.ts';

export interface AppLayoutContext {
  openNewMatterModal: (defaultSpaceId?: string) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
  refreshUnreadCount: () => void;
}

export function useAppLayout() {
  return useOutletContext<AppLayoutContext>();
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/matters', label: 'My Matters', icon: Briefcase, end: false },
  { to: '/spaces', label: 'My Spaces', icon: Layers, end: false },
  { to: '/timeline', label: 'Timeline', icon: Activity, end: false },
  { to: '/notifications', label: 'Notifications', icon: Bell, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [matterModalOpen, setMatterModalOpen] = useState(false);
  const [matterModalSpaceId, setMatterModalSpaceId] = useState<string | undefined>(
    undefined
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshUnreadCount = useCallback(() => {
    fetchNotifications()
      .then((res) => setUnreadCount(res.unreadCount))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount, location.pathname, refreshTrigger]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const openNewMatterModal = useCallback((defaultSpaceId?: string) => {
    setMatterModalSpaceId(defaultSpaceId);
    setMatterModalOpen(true);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const pageTitle = (() => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/matters/')) return 'Matter Details';
    if (path.startsWith('/matters')) return 'My Matters';
    if (path.startsWith('/spaces/')) return 'Space Workspace';
    if (path.startsWith('/spaces')) return 'My Spaces';
    if (path.startsWith('/timeline')) return 'Timeline';
    if (path.startsWith('/notifications')) return 'Notifications';
    if (path.startsWith('/settings')) return 'Settings';
    return 'LIFEOS';
  })();

  const userInitial = (user?.displayName || user?.email || 'U')
    .charAt(0)
    .toUpperCase();

  const renderNavLinks = (isCollapsed: boolean) => (
    <nav className="flex-1 space-y-1 px-2.5 py-3" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const showUnread = item.to === '/notifications' && unreadCount > 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              `group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#1D2027] text-white'
                  : 'text-[#9CA3AF] hover:bg-[#171A20] hover:text-[#F3F4F6]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-3 overflow-hidden">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-[#F97316]'
                        : 'text-[#8B929E] group-hover:text-[#CBD5E1]'
                    }`}
                    aria-hidden="true"
                  />
                  {!isCollapsed && (
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  )}
                </span>
                {showUnread && !isCollapsed && (
                  <span className="ml-2 rounded border border-[#573218] bg-[#26180F] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#FB923C] tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[#0B0C0E] text-[#F4F5F7]">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-[#23262E] bg-[#111317] transition-all duration-150 lg:flex ${
          collapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#23262E] px-3.5">
          {!collapsed && (
            <NavLink
              to="/"
              className="flex items-center gap-2.5 whitespace-nowrap focus:outline-none"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F97316] font-display text-xs font-bold text-white">
                L
              </span>
              <span className="font-display text-base font-bold tracking-tight text-white">
                LIFEOS
              </span>
            </NavLink>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-[#9CA3AF] transition-colors hover:bg-[#1B1E24] hover:text-white lg:mx-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {renderNavLinks(collapsed)}

        <div className="border-t border-[#23262E] p-3">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2D313B] bg-[#1A1D23] font-display text-xs font-semibold text-white">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {user?.displayName}
                  </div>
                  <div className="truncate text-xs text-[#8B929E]">{user?.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
                className="shrink-0 rounded-md p-1.5 text-[#8B929E] transition-colors hover:bg-[#1C1F26] hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-md text-[#8B929E] transition-colors hover:bg-[#1C1F26] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/65"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 flex w-64 flex-col border-r border-[#23262E] bg-[#111317]">
            <div className="flex h-14 items-center justify-between border-b border-[#23262E] px-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F97316] font-display text-xs font-bold text-white">
                  L
                </span>
                <span className="font-display text-base font-bold text-white">
                  LIFEOS
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-[#1B1E24] hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {renderNavLinks(false)}

            <div className="border-t border-[#23262E] p-3">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2D313B] bg-[#1A1D23] font-display text-xs font-semibold text-white">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {user?.displayName}
                  </div>
                  <div className="truncate text-xs text-[#8B929E]">{user?.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-[#2B2E38] bg-[#191C22] px-3 py-2 text-xs font-medium text-[#E5E7EB] hover:bg-[#22262E]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[#23262E] bg-[#0B0C0E]/95 px-4 backdrop-blur-xs sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#23262E] bg-[#14161A] text-[#CBD5E1] hover:text-white lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="truncate font-display text-sm font-semibold text-white sm:text-base">
              {pageTitle}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <NavLink
              to="/notifications"
              className="relative flex h-9 items-center gap-1.5 rounded-md border border-[#262930] bg-[#14161A] px-3 text-xs font-medium text-[#CBD5E1] transition-colors hover:border-[#343842] hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded bg-[#F97316] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white tabular-nums">
                  {unreadCount}
                </span>
              )}
            </NavLink>

            <button
              type="button"
              onClick={() => openNewMatterModal()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#F97316] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#EA580C] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Quick Add Matter</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet
            context={{
              openNewMatterModal,
              refreshTrigger,
              triggerRefresh,
              refreshUnreadCount,
            }}
          />
        </main>
      </div>

      <MatterFormModal
        open={matterModalOpen}
        defaultSpaceId={matterModalSpaceId}
        onClose={() => setMatterModalOpen(false)}
        onSaved={(matterId) => {
          setMatterModalOpen(false);
          triggerRefresh();
          navigate(`/matters/${matterId}`);
        }}
      />
    </div>
  );
}
