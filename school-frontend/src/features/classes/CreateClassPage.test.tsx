import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { API, http, HttpResponse, problem, server } from '../../test/server';

async function fillAndSubmit(name: string, seats: string) {
  const user = userEvent.setup();
  if (name) {
    await user.type(screen.getByLabelText(/class name/i), name);
  }
  if (seats) {
    await user.type(screen.getByLabelText(/number of seats/i), seats);
  }
  await user.click(screen.getByRole('button', { name: /create class/i }));
}

describe('create class (school admin)', () => {
  it('creates the class and confirms it in words', async () => {
    let received: unknown;
    server.use(
      http.post(`${API}/classes`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: 'c-9', name: 'Class 6 - Morning Shift', totalSeats: 120 }, { status: 201 });
      }),
    );
    renderApp({ route: '/admission/admin' });

    await fillAndSubmit('  Class 6 - Morning Shift ', '120');

    expect(await screen.findByText(/created "Class 6 - Morning Shift" with 120 seats/i)).toBeVisible();
    expect(received).toEqual({ name: 'Class 6 - Morning Shift', totalSeats: 120 });
    expect(screen.getByLabelText(/class name/i)).toHaveValue('');
  });

  it.each([
    ['no name', '', '50', /enter a class name/i],
    ['no seat count', 'Class 6', '', /enter the number of seats/i],
    ['zero seats', 'Class 6', '0', /between 1 and 10,000/i],
    ['too many seats', 'Class 6', '10001', /between 1 and 10,000/i],
    ['a seat count that is not a whole number', 'Class 6', '12.5', /whole number/i],
    ['a name longer than 100 characters', 'x'.repeat(101), '50', /at most 100 characters/i],
  ])('rejects %s before calling the server', async (_, name, seats, message) => {
    // onUnhandledRequest is "error": a request here would fail the test.
    renderApp({ route: '/admission/admin' });

    await fillAndSubmit(name, seats);

    expect(await screen.findByText(message)).toBeVisible();
  });

  it('explains a taken name and keeps what was typed so it can be corrected', async () => {
    server.use(http.post(`${API}/classes`, () => problem(409, 'CLASS_NAME_TAKEN')));
    renderApp({ route: '/admission/admin' });

    await fillAndSubmit('Class 6 - Morning Shift', '120');

    expect(await screen.findByRole('alert')).toHaveTextContent(/a class with this name already exists/i);
    expect(screen.getByLabelText(/class name/i)).toHaveValue('Class 6 - Morning Shift');
    expect(screen.getByLabelText(/number of seats/i)).toHaveValue('120');
  });

  it('shows the server reason when the server rejects the input', async () => {
    server.use(http.post(`${API}/classes`, () => problem(400, 'VALIDATION_FAILED', 'name is required.')));
    renderApp({ route: '/admission/admin' });

    await fillAndSubmit('Class 6', '10');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/please check what you entered/i);
    expect(alert).toHaveTextContent('name is required.');
  });

  it('shows a readable message when the server is down', async () => {
    server.use(http.post(`${API}/classes`, () => HttpResponse.error()));
    renderApp({ route: '/admission/admin' });

    await fillAndSubmit('Class 6', '10');

    expect(await screen.findByRole('alert')).toHaveTextContent(/server unreachable, please try again/i);
  });
});
