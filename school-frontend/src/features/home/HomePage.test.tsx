import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { API, http, HttpResponse, makeClass, server } from '../../test/server';

describe('the home page', () => {
  it('shows real seat counts from the server, with the class and shift split for reading', async () => {
    server.use(
      http.get(`${API}/classes`, () =>
        HttpResponse.json([
          makeClass(),
          makeClass({ id: 'c-2', name: 'Class 6 - Day Shift', totalSeats: 60, heldSeats: 0, confirmedSeats: 60, availableSeats: 0 }),
        ]),
      ),
    );

    renderApp({ route: '/' });

    const cards = await screen.findAllByTestId('class-card');
    expect(cards).toHaveLength(2);
    const morning = within(cards[0]!);
    expect(morning.getByRole('heading', { name: 'Class 6' })).toBeVisible();
    expect(morning.getByText('Morning Shift')).toBeVisible();
    expect(morning.getByTestId('available-seats')).toHaveTextContent('25');
    expect(morning.getByTestId('held-seats')).toHaveTextContent('15');
    expect(within(cards[1]!).getByText('Full')).toBeVisible();
    // Tapping a class takes the parent straight to the admission page to apply.
    expect(morning.getByRole('link', { name: /apply for this class/i })).toHaveAttribute('href', '/admission');
    // The hero card adds up the same live numbers: 25 open in the morning, none in the day shift.
    expect(screen.getByTestId('glance-seats')).toHaveTextContent(/^25$/);
  });

  it('states the hold time the server is configured with, not a fixed number', async () => {
    // WHY: HOLD_DURATION_SECONDS can be changed; a hard-coded "10 minutes" would then lie.
    server.use(http.get(`${API}/settings`, () => HttpResponse.json({ holdDurationSeconds: 90 })));

    renderApp({ route: '/' });

    const glance = screen.getByRole('complementary', { name: /admission at a glance/i });
    expect(await within(glance).findByText('1 minute 30 seconds')).toBeVisible();
  });

  it('leads to the admission page and to the admin page', async () => {
    renderApp({ route: '/' });

    expect(screen.getAllByRole('link', { name: /apply now/i })[0]).toHaveAttribute('href', '/admission');
    expect(screen.getByRole('link', { name: /start application/i })).toHaveAttribute('href', '/admission');
    expect(screen.getByRole('link', { name: /^school admin$/i })).toHaveAttribute('href', '/admission/admin');
    expect(await screen.findByText(/no classes are open for admission yet/i)).toBeVisible();
  });

  it('shows a readable message, not an empty section, when the server is down', async () => {
    server.use(http.get(`${API}/classes`, () => HttpResponse.error()));

    renderApp({ route: '/' });

    expect(await screen.findByRole('alert')).toHaveTextContent(/server unreachable, please try again/i);
    expect(screen.getByRole('heading', { name: /choose a class and shift/i })).toBeVisible();
  });
});

describe('the parent quotes carousel', () => {
  it('can be moved by hand, with labelled arrows and one dot per position', async () => {
    // WHY: an auto-sliding carousel must still be usable by keyboard and screen readers.
    renderApp({ route: '/' });

    const carousel = screen.getByRole('region', { name: /families who joined last year/i });
    expect(within(carousel).getByRole('button', { name: /previous quotes/i })).toBeVisible();
    expect(within(carousel).getByRole('button', { name: /next quotes/i })).toBeVisible();
    expect(within(carousel).getAllByRole('figure')).toHaveLength(6);
    expect(within(carousel).getByRole('button', { name: /show quote 1/i })).toHaveAttribute('aria-current', 'true');
  });
});

describe('old links', () => {
  it('opens an application shared with the earlier address', async () => {
    server.use(http.get(`${API}/holds/h-9`, () => HttpResponse.error()));

    renderApp({ route: '/applications/h-9' });

    // Landed on the admission page's application view (its tabs are there).
    expect(await screen.findByRole('navigation', { name: /admission sections/i })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent(/server unreachable/i);
  });
});
