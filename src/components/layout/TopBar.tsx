import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyIcon from '@mui/icons-material/Key';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatTtl, useTtlCountdown } from '../../hooks/useTtl';
import { CopyButton } from '../common/CopyButton';

interface TopBarProps {
  onMenuClick: () => void;
  drawerWidth: number;
  mobile: boolean;
}

export function TopBar({ onMenuClick, drawerWidth, mobile }: TopBarProps) {
  const { connection, identity, health, renew, logout } = useAuth();
  const { notifyError, notify } = useToast();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const remaining = useTtlCountdown(identity);

  const displayName = identity?.meta?.username || identity?.display_name || 'token';
  const healthLabel = !health ? 'unknown' : health.sealed ? 'sealed' : health.standby ? 'standby' : 'active';
  const healthColor = !health ? 'default' : health.sealed ? 'error' : health.standby ? 'warning' : 'success';

  const handleRenew = async () => {
    setRenewing(true);
    try {
      await renew();
    } catch (error) {
      notifyError(error);
    } finally {
      setRenewing(false);
      setAnchorEl(null);
    }
  };

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    notify('Signed out');
  };

  return (
    <>
      <AppBar
        position="fixed"
        color="default"
        elevation={1}
        sx={{
          width: mobile ? '100%' : `calc(100% - ${drawerWidth}px)`,
          ml: mobile ? 0 : `${drawerWidth}px`,
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar sx={{ minHeight: 64 }}>
          {mobile ? (
            <IconButton edge="start" onClick={onMenuClick} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          ) : null}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
              Vault UI
            </Typography>
            <Chip
              size="small"
              color={healthColor as 'default' | 'error' | 'warning' | 'success'}
              label={healthLabel}
              variant={health ? 'filled' : 'outlined'}
            />
            {health?.version ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: 'none', md: 'block' } }}
              >
                v{health.version}
              </Typography>
            ) : null}
            {connection.namespace ? (
              <Chip
                size="small"
                variant="outlined"
                label={`ns: ${connection.namespace}`}
                sx={{ display: { xs: 'none', sm: 'flex' } }}
              />
            ) : null}
          </Box>

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Remaining token lifetime">
            <Chip
              size="small"
              variant="outlined"
              color={remaining !== null && remaining < 120 ? 'warning' : 'default'}
              label={`TTL ${formatTtl(remaining)}`}
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            />
          </Tooltip>

          <Tooltip title={displayName}>
            <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="Account menu">
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Box sx={{ px: 2, py: 1, maxWidth: 280 }}>
          <Typography variant="subtitle2" noWrap>
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {connection.url}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setTokenOpen(true);
          }}
        >
          <KeyIcon fontSize="small" sx={{ mr: 1 }} /> Show token
        </MenuItem>
        <MenuItem onClick={() => void handleRenew()} disabled={renewing}>
          <AutorenewIcon fontSize="small" sx={{ mr: 1 }} /> {renewing ? 'Renewing…' : 'Renew lease'}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate('/settings');
          }}
        >
          <SettingsIcon fontSize="small" sx={{ mr: 1 }} /> Preferences
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => void handleLogout()}>
          <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Sign out
        </MenuItem>
      </Menu>

      <Dialog open={tokenOpen} onClose={() => setTokenOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Vault token</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={2}
            value={connection.token}
            slotProps={{ input: { readOnly: true } }}
            helperText="Anyone with this token can access Vault with your permissions. Treat it as a secret."
          />
        </DialogContent>
        <DialogActions>
          <CopyButton value={connection.token} label="Copy token" />
          <Button onClick={() => setTokenOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
