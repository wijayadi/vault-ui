import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import DashboardIcon from '@mui/icons-material/Dashboard';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PolicyIcon from '@mui/icons-material/Policy';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import StorageIcon from '@mui/icons-material/Storage';
import HandymanIcon from '@mui/icons-material/Handyman';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LockIcon from '@mui/icons-material/Lock';
import BadgeIcon from '@mui/icons-material/Badge';
import RefreshIcon from '@mui/icons-material/Refresh';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useAuth } from '../../context/AuthContext';
import { isKvMount } from '../../api/kv';
import { getAuthBackend } from '../../config/authBackends';
import type { MountInfo } from '../../api/types';

export const DRAWER_WIDTH = 288;

interface SidebarProps {
  open: boolean;
  mobile: boolean;
  onClose: () => void;
  mounts: MountInfo[];
  authMounts: MountInfo[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function trimMount(path: string): string {
  return path.replace(/\/+$/, '');
}

export function Sidebar({
  open,
  mobile,
  onClose,
  mounts,
  authMounts,
  loading,
  error,
  onRefresh,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { connection } = useAuth();
  const [secretOpen, setSecretOpen] = useState(true);
  const [authOpen, setAuthOpen] = useState(true);

  const secretMounts = useMemo(() => mounts.filter(isKvMount), [mounts]);
  const authBackends = useMemo(() => authMounts.filter((mount) => getAuthBackend(mount.type)), [authMounts]);

  const go = (path: string) => {
    navigate(path);
    if (mobile) onClose();
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  useEffect(() => {
    if (location.pathname.startsWith('/secrets')) setSecretOpen(true);
    if (location.pathname.startsWith('/auth')) setAuthOpen(true);
  }, [location.pathname]);

  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ gap: 1.5, px: 2 }}>
        <LockIcon color="primary" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Vault UI
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap title={connection.url}>
            {connection.url || 'not connected'}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh engines">
          <IconButton size="small" onClick={onRefresh} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Toolbar>
      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <List dense disablePadding subheader={<ListSubheader disableSticky>Navigate</ListSubheader>}>
          <ListItemButton selected={location.pathname === '/'} onClick={() => go('/')}>
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>
          <ListItemButton selected={isActive('/tokens')} onClick={() => go('/tokens')}>
            <ListItemIcon>
              <BadgeIcon />
            </ListItemIcon>
            <ListItemText primary="Tokens" />
          </ListItemButton>
          <ListItemButton selected={isActive('/policies')} onClick={() => go('/policies')}>
            <ListItemIcon>
              <PolicyIcon />
            </ListItemIcon>
            <ListItemText primary="Policies" />
          </ListItemButton>
        </List>

        <Divider sx={{ my: 1 }} />

        <List dense disablePadding subheader={<ListSubheader disableSticky>Secret engines</ListSubheader>}>
          <ListItemButton onClick={() => setSecretOpen((value) => !value)}>
            <ListItemIcon>
              <StorageIcon />
            </ListItemIcon>
            <ListItemText primary="Browse secrets" />
            {secretOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={secretOpen} timeout="auto" unmountOnExit>
            {loading && secretMounts.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : null}
            {!loading && secretMounts.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 3, py: 1 }}>
                {error ?? 'No KV secret engines found.'}
              </Typography>
            ) : null}
            {secretMounts.map((mount) => {
              const path = `/secrets/${trimMount(mount.path)}/`;
              return (
                <ListItemButton
                  key={mount.path}
                  sx={{ pl: 4 }}
                  selected={location.pathname.startsWith(`/secrets/${trimMount(mount.path)}`)}
                  onClick={() => go(path)}
                >
                  <ListItemIcon>
                    <VpnKeyIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={trimMount(mount.path)}
                    secondary={mount.options?.version === '2' ? 'KV v2' : mount.type}
                  />
                </ListItemButton>
              );
            })}
          </Collapse>
        </List>

        <List dense disablePadding subheader={<ListSubheader disableSticky>Auth methods</ListSubheader>}>
          <ListItemButton onClick={() => setAuthOpen((value) => !value)}>
            <ListItemIcon>
              <LockIcon />
            </ListItemIcon>
            <ListItemText primary="Authentication" />
            {authOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={authOpen} timeout="auto" unmountOnExit>
            {!loading && authBackends.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 3, py: 1 }}>
                {error ?? 'No manageable auth backends. Token management is available under Tokens.'}
              </Typography>
            ) : null}
            {authBackends.map((mount) => {
              const type = mount.type;
              const path = `/auth/${type}/${trimMount(mount.path)}/`;
              return (
                <ListItemButton
                  key={`${type}:${mount.path}`}
                  sx={{ pl: 4 }}
                  selected={location.pathname.startsWith(`/auth/${type}/${trimMount(mount.path)}`)}
                  onClick={() => go(path)}
                >
                  <ListItemIcon>
                    <LockIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={trimMount(mount.path)} secondary={type} />
                </ListItemButton>
              );
            })}
          </Collapse>
        </List>

        <Divider sx={{ my: 1 }} />

        <List dense disablePadding subheader={<ListSubheader disableSticky>System</ListSubheader>}>
          <ListItemButton selected={isActive('/system/health')} onClick={() => go('/system/health')}>
            <ListItemIcon>
              <MonitorHeartIcon />
            </ListItemIcon>
            <ListItemText primary="Health & seal" />
          </ListItemButton>
          <ListItemButton selected={isActive('/system/mounts')} onClick={() => go('/system/mounts')}>
            <ListItemIcon>
              <StorageIcon />
            </ListItemIcon>
            <ListItemText primary="Mounts" />
          </ListItemButton>
          <ListItemButton selected={isActive('/tools')} onClick={() => go('/tools')}>
            <ListItemIcon>
              <HandymanIcon />
            </ListItemIcon>
            <ListItemText primary="Wrap / unwrap" />
          </ListItemButton>
        </List>

        <Divider sx={{ my: 1 }} />

        <List dense disablePadding>
          <ListItemButton selected={isActive('/settings')} onClick={() => go('/settings')}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Preferences" />
          </ListItemButton>
        </List>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={mobile ? 'temporary' : 'permanent'}
      open={mobile ? open : true}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
      }}
    >
      {content}
    </Drawer>
  );
}
