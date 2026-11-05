import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { JsonEditor } from './JsonEditor';
import { PolicyPicker } from './PolicyPicker';
import type { FieldDef } from '../../config/authBackends';
import type { FieldValues } from '../../utils/fields';

interface DynamicFormProps {
  fields: FieldDef[];
  values: FieldValues;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  dark?: boolean;
}

export function DynamicForm({ fields, values, onChange, disabled = false, dark = false }: DynamicFormProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      {fields.map((field) => {
        const wide = field.type === 'json' || field.type === 'policies';
        const value = values[field.key];

        if (field.type === 'boolean') {
          return (
            <FormControlLabel
              key={field.key}
              sx={{ gridColumn: { xs: '1', md: wide ? '1 / -1' : 'auto' } }}
              control={
                <Switch
                  checked={Boolean(value)}
                  disabled={disabled}
                  onChange={(event) => onChange(field.key, event.target.checked)}
                />
              }
              label={field.label}
            />
          );
        }

        if (field.type === 'policies') {
          return (
            <Box key={field.key} sx={{ gridColumn: '1 / -1' }}>
              <PolicyPicker
                label={field.label}
                value={Array.isArray(value) ? (value as string[]) : []}
                disabled={disabled}
                helperText={field.help}
                onChange={(policies) => onChange(field.key, policies)}
              />
            </Box>
          );
        }

        if (field.type === 'json') {
          return (
            <Box key={field.key} sx={{ gridColumn: '1 / -1' }}>
              <Box sx={{ typography: 'body2', fontWeight: 600, mb: 1 }}>{field.label}</Box>
              <JsonEditor
                value={value ?? {}}
                height={220}
                dark={dark}
                readOnly={disabled}
                onChange={(next) => onChange(field.key, next)}
              />
              {field.help ? (
                <Box sx={{ typography: 'caption', color: 'text.secondary', mt: 0.5 }}>{field.help}</Box>
              ) : null}
            </Box>
          );
        }

        if (field.type === 'select') {
          return (
            <TextField
              key={field.key}
              select
              label={field.label}
              value={String(value ?? '')}
              disabled={disabled}
              helperText={field.help}
              onChange={(event) => onChange(field.key, event.target.value)}
            >
              {(field.options ?? []).map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          );
        }

        return (
          <TextField
            key={field.key}
            label={field.label}
            value={String(value ?? '')}
            disabled={disabled}
            required={field.required}
            type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
            placeholder={field.placeholder}
            helperText={
              field.writeOnly
                ? `${field.help ? `${field.help} ` : ''}Write-only: leave blank to keep the current value.`
                : field.help
            }
            autoComplete={field.type === 'password' ? 'new-password' : undefined}
            onChange={(event) => onChange(field.key, event.target.value)}
            slotProps={{ htmlInput: { min: field.min, max: field.max } }}
          />
        );
      })}
    </Box>
  );
}
