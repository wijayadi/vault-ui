import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { DynamicForm } from './DynamicForm';
import { buildTheme } from '../../theme';
import type { FieldDef } from '../../config/authBackends';
import type { FieldValues } from '../../utils/fields';

const fields: FieldDef[] = [
  { key: 'display_name', label: 'Display name', type: 'text' },
  { key: 'renewable', label: 'Renewable', type: 'boolean' },
  { key: 'ttl', label: 'TTL', type: 'number' },
];

function Harness() {
  const [values, setValues] = useState<FieldValues>({
    display_name: 'role-a',
    renewable: false,
    ttl: '60',
  });

  return (
    <ThemeProvider theme={buildTheme('light')}>
      <DynamicForm
        fields={fields}
        values={values}
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
      />
    </ThemeProvider>
  );
}

describe('DynamicForm', () => {
  it('renders fields and updates values', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const name = screen.getByLabelText('Display name');
    expect(name).toHaveValue('role-a');
    expect(screen.getByLabelText('Renewable')).not.toBeChecked();
    expect(screen.getByLabelText('TTL')).toHaveValue(60);

    await user.clear(name);
    await user.type(name, 'role-b');
    expect(name).toHaveValue('role-b');

    await user.click(screen.getByLabelText('Renewable'));
    expect(screen.getByLabelText('Renewable')).toBeChecked();
  });
});
