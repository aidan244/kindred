/**
 * Confirms the deliberate departure documented in AlertFramingBlock.tsx's
 * own header: the alert card's second control is now a real, working
 * EmergencyCall (tel:999), not a Dismiss button — on instruction, after the
 * rule-5 tradeoff was raised and knowingly accepted.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AlertFramingBlock } from '../components/AlertFramingBlock';

afterEach(() => {
  cleanup();
});

describe('AlertFramingBlock', () => {
  it('renders a real tel:999 call control in place of Dismiss', () => {
    render(<AlertFramingBlock onCheckIn={() => {}} />);

    const callLink = screen.getByRole('link', { name: /call paramedics on 999/i });
    expect(callLink).toHaveAttribute('href', 'tel:999');
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
  });

  it('still renders the Speak to Kindred control, unchanged', () => {
    render(<AlertFramingBlock onCheckIn={() => {}} />);
    expect(screen.getByRole('button', { name: 'Speak to Kindred' })).toBeInTheDocument();
  });
});
