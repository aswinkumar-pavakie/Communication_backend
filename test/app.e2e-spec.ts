process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.DIRECT_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-please-ignore';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-please-ignore';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/setup-app.js';
import { createPrismaMock, PrismaMock } from './utils/prisma-mock.js';

const ACTIVITY_ID = '11111111-1111-1111-1111-111111111111';

describe('Communication Assistant API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  let accessToken: string;

  const testUser = {
    id: 'user-1',
    email: 'newstudent@test.edu',
    role: 'STUDENT' as const,
    isActive: true,
    passwordHash: bcrypt.hashSync('Password123!', 10),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testStudentProfile = {
    id: 'profile-1',
    userId: testUser.id,
    firstName: 'Test',
    lastName: 'Student',
    phone: null,
    department: null,
    year: null,
    batch: null,
    profileImage: null,
    externalStudentId: null,
    currentStreak: 0,
    longestStreak: 0,
    lastStreakDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns application status without requiring auth', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });

  it('POST /api/v1/auth/register creates an account and returns a token pair', async () => {
    prisma.user.create.mockResolvedValueOnce(testUser);
    prisma.studentProfile.create.mockResolvedValueOnce(testStudentProfile);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testUser.email,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Student',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    accessToken = response.body.data.accessToken;

    // From here on, any lookup by this user's id or email should resolve consistently -
    // simulating that the account now exists in the database.
    prisma.user.findUnique.mockImplementation(
      async (args: { where?: { id?: string; email?: string } }) => {
        if (
          args?.where?.id === testUser.id ||
          args?.where?.email === testUser.email
        ) {
          return { ...testUser, studentProfile: testStudentProfile };
        }
        return null;
      },
    );
    prisma.studentProfile.findUnique.mockImplementation(
      async (args: { where?: { id?: string } }) =>
        args?.where?.id === testStudentProfile.id
          ? { ...testStudentProfile, user: { email: testUser.email } }
          : null,
    );
    // StreaksService reads/writes the student profile via findUniqueOrThrow - keep this
    // in sync with studentProfile.update so streak state persists across the test run.
    let currentProfile = { ...testStudentProfile };
    prisma.studentProfile.findUniqueOrThrow.mockImplementation(
      async () => currentProfile,
    );
    prisma.studentProfile.update.mockImplementation(
      async (args: { data?: Record<string, unknown> }) => {
        currentProfile = { ...currentProfile, ...args?.data };
        return currentProfile;
      },
    );
  });

  it('POST /api/v1/auth/register rejects a duplicate email with 409', async () => {
    // user.findUnique is already mocked (from the previous test) to find this email.
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testUser.email,
        password: 'Password123!',
        firstName: 'A',
        lastName: 'B',
      })
      .expect(409);
  });

  it('POST /api/v1/auth/login authenticates with the correct password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'Password123!' })
      .expect(200);

    expect(response.body.data.accessToken).toEqual(expect.any(String));
  });

  it('POST /api/v1/auth/login rejects an incorrect password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'WrongPassword!' })
      .expect(401);
  });

  it('GET /api/v1/auth/me is a protected endpoint - 401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('GET /api/v1/auth/me returns the profile for a valid token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data.email).toBe(testUser.email);
    expect(response.body.data.studentProfile.firstName).toBe('Test');
  });

  it('GET /api/v1/activities lists activities for an authenticated student', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/activities')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.meta).toEqual(
      expect.objectContaining({ page: 1, limit: 20, total: 0 }),
    );
  });

  it('POST /api/v1/activities/:id/attempts submits a response and returns an assessment', async () => {
    prisma.activity.findUnique.mockResolvedValueOnce({
      id: ACTIVITY_ID,
      title: 'Self Introduction',
      type: 'SPEAKING',
      instructions: 'Introduce yourself.',
      isActive: true,
      skill: { code: 'FLUENCY' },
    });
    prisma.activityAttempt.create.mockResolvedValueOnce({
      id: 'attempt-1',
      studentId: testStudentProfile.id,
      activityId: ACTIVITY_ID,
      status: 'STARTED',
    });
    prisma.activityAttempt.update.mockResolvedValueOnce({
      id: 'attempt-1',
      studentId: testStudentProfile.id,
      activityId: ACTIVITY_ID,
      status: 'COMPLETED',
      overallScore: 70,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/activities/${ACTIVITY_ID}/attempts`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        responseText:
          'Hello, my name is Test Student and I am a final-year CSE student.',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.attempt.status).toBe('COMPLETED');
  });

  it('GET /api/v1/dashboard returns the aggregated student dashboard', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data.student.email).toBe(testUser.email);
    expect(response.body.data).toHaveProperty('overallScore');
    expect(response.body.data).toHaveProperty('placementReadiness');
  });
});
