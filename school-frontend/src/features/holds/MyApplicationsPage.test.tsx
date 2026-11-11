import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { API, http, HttpResponse, makeHold, problem, server, STUDENT } from '../../test/server';

describe('my applications', () => {
  it('loads the remembered student applications when the page opens, active ones first', async () => {
    // WHY: this is what a parent sees after refreshing, or after closing and reopening
    // the browser. Only the student ID is remembered locally; the applications must
    // come back from the server, for that student.
    let askedFor: string | null = null;
    server.use(
      http.get(`${API}/me/holds`, ({ request }) => {
        askedFor = request.headers.get('X-Student-Id');
        // Newest first, as the server sends them; the live one is not at the top.
        return HttpResponse.json([
          makeHold({ holdId: 'h-3', className: 'Class 8 - Morning Shift', status: 'CANCELLED' }),
          makeHold({ holdId: 'h-2', className: 'Class 7 - Day Shift', status: 'HELD', expiresInSeconds: 300 }),
          makeHold({ holdId: 'h-1', className: 'Class 6 - Morning Shift', status: 'CONFIRMED' }),
        ]);
      }),
    );

    renderApp({ route: '/admission/applications', rememberedStudentId: STUDENT });

    const rows = await screen.findAllByTestId('application-row');
    expect(askedFor).toBe(STUDENT);
    expect(rows.map((row) => within(row).getByRole('heading').textContent)).toEqual([
      'Class 7 - Day Shift',
      'Class 8 - Morning Shift',
      'Class 6 - Morning Shift',
    ]);
    expect(rows.map((row) => within(row).getByTestId('hold-status').textContent)).toEqual([
      expect.stringContaining('HELD'),
      expect.stringContaining('CANCELLED'),
      expect.stringContaining('CONFIRMED'),
    ]);
    expect(within(rows[0]!).getByTestId('row-time-left')).toHaveTextContent(/^(05:00|04:5\d) left$/);
    expect(within(rows[0]!).getByRole('link', { name: /pay or cancel/i })).toHaveAttribute('href', '/admission/applications/h-2');
  });

  it('shows a hold whose time has already run out as EXPIRED, not as waiting for payment', async () => {
    server.use(
      http.get(`${API}/me/holds`, () =>
        // The server answered a moment ago with HELD and one second left.
        HttpResponse.json([makeHold({ status: 'HELD', expiresInSeconds: -1 })]),
      ),
    );

    renderApp({ route: '/admission/applications', rememberedStudentId: STUDENT });

    const row = await screen.findByTestId('application-row');
    expect(within(row).getByTestId('hold-status')).toHaveTextContent('EXPIRED');
    expect(within(row).queryByTestId('row-time-left')).not.toBeInTheDocument();
  });

  it('asks for the birth registration number when no student is known, and calls nothing', async () => {
    // onUnhandledRequest is "error", so any request here would fail the test.
    renderApp({ route: '/admission/applications' });

    expect(await screen.findByText(/above to see the child's applications/i)).toBeVisible();
  });

  it('says so when the student has no applications yet', async () => {
    server.use(http.get(`${API}/me/holds`, () => HttpResponse.json([])));

    renderApp({ route: '/admission/applications', rememberedStudentId: STUDENT });

    expect(await screen.findByText(/no applications yet/i)).toBeVisible();
    expect(screen.getByRole('link', { name: /class list/i })).toBeVisible();
  });

  it.each([
    ['the server is down', () => HttpResponse.error()],
    ['the server fails', () => problem(500, 'INTERNAL_ERROR')],
  ])('shows a readable message when %s', async (_, respond) => {
    server.use(http.get(`${API}/me/holds`, respond));

    renderApp({ route: '/admission/applications', rememberedStudentId: STUDENT });

    expect(await screen.findByRole('alert')).toHaveTextContent(/server unreachable, please try again/i);
  });
});
