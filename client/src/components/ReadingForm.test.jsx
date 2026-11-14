import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ReadingForm from './ReadingForm.jsx';

function renderForm(overrides = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onCancel = overrides.onCancel ?? vi.fn();

  render(
    <ReadingForm
      date="2026-10-15"
      initialSlot="after_lunch"
      usedSlots={overrides.usedSlots ?? []}
      initialReading={overrides.initialReading}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );

  return { onSubmit, onCancel };
}

function submitButton() {
  return screen.getByRole('button', { name: /add reading|save changes/i });
}

describe('ReadingForm', () => {
  it('renders the value, date and slot inputs', () => {
    renderForm();

    expect(screen.getByLabelText(/glucose value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^date$/i)).toHaveValue('2026-10-15');
    expect(screen.getByLabelText(/time slot/i)).toHaveValue('after_lunch');
  });

  it('shows the required-value message and does not submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(submitButton());

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a glucose value.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a value outside 40-600 mg/dl', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/glucose value/i), '30');
    await user.click(submitButton());

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Value must be between 40 and 600 mg/dl.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid reading as a number', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/glucose value/i), '142');
    await user.click(submitButton());

    expect(onSubmit).toHaveBeenCalledWith({
      date: '2026-10-15',
      slot: 'after_lunch',
      value: 142,
    });
  });

  it('shows an API error such as a duplicate slot', async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new Error('You already have an After lunch reading for this date.'),
      );
    renderForm({ onSubmit });

    await user.type(screen.getByLabelText(/glucose value/i), '130');
    await user.click(submitButton());

    expect(
      await screen.findByText('You already have an After lunch reading for this date.'),
    ).toBeInTheDocument();
  });

  it('disables slots that are already logged when adding', () => {
    renderForm({ usedSlots: ['after_lunch', 'after_dinner'] });

    const lunch = screen.getByRole('option', { name: /after lunch/i });
    expect(lunch).toBeDisabled();

    const dinner = screen.getByRole('option', { name: /after dinner/i });
    expect(dinner).toBeDisabled();
  });
});
