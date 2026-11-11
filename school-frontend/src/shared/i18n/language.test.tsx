import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { API, http, HttpResponse, makeClass, makeHold, problem, server, STUDENT } from '../../test/server';
import { STRINGS, toBanglaDigits } from './strings';

const BANGLA = /[ঀ-৿]/;

/** Every text the Bangla dictionary produces, with sample values for the functions. */
function allTexts(value: unknown, path: string, out: [string, string][]): [string, string][] {
  if (typeof value === 'string') {
    out.push([path, value]);
  } else if (typeof value === 'function') {
    const sample = (value as (...args: unknown[]) => unknown)(
      value.length >= 2 ? 'Class 6' : '10 মিনিট',
      12,
      3,
      40,
    );
    allTexts(sample, `${path}()`, out);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => allTexts(item, `${path}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      allTexts(item, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

describe('the Bangla dictionary', () => {
  it('has a Bangla translation for every piece of text, with nothing left in English', () => {
    // WHY: a string copied over from English and forgotten would show English in the
    // middle of a Bangla page. The type system only checks that the key exists.
    const bn = STRINGS.bn as unknown as Record<string, unknown>;
    const texts = allTexts({ ...bn, digits: () => bn.digits && toBanglaDigits('12'), num: () => toBanglaDigits('12') }, '', []);
    // Empty on purpose: in Bangla the link comes first in these two sentences.
    const intentionallyEmpty = new Set(['classes.noneBefore', 'mine.noneBefore']);

    const untranslated = texts.filter(([path, text]) => !intentionallyEmpty.has(path) && !BANGLA.test(text));

    expect(untranslated).toEqual([]);
  });

  it('writes numbers, times and durations with Bangla digits', () => {
    expect(STRINGS.bn.digits('09:42')).toBe('০৯:৪২');
    expect(STRINGS.bn.holdDuration(600)).toBe('১০ মিনিট');
    expect(STRINGS.bn.holdDuration(90)).toBe('১ মিনিট ৩০ সেকেন্ড');
    expect(STRINGS.bn.dateTime('2026-11-11T10:00:05Z')).toMatch(/৫/);
    expect(STRINGS.bn.dateTime('2026-11-11T14:00:05Z')).not.toMatch(/AM|PM/);
    expect(STRINGS.en.digits('09:42')).toBe('09:42');
  });
});

describe('switching language', () => {
  it('switches the whole page to Bangla, and back', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/curious young minds/i);

    await user.click(screen.getByRole('button', { name: 'বাংলা' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('একটু অন্যরকম স্কুল');
    expect(screen.getByRole('button', { name: 'বাংলা' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.lang).toBe('bn');
    expect(screen.queryByText(/curious young minds/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/curious young minds/i);
    expect(document.documentElement.lang).toBe('en');
  });

  it('remembers the choice after the page is reloaded', async () => {
    // WHY: a parent who reads Bangla should not have to switch again on every visit.
    const first = renderApp({ route: '/' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'বাংলা' }));
    first.unmount();

    renderApp({ route: '/' });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('একটু অন্যরকম স্কুল');
  });

  it('starts in English when nothing was chosen before', () => {
    renderApp({ route: '/' });

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('the admission page in Bangla', () => {
  beforeEach(() => {
    window.localStorage.setItem('school-admission.lang', 'bn');
  });

  it('shows seat counts in Bangla digits and keeps the class name as entered', async () => {
    server.use(
      http.get(`${API}/classes`, () => HttpResponse.json([makeClass({ availableSeats: 25, heldSeats: 15 })])),
      http.get(`${API}/me/holds`, () => HttpResponse.json([])),
    );

    renderApp({ route: '/admission', rememberedStudentId: STUDENT });

    const card = await screen.findByTestId('class-card');
    expect(within(card).getByRole('heading', { name: 'Class 6 - Morning Shift' })).toBeVisible();
    expect(within(card).getByTestId('available-seats')).toHaveTextContent('২৫');
    expect(within(card).getByTestId('held-seats')).toHaveTextContent('১৫');
    expect(within(card).getByRole('button', { name: 'আসনের জন্য আবেদন করুন' })).toBeEnabled();
    // The ID is shown as typed, in ASCII digits.
    expect(screen.getByTestId('current-student-id')).toHaveTextContent('2015 2691 2345 67890');
  });

  it('explains a refusal in Bangla', async () => {
    server.use(
      http.get(`${API}/classes`, () => HttpResponse.json([makeClass()])),
      http.get(`${API}/me/holds`, () => HttpResponse.json([])),
      http.post(`${API}/classes/c-1/holds`, () => problem(409, 'SEATS_FULL')),
    );
    renderApp({ route: '/admission', rememberedStudentId: STUDENT });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'আসনের জন্য আবেদন করুন' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('এই ক্লাসে আর কোনো আসন খালি নেই।');
  });

  it('counts down in Bangla digits and names the status in Bangla, keeping the API word', async () => {
    server.use(http.get(`${API}/holds/h-1`, () => HttpResponse.json(makeHold({ expiresInSeconds: 600 }))));

    renderApp({ route: '/admission/applications/h-1', rememberedStudentId: STUDENT });

    expect(await screen.findByTestId('time-left')).toHaveTextContent(/^(১০:০০|০৯:৫[০-৯])$/);
    const badge = screen.getByTestId('hold-status');
    expect(badge).toHaveTextContent('হোল্ডে আছে');
    expect(badge).toHaveTextContent('HELD');
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeEnabled();
  });

  it('turns a message shown before the switch into the new language', async () => {
    server.use(
      http.get(`${API}/classes`, () => HttpResponse.json([makeClass()])),
      http.get(`${API}/me/holds`, () => HttpResponse.json([])),
      http.post(`${API}/classes/c-1/holds`, () => HttpResponse.json({ ...makeHold(), studentId: STUDENT }, { status: 201 })),
      http.get(`${API}/holds/h-1`, () => HttpResponse.json(makeHold())),
    );
    const user = userEvent.setup();
    renderApp({ route: '/admission', rememberedStudentId: STUDENT });
    await user.click(await screen.findByRole('button', { name: 'আসনের জন্য আবেদন করুন' }));
    expect(await screen.findByRole('status')).toHaveTextContent('আপনার সন্তানের নামে হোল্ড করা হয়েছে');

    await user.click(screen.getByRole('button', { name: 'English' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/is now held for your child/i));
  });
});
