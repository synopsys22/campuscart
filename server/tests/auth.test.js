import { describe, expect, it } from 'vitest';
import { api, makeAdmin, makeUser, shippingAddress, useDatabase } from './support/helpers.js';

useDatabase();

const newStudent = {
  name: 'Asha Rao',
  email: 'Asha@Example.com',
  password: 'Student@123',
  college: 'NIT Trichy',
  branch: 'CSE',
  semester: 3,
};

describe('registration and login', () => {
  it('registers a student and never returns the password', async () => {
    const res = await api().post('/api/auth/register').send(newStudent);
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.email).toBe('asha@example.com');
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('ignores an attempt to self-register as admin', async () => {
    const res = await api().post('/api/auth/register').send({ ...newStudent, role: 'admin' });
    expect(res.body.data.user.role).toBe('student');
  });

  it('rejects a duplicate email', async () => {
    await api().post('/api/auth/register').send(newStudent).expect(201);
    const res = await api().post('/api/auth/register').send(newStudent);
    expect(res.status).toBe(409);
  });

  it('returns field errors for invalid input', async () => {
    const res = await api().post('/api/auth/register').send({ name: '', email: 'nope', password: '1' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('logs in with the right password', async () => {
    await api().post('/api/auth/register').send(newStudent);
    const res = await api().post('/api/auth/login').send({ email: newStudent.email, password: newStudent.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it('rejects a wrong password with a generic message', async () => {
    await api().post('/api/auth/register').send(newStudent);
    const res = await api().post('/api/auth/login').send({ email: newStudent.email, password: 'wrong-pass' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/incorrect email or password/i);
  });

  it('blocks a deactivated user from logging in and from using an old token', async () => {
    await api().post('/api/auth/register').send(newStudent);
    const { bearer, user } = await makeUser({ isActive: true });
    user.isActive = false;
    await user.save();
    const me = await api().get('/api/auth/me').set('Authorization', bearer);
    expect(me.status).toBe(403);
  });
});

describe('protected routes', () => {
  it('requires a token', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a bad token', async () => {
    const res = await api().get('/api/auth/me').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  it('returns the current user', async () => {
    const { bearer, user } = await makeUser();
    const res = await api().get('/api/auth/me').set('Authorization', bearer);
    expect(res.body.data.email).toBe(user.email);
  });

  it('confirms logout', async () => {
    const res = await api().post('/api/auth/logout');
    expect(res.status).toBe(200);
  });
});

describe('profile', () => {
  it('updates profile fields but not role', async () => {
    const { bearer } = await makeUser();
    const res = await api()
      .patch('/api/users/me')
      .set('Authorization', bearer)
      .send({ name: 'New Name', semester: 5, branch: 'CSE', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
    expect(res.body.data.semester).toBe(5);
    expect(res.body.data.role).toBe('student');
  });

  it('changes the password only with the correct current password', async () => {
    const { bearer, user } = await makeUser();
    const wrong = await api()
      .patch('/api/users/me/password')
      .set('Authorization', bearer)
      .send({ currentPassword: 'nope-nope', newPassword: 'Another@123' });
    expect(wrong.status).toBe(400);

    const right = await api()
      .patch('/api/users/me/password')
      .set('Authorization', bearer)
      .send({ currentPassword: 'Password@1', newPassword: 'Another@123' });
    expect(right.status).toBe(200);

    const login = await api().post('/api/auth/login').send({ email: user.email, password: 'Another@123' });
    expect(login.status).toBe(200);
  });

  it('manages addresses and keeps exactly one default', async () => {
    const { bearer } = await makeUser();
    const first = await api().post('/api/users/me/addresses').set('Authorization', bearer).send(shippingAddress);
    expect(first.status).toBe(201);
    expect(first.body.data[0].isDefault).toBe(true);

    const second = await api()
      .post('/api/users/me/addresses')
      .set('Authorization', bearer)
      .send({ ...shippingAddress, label: 'Home', isDefault: true });
    expect(second.body.data.filter((a) => a.isDefault)).toHaveLength(1);
    expect(second.body.data.find((a) => a.isDefault).label).toBe('Home');

    const defaultId = second.body.data.find((a) => a.isDefault)._id;
    const afterDelete = await api().delete(`/api/users/me/addresses/${defaultId}`).set('Authorization', bearer);
    expect(afterDelete.body.data).toHaveLength(1);
    expect(afterDelete.body.data[0].isDefault).toBe(true);
  });

  it('rejects an invalid pincode', async () => {
    const { bearer } = await makeUser();
    const res = await api()
      .post('/api/users/me/addresses')
      .set('Authorization', bearer)
      .send({ ...shippingAddress, pincode: '12' });
    expect(res.status).toBe(400);
    expect(res.body.errors.pincode).toBeTruthy();
  });
});

describe('admin user management', () => {
  it('blocks students from admin routes', async () => {
    const { bearer } = await makeUser();
    const res = await api().get('/api/users').set('Authorization', bearer);
    expect(res.status).toBe(403);
  });

  it('lists and searches users', async () => {
    const { bearer } = await makeAdmin();
    await makeUser({ name: 'Findable Person' });
    await makeUser({ name: 'Someone Else' });
    const res = await api().get('/api/users?search=findable').set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('lets an admin change role and active state', async () => {
    const { bearer } = await makeAdmin();
    const { user } = await makeUser();
    const res = await api()
      .patch(`/api/users/${user._id}`)
      .set('Authorization', bearer)
      .send({ role: 'admin', isActive: false });
    expect(res.body.data.role).toBe('admin');
    expect(res.body.data.isActive).toBe(false);
  });

  it('stops an admin from demoting or deactivating themselves', async () => {
    const { bearer, user } = await makeAdmin();
    const demote = await api().patch(`/api/users/${user._id}`).set('Authorization', bearer).send({ role: 'student' });
    expect(demote.status).toBe(400);
    const deactivate = await api().patch(`/api/users/${user._id}`).set('Authorization', bearer).send({ isActive: false });
    expect(deactivate.status).toBe(400);
  });
});
