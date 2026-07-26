import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import Welcome from '../screens/Welcome';
import { WelcomeAura } from '../components/WelcomeAura';

afterEach(() => {
  cleanup();
});

function renderWelcome(): void {
  render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/onboarding" element={<div>Onboarding placeholder</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Welcome screen', () => {
  it('renders the brand mark, headline, tagline and CTA', () => {
    renderWelcome();

    expect(screen.getByText('Kindred')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome to Kindred' })).toBeInTheDocument();
    expect(
      screen.getByText('A warm place to listen to your baby, in your own time.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument();
  });

  it('navigates to /onboarding on Begin', () => {
    renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(screen.getByText('Onboarding placeholder')).toBeInTheDocument();
  });

  it('renders no dock or check-in control — chrome-free by design', () => {
    renderWelcome();
    expect(screen.queryByText('Speak to Kindred')).not.toBeInTheDocument();
  });
});

describe('WelcomeAura', () => {
  it('renders its four aura layers', () => {
    const { container } = render(<WelcomeAura />);
    const root = container.querySelector('[data-welcome-aura]');
    expect(root).not.toBeNull();
    expect(root?.children).toHaveLength(4);
  });
});
