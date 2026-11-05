import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useToast } from '../../context/ToastContext';

interface CopyButtonProps {
  value: string;
  label?: string;
  size?: 'small' | 'medium';
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function CopyButton({ value, label = 'Copy to clipboard', size = 'small' }: CopyButtonProps) {
  const { notify, notifyError } = useToast();

  const handleCopy = async () => {
    try {
      await copyText(value);
      notify('Copied to clipboard');
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <Tooltip title={label}>
      <IconButton size={size} onClick={() => void handleCopy()} aria-label={label}>
        <ContentCopyIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
