import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import megaphone from '../../assets/hero/megaphone.svg';
import wreath from '../../assets/hero/wreath-left.svg';
import joinPhoto from '../../assets/home/join-children.jpg';
import teacherFarzana from '../../assets/home/teacher-farzana.jpg';
import teacherMahmudul from '../../assets/home/teacher-mahmudul.jpg';
import teacherNasrin from '../../assets/home/teacher-nasrin.jpg';
import teacherTanvir from '../../assets/home/teacher-tanvir.jpg';
import whyClassroom from '../../assets/home/why-classroom.jpg';
import whyPractice from '../../assets/home/why-practice.jpg';
import whyReading from '../../assets/home/why-reading.jpg';
import whyTeachers from '../../assets/home/why-teachers.jpg';
import { SCHOOL } from '../../shared/brand';
import { LanguageSwitch, useT } from '../../shared/i18n/language';
import { ROUTES } from '../../shared/routes';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon, Logo } from '../../shared/ui/Icon';
import { Loading } from '../../shared/ui/States';
import { useClasses, type ClassSeats } from '../classes/api';
import { availability, splitClassName, toneFor } from '../classes/classInfo';
import { SeatBar, SeatLegend, SeatsAvailable, SeatStats } from '../classes/SeatBar';
import { useHoldDurationText } from '../settings/api';

/** The school's admission landing page. Seat counts on it are live. */
export function HomePage() {
  const t = useT();
  const holdFor = useHoldDurationText();

  return (
    <div className="home">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to={ROUTES.home} className="brand">
            <Logo />
            <span className="brand__lines">
              <span className="brand__name">{SCHOOL.name}</span>
              <span className="brand__sub" lang="bn">
                {SCHOOL.nameBn}
              </span>
            </span>
          </Link>
          <nav aria-label={t.home.mainNav} className="site-nav">
            <a href="#top" aria-current="page">
              {t.home.navHome}
            </a>
            <a href="#classes">{t.home.navClasses}</a>
            <a href="#why">{t.home.navWhy}</a>
            <a href="#teachers">{t.home.navTeachers}</a>
            <a href="#contact">{t.home.navContact}</a>
          </nav>
          <div className="site-header__actions">
            <LanguageSwitch />
            <Link to={ROUTES.admin} className="btn btn--square btn--outline site-header__secondary">
              {t.home.schoolAdmin}
            </Link>
            <Link to={ROUTES.admission} className="btn btn--square btn--primary">
              {t.home.applyNow}
            </Link>
          </div>
        </div>
      </header>

      <div className="notice-strip">
        <div className="container notice-strip__inner">
          <p className="notice-strip__text">
            <span className="notice-strip__label">
              <img src={megaphone} alt="" width={22} height={21} />
              {t.home.latestNotice}
            </span>
            <span>{t.home.topStrip(SCHOOL.admissionYear)}</span>
          </p>
          <a href="#classes" className="notice-strip__link">
            {t.home.noticeLink}
            <Icon name="arrowUpRight" size={16} strokeWidth={2.25} />
          </a>
        </div>
      </div>

      <main>
        <Hero holdFor={holdFor} />
        <TrustBar holdFor={holdFor} />
        <Join holdFor={holdFor} />
        <ClassesSection />
        <WhyUs />
        <Teachers />
        <Testimonials />
        <Faq holdFor={holdFor} />
        <Contact />
      </main>

      <Footer />
    </div>
  );
}

function Hero({ holdFor }: { holdFor: string }) {
  const t = useT();
  return (
    <section className="hero" id="top">
      <div className="container hero__inner">
        <div className="hero__copy">
          <p className="hero__eyebrow">
            <img src={wreath} alt="" width={22} height={48} className="hero__wreath" />
            {t.home.heroEyebrow(SCHOOL.admissionYear)}
            <img src={wreath} alt="" width={22} height={48} className="hero__wreath hero__wreath--mirror" />
          </p>
          <h1 className="hero__title">
            {t.home.heroTitleStart}
            {t.home.heroTitleAccent}
          </h1>
          <p className="hero__lead">{t.home.heroLead}</p>
          <div className="hero__actions">
            <Link to={ROUTES.admission} className="btn btn--square btn--light btn--hero">
              {t.home.start}
              <Icon name="arrowUpRight" size={22} strokeWidth={2.25} />
            </Link>
            <a href="#join" className="btn btn--square btn--outline-light btn--hero">
              {t.home.howWorks}
            </a>
          </div>
          <Glance holdFor={holdFor} />
        </div>
      </div>
    </section>
  );
}

