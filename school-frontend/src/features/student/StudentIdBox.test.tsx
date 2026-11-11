import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STUDENT } from '../../test/server';
import { StudentProvider } from './StudentContext';
import { StudentIdBox } from './StudentIdBox';

const KEY = 'school-admission.studentId';

function renderBox() {
  return render(
    <StudentProvider>
      <StudentIdBox />
    </StudentProvider>,
  );
}

const input = () => screen.getByLabelText(/birth registration no/i);

async function submit(value: string) {
  const user = userEvent.setup();
  await user.clear(input());
  if (value !== '') {
    await user.type(input(), value);
  }
  await user.click(screen.getByRole('button', { name: /continue/i }));
}

describe('the student-ID box', () => {
  it.each([
    ['nothing', ''],
    ['16 digits', '2015269123456789'],
    ['18 digits', '201526912345678901'],
    ['16 digits and a letter', '2015269123456789a'],
    ['Bangla digits', '২০১৫২৬৯১২৩৪৫৬৭৮৯০'],
  ])('rejects %s and says why', async (_, value) => {
    // WHY: the server only accepts exactly 17 ASCII digits. Catching it here means the
    // parent is told at the box, not by a failed request later.
    renderBox();

    await submit(value);

    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.queryByTestId('current-student-id')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('never shortens a number that is too long into a valid-looking one', async () => {
    // WHY: an 18-digit typo cut down to 17 digits would be a real but WRONG student,
    // and every application would be filed under someone else's number.
    renderBox();

    await userEvent.setup().type(input(), '201526912345678901');

    expect(input()).toHaveValue('201526912345678901');
  });

  it('accepts exactly 17 digits, shows them as the current student, and remembers them', async () => {
    renderBox();

    await submit(STUDENT);

    expect(screen.getByTestId('current-student-id')).toHaveTextContent('2015 2691 2345 67890');
    expect(window.localStorage.getItem(KEY)).toBe(STUDENT);
  });

  it('accepts the number pasted with spaces, as it is often written', async () => {
    renderBox();

    await submit('2015 2691 2345 67890');

    expect(window.localStorage.getItem(KEY)).toBe(STUDENT);
  });

  it('brings the student back after the page is reloaded', async () => {
    // WHY: after a refresh, or closing and reopening the browser, the student must still
    // be known, because that is what lets their applications be loaded again.
    const first = renderBox();
    await submit(STUDENT);
    first.unmount(); // the page goes away…

    renderBox(); // …and is opened again

    expect(screen.getByTestId('current-student-id')).toHaveAttribute('title', STUDENT);
  });

  it('forgets the student when "Change" is pressed', async () => {
    window.localStorage.setItem(KEY, STUDENT);
    renderBox();

    await userEvent.setup().click(screen.getByRole('button', { name: /change/i }));

    expect(input()).toHaveValue('');
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('ignores a remembered value that is not a valid student ID', () => {
    window.localStorage.setItem(KEY, 'not-a-student');

    renderBox();

    expect(screen.queryByTestId('current-student-id')).not.toBeInTheDocument();
    expect(input()).toBeVisible();
  });

  it('still works for this visit when the browser refuses to store anything', async () => {
    // Private windows and locked-down browsers can throw on any localStorage call.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access is denied.', 'SecurityError');
    });
    renderBox();

    await submit(STUDENT);

    expect(screen.getByTestId('current-student-id')).toHaveAttribute('title', STUDENT);
  });
});
