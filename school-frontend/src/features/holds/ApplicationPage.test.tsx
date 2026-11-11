import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { API, http, HttpResponse, makeHold, problem, server, STUDENT } from '../../test/server';
import type { HoldStatus } from './hold';

const payButton = () => screen.getByRole('button', { name: /pay admission fee|fee paid|paying/i });
const cancelButton = () => screen.getByRole('button', { name: /^cancel/i });
const status = () => screen.getByTestId('hold-status');

/** A fake server holding one application whose status the test can change. */
function serveHold(options: { status?: HoldStatus; expiresInSeconds?: number; serverAheadSeconds?: number } = {}) {
  const state = { status: options.status ?? ('HELD' as HoldStatus) };
  const expiresAt = Date.now() + (options.expiresInSeconds ?? 600) * 1000;
  server.use(
    http.get(`${API}/holds/h-1`, () => {
      // Like the real server: a HELD hold whose time has passed is reported as EXPIRED.
      const expired = state.status === 'HELD' && Date.now() >= expiresAt;
      return HttpResponse.json(
        makeHold({
          status: expired ? 'EXPIRED' : state.status,
          expiresInSeconds: (expiresAt - Date.now()) / 1000,
          serverAheadSeconds: options.serverAheadSeconds,
        }),
      );
    }),
    http.get(`${API}/me/holds`, () => HttpResponse.json([])),
  );
  return state;
}