/** Live numbers from the same class list the rest of the page shows. */
function Glance({ holdFor }: { holdFor: string }) {
  const t = useT();
  const classes = useClasses();
  const data = classes.data;
  const seatsOpen = data?.reduce((sum, cls) => sum + cls.availableSeats, 0);
  const show = (value: number | undefined) => (value === undefined ? '–' : t.num(value));

  return (
    <aside className="glance" aria-label={t.home.glanceTitle}>
      <dl className="glance__list">
        <div className="glance__item">
          <dt>{t.home.glanceSeats}</dt>
          <dd data-testid="glance-seats">{show(seatsOpen)}</dd>
        </div>
        <div className="glance__item">
          <dt>{t.home.glanceClasses}</dt>
          <dd>{show(data?.length)}</dd>
        </div>
        <div className="glance__item">
          <dt>{t.home.glanceHold}</dt>
          <dd>{holdFor}</dd>
        </div>
      </dl>
    </aside>
  );
}

/** A slow, endless strip of what parents can rely on. The second copy only fills the loop. */
function TrustBar({ holdFor }: { holdFor: string }) {
  const t = useT();
  const items = t.home.trust(holdFor);
  const row = (hidden: boolean) => (
    <ul className="trustbar__row" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li key={item} className="trustbar__item">
          <Icon name="star" size={16} strokeWidth={2} />
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <section className="trustbar" aria-label={t.home.trustTitle}>
      <div className="trustbar__track">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

function Join({ holdFor }: { holdFor: string }) {
  const t = useT();
  return (
    <section id="join" className="section">
      <div className="container split split--join">
        <figure className="join__photo">
          <img src={joinPhoto} alt={t.home.joinPhoto} width={1100} height={915} loading="lazy" />
        </figure>
        <div className="stack-md">
          <span className="eyebrow">{t.home.joinEyebrow}</span>
          <h2 className="section-title">{t.home.joinTitle}</h2>
          <p className="section-lead">{t.home.joinLead}</p>
          <ol className="join-steps">
            {t.home.steps(holdFor).map((step, index) => (
              <li key={index} className="join-steps__item">
                <span className="join-steps__number">{t.num(index + 1)}</span>
                <span>
                  <span className="join-steps__title">{step.title}</span>
                  <span className="join-steps__text">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div>
            <Link to={ROUTES.admission} className="btn btn--square btn--primary btn--hero">
              {t.home.applyNow}
              <Icon name="arrowUpRight" size={20} strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClassesSection() {
  const t = useT();
  const classes = useClasses();

  return (
    <section id="classes" className="section section--tinted">
      <div className="container stack-lg">
        <div className="section-head">
          <div className="section-head__copy">
            <span className="eyebrow">{t.home.classesEyebrow}</span>
            <h2 className="section-title">{t.home.classesTitle}</h2>
            <p className="section-lead">{t.home.classesLead}</p>
          </div>
          <SeatLegend />
        </div>

        {classes.isPending && <Loading label={t.common.loadingClasses} />}
        {classes.isError && !classes.data && (
          <ErrorMessage
            error={classes.error}
            action={
              <button type="button" className="btn btn--outline" onClick={() => classes.refetch()}>
                {t.common.tryAgain}
              </button>
            }
          />
        )}
        {classes.data && classes.data.length === 0 && (
          <div className="empty">
            <p className="empty__title">{t.home.classesEmpty}</p>
            <p className="empty__body">{t.home.classesEmptyBody}</p>
          </div>
        )}
        {classes.data && classes.data.length > 0 && (
          <ul className="class-grid class-grid--home">
            {classes.data.map((cls) => (
              <SnapshotCard key={cls.id} cls={cls} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** One class; the whole card opens the admission page, where the class is applied for. */
function SnapshotCard({ cls }: { cls: ClassSeats }) {
  const t = useT();
  const { title, shift, badge } = splitClassName(cls.name);
  const state = availability(cls);
  return (
    <li className="card class-card class-card--link" data-testid="class-card">
      <Link to={ROUTES.admission} className="class-card__link">
        <div className="class-card__head">
          <div className="class-card__titles class-card__titles--badge">
            <span className={`grade grade--${toneFor(badge)}`} aria-hidden="true">
              {badge}
            </span>
            <span lang="en">
              <h3 className="class-card__name">{title}</h3>
              {shift && <span className="class-card__sub">{shift}</span>}
            </span>
          </div>
          <span className={`pill pill--${state}`}>{t.seats[state]}</span>
        </div>
        <div className="class-card__seats">
          <SeatsAvailable cls={cls} />
          <SeatBar cls={cls} />
        </div>
        <SeatStats cls={cls} />
        <span className="class-card__cta">
          {t.home.classApply}
          <Icon name="arrowRight" size={16} strokeWidth={2.4} />
        </span>
      </Link>
    </li>
  );
}

function WhyUs() {
  const t = useT();
  const photos = [whyPractice, whyTeachers, whyReading, whyClassroom];
  return (
    <section id="why" className="section">
      <div className="container stack-lg">
        <div className="section-head__copy">
          <span className="eyebrow">{t.home.whyEyebrow}</span>
          <h2 className="section-title">{t.home.whyTitle}</h2>
          <p className="section-lead">{t.home.whyLead}</p>
        </div>
        <ul className="why-grid">
          {t.home.why.map((item, index) => (
            <li key={index} className="why-card">
              <img src={photos[index]} alt="" width={720} height={540} loading="lazy" className="why-card__photo" />
              <div className="why-card__body">
                <h3 className="why-card__title">{item.title}</h3>
                <p className="why-card__text">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Instructor cards: a portrait with a short profile, the profile above and below by turns. */
function Teachers() {
  const t = useT();
  const photos = [teacherNasrin, teacherMahmudul, teacherFarzana, teacherTanvir];
  return (
    <section id="teachers" className="section section--tinted">
      <div className="container stack-lg">
        <div className="section-head__copy section-head__copy--center">
          <span className="eyebrow">{t.home.teachersEyebrow}</span>
          <h2 className="section-title">{t.home.teachersTitle}</h2>
          <p className="section-lead">{t.home.teachersLead}</p>
        </div>
        <ul className="teacher-grid">
          {t.home.teachers.map((teacher, index) => (
            <li key={index} className="teacher">
              <img src={photos[index]} alt="" width={600} height={750} loading="lazy" className="teacher__photo" />
              <div className="teacher__info">
                <h3 className="teacher__name">{teacher.name}</h3>
                <span className="teacher__rule" aria-hidden="true" />
                <span className="teacher__role">{teacher.role}</span>
                <span className="teacher__meta">
                  <Icon name="clock" size={15} />
                  {teacher.years}
                </span>
                <p className="teacher__bio">{teacher.bio}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Parent quotes as a sliding carousel: as many cards as fit, arrows and dots to move,
 * and a slow auto-advance that stops while the visitor hovers, focuses or prefers less motion.
 */
function Testimonials() {
  const t = useT();
  const voices = t.home.voices;
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [stops, setStops] = useState(voices.length);
  const activeRef = useRef(0);
  const stopsRef = useRef(voices.length);
  const paused = useRef(false);

  // Width of one card plus the gap; 0 until the track is laid out (and always in tests).
  const stepWidth = () => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null | undefined;
    if (!track || !first) return 0;
    return first.offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0);
  };

  const measure = () => {
    const track = trackRef.current;
    const step = stepWidth();
    if (!track || !step) return;
    const perView = Math.max(1, Math.round(track.clientWidth / step));
    const nextStops = Math.max(1, voices.length - perView + 1);
    const nextActive = Math.min(nextStops - 1, Math.round(track.scrollLeft / step));
    stopsRef.current = nextStops;
    activeRef.current = nextActive;
    setStops(nextStops);
    setActive(nextActive);
  };

  const goTo = (index: number) => {
    const track = trackRef.current;
    const step = stepWidth();
    if (!track || !step) return;
    const count = stopsRef.current;
    const target = ((index % count) + count) % count; // wrap both ways
    track.scrollTo?.({ left: target * step, behavior: 'smooth' });
  };

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = calm
      ? undefined
      : window.setInterval(() => {
          if (!paused.current) goTo(activeRef.current + 1);
        }, 6000);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearInterval(timer);
    };
    // Set up once: the helpers read the latest position from refs, not from render state.
  }, []);

  const pause = (value: boolean) => () => {
    paused.current = value;
  };

  return (
    <section
      id="voices"
      className="section"
      aria-roledescription="carousel"
      aria-label={t.home.voicesTitle}
      onMouseEnter={pause(true)}
      onMouseLeave={pause(false)}
      onFocus={pause(true)}
      onBlur={pause(false)}
    >
      <div className="container stack-lg">
        <div className="section-head">
          <div className="section-head__copy">
            <span className="eyebrow">{t.home.voicesEyebrow}</span>
            <h2 className="section-title">{t.home.voicesTitle}</h2>
          </div>
          <div className="carousel-arrows">
            <button type="button" className="carousel-arrow" aria-label={t.home.voicesPrev} onClick={() => goTo(active - 1)}>
              <Icon name="arrowLeft" size={20} strokeWidth={2.25} />
            </button>
            <button type="button" className="carousel-arrow" aria-label={t.home.voicesNext} onClick={() => goTo(active + 1)}>
              <Icon name="arrowRight" size={20} strokeWidth={2.25} />
            </button>
          </div>
        </div>
        <ul className="voice-track" ref={trackRef} onScroll={measure}>
          {voices.map((voice, index) => (
            <li key={index} className="voice-track__item">
              <figure className="voice">
                <span className="voice__mark" aria-hidden="true">
                  “
                </span>
                <blockquote className="voice__quote">{voice.quote}</blockquote>
                <figcaption className="voice__by">
                  <span className="voice__name">{voice.name}</span>
                  <span className="voice__child">{voice.child}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
        {stops > 1 && (
          <div className="carousel-dots">
            {Array.from({ length: stops }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`carousel-dot${index === active ? ' carousel-dot--on' : ''}`}
                aria-label={t.home.voicesGoTo(index + 1)}
                aria-current={index === active || undefined}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Faq({ holdFor }: { holdFor: string }) {
  const t = useT();
  return (
    <section id="faq" className="section section--tinted">
      <div className="container split split--faq">
        <div className="stack-sm">
          <span className="eyebrow">{t.home.faqEyebrow}</span>
          <h2 className="section-title">{t.home.faqTitle}</h2>
        </div>
        <div className="faq">
          {t.home.faq(holdFor).map((item, index) => (
            <details key={index} className="faq__item" open={index === 0}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const t = useT();
  return (
    <section id="contact" className="section">
      <div className="container contact">
        <div className="contact__info stack-md">
          <span className="eyebrow">{t.home.contactEyebrow}</span>
          <h2 className="section-title">{t.home.contactTitle}</h2>
          <p className="section-lead">{t.home.contactLead}</p>
          <dl className="contact__list">
            <div className="contact__row">
              <Icon name="pin" size={22} />
              <dt>{t.home.contactAddress}</dt>
              <dd>{t.home.address}</dd>
            </div>
            <div className="contact__row">
              <Icon name="phone" size={22} />
              <dt>{t.home.contactPhone}</dt>
              <dd>
                <a href={`tel:${SCHOOL.phone.replace(/[^+\d]/g, '')}`} lang="en">
                  {SCHOOL.phone}
                </a>
              </dd>
            </div>
            <div className="contact__row">
              <Icon name="mail" size={22} />
              <dt>{t.home.contactEmail}</dt>
              <dd>
                <a href={`mailto:${SCHOOL.email}`} lang="en">
                  {SCHOOL.email}
                </a>
              </dd>
            </div>
            <div className="contact__row">
              <Icon name="clock" size={22} />
              <dt>{t.home.contactHours}</dt>
              <dd>{t.home.officeHours}</dd>
            </div>
          </dl>
        </div>
        <div className="contact__cta">
          <h2 className="cta__title">{t.home.ctaTitle}</h2>
          <p className="cta__text">{t.home.ctaText}</p>
          <Link to={ROUTES.admission} className="btn btn--square btn--dark btn--hero">
            {t.home.applyNow}
            <Icon name="arrowUpRight" size={20} strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const t = useT();
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__cols">
          <div className="footer__brand">
            <Logo size={40} />
            <span className="footer__name">{SCHOOL.name}</span>
          </div>
          <div className="footer__col">
            <span className="footer__heading">{t.home.footerAdmission}</span>
            <a href="#classes">{t.home.navClasses}</a>
            <a href="#join">{t.home.navHow}</a>
            <Link to={ROUTES.myApplications}>{t.home.footerMine}</Link>
          </div>
          <div className="footer__col">
            <span className="footer__heading">{t.home.schoolAdmin}</span>
            <Link to={ROUTES.admin}>{t.home.footerCreateClass}</Link>
            <a href="#faq">{t.home.navFaq}</a>
          </div>
        </div>
        <div className="footer__base">
          <span>{t.home.copyright(SCHOOL.admissionYear - 1, SCHOOL.name)}</span>
          <span>{t.home.tagline(SCHOOL.admissionYear)}</span>
        </div>
      </div>
    </footer>
  );
}
