import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { API, http, HttpResponse, makeClass, makeHold, problem, server, STUDENT } from '../../test/server';

const card = (name: string) => screen.getByRole('heading', { name }).closest('li') as HTMLElement;
const applyButton = (name: string) => within(card(name)).getByRole('button', { name: /apply|seats full/i });

function serveMyHolds(holds: unknown[] = []) {
  server.use(http.get(`${API}/me/holds`, () => HttpResponse.json(holds)));
}

describe('the class list', () => {
  it('shows total, held, confirmed and available seats for every class', async () => {
    server.use(
      http.get(`${API}/classes`, () =>
        HttpResponse.json([
          makeClass(),
          makeClass({ id: 'c-2', name: 'Class 6 - Day Shift', totalSeats: 60, heldSeats: 0, confirmedSeats: 60, availableSeats: 0 }),
        ]),
      ),
    );

    renderApp({ route: '/admission' });

    const morning = within(await waitFor(() => card('Class 6 - Morning Shift')));
    expect(morning.getByTestId('total-seats')).toHaveTextContent('120');
    expect(morning.getByTestId('held-seats')).toHaveTextContent('15');
    expect(morning.getByTestId('confirmed-seats')).toHaveTextContent('80');
    expect(morning.getByTestId('available-seats')).toHaveTextContent('25');
    const day = within(card('Class 6 - Day Shift'));
    expect(day.getByTestId('available-seats')).toHaveTextContent('0');
    expect(day.getByText('Full')).toBeVisible();
  });

  it('refreshes the seat counts on its own every few seconds, with no reload', async () => {
    // WHY: seats go fast when admission opens; a parent must not act on stale numbers.
    let available = 25;
    server.use(http.get(`${API}/classes`, () => HttpResponse.json([makeClass({ availableSeats: available })])));
    renderApp({ route: '/admission' });
    await waitFor(() => expect(within(card('Class 6 - Morning Shift')).getByTestId('available-seats')).toHaveTextContent('25'));

    available = 7; // someone else took seats; nothing is clicked or reloaded here

    await waitFor(
      () => expect(within(card('Class 6 - Morning Shift')).getByTestId('available-seats')).toHaveTextContent('7'),
      { timeout: 6_000 },
    );
  }, 10_000);

  it('does not let anyone apply before a student ID is entered', async () => {
    server.use(http.get(`${API}/classes`, () => HttpResponse.json([makeClass()])));

    renderApp({ route: '/admission' });

    await waitFor(() => expect(applyButton('Class 6 - Morning Shift')).toBeDisabled());
    expect(screen.getAllByText(/birth registration number above/i).length).toBeGreaterThan(0);
  });

  it('applies for the student and opens the new application', async () => {
    serveMyHolds();
    let sentStudentId: string | null = null;
    server.use(
      http.get(`${API}/classes`, () => HttpResponse.json([makeClass()])),
      http.post(`${API}/classes/c-1/holds`, ({ request }) => {
        sentStudentId = request.headers.get('X-Student-Id');
        return HttpResponse.json({ ...makeHold({ holdId: 'h-new' }), studentId: STUDENT }, { status: 201 });
      }),
      http.get(`${API}/holds/h-new`, () => HttpResponse.json(makeHold({ holdId: 'h-new' }))),
    );
    renderApp({ route: '/admission', rememberedStudentId: STUDENT });
    await waitFor(() => expect(applyButton('Class 6 - Morning Shift')).toBeEnabled());

    await userEvent.setup().click(applyButton('Class 6 - Morning Shift'));

    expect(await screen.findByRole('button', { name: /pay admission fee/i })).toBeVisible();
    expect(screen.getByTestId('hold-status')).toHaveTextContent('HELD');
    expect(sentStudentId).toBe(STUDENT);
  });

  it.each([
    ['the last seat was just taken', 'SEATS_FULL', /no seats are left in this class/i],
    ['the student already applied', 'ACTIVE_HOLD_EXISTS', /already has an application in this class/i],
  ])('explains it next to the class when %s, and stays usable', async (_, code, message) => {
    serveMyHolds();
    server.use(
      http.get(`${API}/classes`, () => HttpResponse.json([makeClass(), makeClass({ id: 'c-2', name: 'Class 7 - Day Shift' })])),
      http.post(`${API}/classes/c-1/holds`, () => problem(409, code)),
    );
    renderApp({ route: '/admission', rememberedStudentId: STUDENT });
    await waitFor(() => expect(applyButton('Class 6 - Morning Shift')).toBeEnabled());

    await userEvent.setup().click(applyButton('Class 6 - Morning Shift'));

    expect(await within(card('Class 6 - Morning Shift')).findByRole('alert')).toHaveTextContent(message);
    expect(within(card('Class 7 - Day Shift')).queryByRole('alert')).not.toBeInTheDocument();
    expect(applyButton('Class 7 - Day Shift')).toBeEnabled();
  });

  it('offers "View my application" instead of Apply for a class the student already applied to', async () => {
    serveMyHolds([makeHold({ holdId: 'h-7', classId: 'c-1' })]);
    server.use(http.get(`${API}/classes`, () => HttpResponse.json([makeClass()])));

    renderApp({ route: '/admission', rememberedStudentId: STUDENT });

    const link = await screen.findByRole('link', { name: /view my application/i });
    expect(link).toHaveAttribute('href', '/admission/applications/h-7');
    expect(within(card('Class 6 - Morning Shift')).queryByRole('button', { name: /apply/i })).not.toBeInTheDocument();
  });

  it('says there are no classes yet, rather than showing an empty page', async () => {
    server.use(http.get(`${API}/classes`, () => HttpResponse.json([])));

    renderApp({ route: '/admission' });

    expect(await screen.findByText(/no classes have been opened yet/i)).toBeVisible();
  });

  it('shows a readable message with a retry when the server is down', async () => {
    let down = true;
    server.use(http.get(`${API}/classes`, () => (down ? HttpResponse.error() : HttpResponse.json([makeClass()]))));
    renderApp({ route: '/admission' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/server unreachable, please try again/i);

    down = false;
    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { name: 'Class 6 - Morning Shift' })).toBeVisible();
    expect(screen.queryByText(/server unreachable/i)).not.toBeInTheDocument();
  });

  it('keeps the last known counts on screen, with a warning, when a refresh fails', async () => {
    // WHY: if the backend drops mid-session the page must not go blank or lose its data.
    let down = false;
    server.use(http.get(`${API}/classes`, () => (down ? HttpResponse.error() : HttpResponse.json([makeClass()]))));
    renderApp({ route: '/admission' });
    await screen.findByRole('heading', { name: 'Class 6 - Morning Shift' });

    down = true;

    expect(await screen.findByText(/showing the last known information/i, undefined, { timeout: 6_000 })).toBeVisible();
    expect(within(card('Class 6 - Morning Shift')).getByTestId('available-seats')).toHaveTextContent('25');
  }, 10_000);
});

