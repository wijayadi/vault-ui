import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '../../context/AuthContext';
import { listPolicies } from '../../api/policies';

interface PolicyPickerProps {
  value: string[];
  onChange: (policies: string[]) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
}

export function PolicyPicker({
  value,
  onChange,
  label = 'Policies',
  helperText,
  disabled = false,
}: PolicyPickerProps) {
  const { connection } = useAuth();
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!connection.url || !connection.token) return;

    setLoading(true);
    listPolicies(connection)
      .then((policies) => {
        if (!cancelled) setOptions(policies.filter((policy) => policy !== 'root').sort());
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connection]);

  return (
    <Autocomplete
      multiple
      freeSolo
      disabled={disabled}
      options={options}
      value={value}
      onChange={(_event, next) => onChange(next.map(String))}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={helperText ?? 'Select existing policies or type a custom policy name.'}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={18} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
