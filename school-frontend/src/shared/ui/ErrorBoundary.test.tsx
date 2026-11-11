import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Broken(): never {
  throw new Error('render failed');
}

describe('the error boundary', () => {
  it('shows a message and a way out instead of a blank page when a screen fails to render', () => {
    // React and jsdom both report the error we throw on purpose; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', swallow);
    onTestFinished(() => window.removeEventListener('error', swallow));

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong on this page/i);
    expect(screen.getByRole('button', { name: /reload/i })).toBeVisible();
  });

  it('renders the page normally when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