describe('apply errors on a class card', () => {
  it('does not show one student the error that belonged to another', async () => {
    // WHY: the box at the top can switch student at any time. "This student already has
    // an application" must not stay on screen for a student it is not true of.
    server.use(
      http.get(`${API}/me/holds`, () => HttpResponse.json([])),
      http.get(`${API}/classes`, () => HttpResponse.json([makeClass()])),
      http.post(`${API}/classes/c-1/holds`, () => problem(409, 'ACTIVE_HOLD_EXISTS')),
    );
    const user = userEvent.setup();
    renderApp({ route: '/admission', rememberedStudentId: STUDENT });
    await waitFor(() => expect(applyButton('Class 6 - Morning Shift')).toBeEnabled());
    await user.click(applyButton('Class 6 - Morning Shift'));
    await within(card('Class 6 - Morning Shift')).findByRole('alert');

    await user.click(screen.getByRole('button', { name: /change/i }));
    await user.type(screen.getByLabelText(/birth registration no/i), '30000000000000001');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(applyButton('Class 6 - Morning Shift')).toBeEnabled());
    expect(within(card('Class 6 - Morning Shift')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears "no seats left" once a seat is free again', async () => {
    let available = 1;
    server.use(
      http.get(`${API}/me/holds`, () => HttpResponse.json([])),
      http.get(`${API}/classes`, () => HttpResponse.json([makeClass({ availableSeats: available })])),
      http.post(`${API}/classes/c-1/holds`, () => {
        available = 0; // someone else took the last seat a moment earlier
        return problem(409, 'SEATS_FULL');
      }),
    );
    renderApp({ route: '/admission', rememberedStudentId: STUDENT });
    await waitFor(() => expect(applyButton('Class 6 - Morning Shift')).toBeEnabled());
    await userEvent.setup().click(applyButton('Class 6 - Morning Shift'));
    expect(await within(card('Class 6 - Morning Shift')).findByRole('alert')).toHaveTextContent(/no seats are left/i);
    await waitFor(() => expect(applyButton('Class 6 - Morning Shift')).toBeDisabled());

    available = 1; // a hold expired; the next poll shows a free seat

    await waitFor(() => expect(applyButton('Class 6 - Morning Shift')).toBeEnabled(), { timeout: 6_000 });
    expect(within(card('Class 6 - Morning Shift')).queryByRole('alert')).not.toBeInTheDocument();
  }, 10_000);
});