describe('the application screen', () => {
  it('shows the status, the time left, and both buttons for a live hold', async () => {
    serveHold({ expiresInSeconds: 600 });

    renderApp({ route: '/admission/applications/h-1', rememberedStudentId: STUDENT });

    expect(await screen.findByRole('heading', { name: 'Class 6 - Morning Shift' })).toBeVisible();
    expect(status()).toHaveTextContent('HELD');
    expect(screen.getByTestId('time-left')).toHaveTextContent(/^(10:00|09:5\d)$/);
    expect(payButton()).toBeEnabled();
    expect(cancelButton()).toBeEnabled();
  });

  it('flips to EXPIRED and disables "Pay admission fee" when the countdown reaches zero, with no reload', async () => {
    // WHY: a parent watching the screen must see the hold die the moment it does, and
    // must not be offered a payment the server would refuse. Nothing reloads the page:
    // the clock ticks, and the status is derived from it.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    // Three seconds: shorter than the screen's 5-second poll, so when the status flips
    // below it can only be the countdown that did it, not a fresh answer from the server.
    serveHold({ expiresInSeconds: 3 });
    let requests = 0;
    server.events.on('request:start', () => {
      requests += 1;
    });
    renderApp({ route: '/admission/applications/h-1', rememberedStudentId: STUDENT });
    await screen.findByRole('heading', { name: 'Class 6 - Morning Shift' });
    expect(status()).toHaveTextContent('HELD');
    expect(payButton()).toBeEnabled();

    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(status()).toHaveTextContent('HELD');
    expect(screen.getByTestId('time-left')).toHaveTextContent('00:01');
    const requestsBeforeExpiry = requests;

    await act(() => vi.advanceTimersByTimeAsync(1_000));

    expect(status()).toHaveTextContent('EXPIRED');
    // At zero the screen asks the server once, so the server's own word replaces the derived one.
    await waitFor(() => expect(requests).toBeGreaterThan(requestsBeforeExpiry));
    expect(status()).toHaveTextContent('EXPIRED');
    expect(payButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
    expect(screen.queryByTestId('time-left')).not.toBeInTheDocument();
  });

  it('counts down to the server expiry even when this device clock is five minutes fast', async () => {
    serveHold({ expiresInSeconds: 600, serverAheadSeconds: -300 });

    renderApp({ route: '/admission/applications/h-1', rememberedStudentId: STUDENT });

    expect(await screen.findByTestId('time-left')).toHaveTextContent(/^(10:00|09:5\d)$/);
  });

  it('confirms the admission when the fee is paid, then offers no further actions', async () => {
    const state = serveHold();
    let confirmCalls = 0;
    server.use(
      http.post(`${API}/holds/h-1/confirm`, ({ request }) => {
        confirmCalls += 1;
        expect(request.headers.get('X-Student-Id')).toBe(STUDENT);
        state.status = 'CONFIRMED';
        return HttpResponse.json({ holdId: 'h-1', status: 'CONFIRMED' });
      }),
    );
    renderApp({ route: '/admission/applications/h-1', rememberedStudentId: STUDENT });
    await screen.findByRole('heading', { name: 'Class 6 - Morning Shift' });

    await userEvent.setup().click(payButton());

    await waitFor(() => expect(status()).toHaveTextContent('CONFIRMED'));
    expect(screen.getByText(/payment received/i)).toBeVisible();
    expect(payButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
    expect(confirmCalls).toBe(1);
  });

  it('says so when the server refuses the payment because the hold expired', async () => {
    // The device believed there was time left; the server is the one that decides.
    const state = serveHold();
    server.use(
      http.post(`${API}/holds/h-1/confirm`, () => {
        state.status = 'EXPIRED';
        return problem(409, 'HOLD_EXPIRED');
      }),
    );
    renderApp({ route: '/admission/applications/h-1', rememberedStudentId: STUDENT });
    await screen.findByRole('heading', { name: 'Class 6 - Morning Shift' });

    await userEvent.setup().click(payButton());

    expect(await screen.findByText(/this application has expired/i)).toBeVisible();
    await waitFor(() => expect(status()).toHaveTextContent('EXPIRED'));
    expect(payButton()).toBeDisabled();
  });

  it('cancels only after the user confirms, then shows CANCELLED', async () => {
    const state = serveHold();
    let deleteCalls = 0;
    server.use(
      http.delete(`${API}/holds/h-1`, () => {
        deleteCalls += 1;
        state.status = 'CANCELLED';
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/admission/applications/h-1', rememberedStudentId: STUDENT });
    await screen.findByRole('heading', { name: 'Class 6 - Morning Shift' });

    await user.click(cancelButton());
    expect(deleteCalls).toBe(0); // one click alone must not give up a seat
    await user.click(screen.getByRole('button', { name: /yes, cancel it/i }));

    await waitFor(() => expect(status()).toHaveTextContent('CANCELLED'));
    expect(deleteCalls).toBe(1);
    expect(payButton()).toBeDisabled();
    expect(screen.getByRole('link', { name: /class list/i })).toBeVisible();
  });

  it('tells a different student that the application is not theirs', async () => {
    serveHold();
    server.use(http.post(`${API}/holds/h-1/confirm`, () => problem(403, 'NOT_YOUR_HOLD')));
    renderApp({ route: '/admission/applications/h-1', rememberedStudentId: '99999999999999999' });
    await screen.findByRole('heading', { name: 'Class 6 - Morning Shift' });

    await userEvent.setup().click(payButton());

    expect(await screen.findByText(/belongs to another student/i)).toBeVisible();
    expect(status()).toHaveTextContent('HELD');
  });

  it('keeps Pay and Cancel disabled, with a hint, until a student ID is entered', async () => {
    serveHold();

    renderApp({ route: '/admission/applications/h-1' });
    await screen.findByRole('heading', { name: 'Class 6 - Morning Shift' });

    expect(payButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
    expect(screen.getByText(/birth registration number above to pay or cancel/i)).toBeVisible();
  });

  it.each([
    ['the application does not exist', () => problem(404, 'HOLD_NOT_FOUND'), /could not be found/i],
    ['the server is down', () => HttpResponse.error(), /server unreachable, please try again/i],
    ['the server fails', () => problem(500, 'INTERNAL_ERROR'), /server unreachable, please try again/i],
  ])('shows a readable message, not a blank page, when %s', async (_, respond, message) => {
    server.use(http.get(`${API}/holds/h-1`, respond));

    renderApp({ route: '/admission/applications/h-1', rememberedStudentId: STUDENT });

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible();
    expect(screen.getByRole('navigation', { name: /admission sections/i })).toBeVisible();
  });
});
