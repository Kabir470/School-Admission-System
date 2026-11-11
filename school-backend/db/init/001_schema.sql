-- School Admission System schema.
-- Single source of truth (ADR 0003): PostgreSQL runs this file once, on first start
-- with an empty data volume. EF Core never creates or changes the schema.

CREATE TABLE classes (
    id          uuid         PRIMARY KEY,
    name        varchar(100) NOT NULL,
    total_seats integer      NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_classes_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT ck_classes_total_seats    CHECK (total_seats BETWEEN 1 AND 10000)
);

-- "Class 6 - Morning Shift" and "class 6 - morning shift" are the same class.
CREATE UNIQUE INDEX ux_classes_name_ci ON classes (lower(name));

CREATE TABLE holds (
    id           uuid        PRIMARY KEY,
    class_id     uuid        NOT NULL REFERENCES classes (id),
    student_id   varchar(17) NOT NULL,
    status       varchar(10) NOT NULL,
    created_at   timestamptz NOT NULL,
    expires_at   timestamptz NOT NULL,
    confirmed_at timestamptz,
    cancelled_at timestamptz,
    expired_at   timestamptz,
    CONSTRAINT ck_holds_status     CHECK (status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT ck_holds_student_id CHECK (student_id ~ '^[0-9]{17}$'),
    CONSTRAINT ck_holds_expiry     CHECK (expires_at > created_at)
);

-- One active application per student per class (ADR 0001). EXPIRED and CANCELLED
-- rows are outside the index, so the student may apply again afterwards.
CREATE UNIQUE INDEX ux_holds_active_per_student
    ON holds (class_id, student_id)
 WHERE status IN ('HELD', 'CONFIRMED');

-- Seat counts: holds of a class by status.
CREATE INDEX ix_holds_class_status ON holds (class_id, status);

-- GET /me/holds: a student's holds, newest first.
CREATE INDEX ix_holds_student_created ON holds (student_id, created_at DESC);

-- The sweeper: HELD rows in expiry order.
CREATE INDEX ix_holds_due ON holds (expires_at) WHERE status = 'HELD';
