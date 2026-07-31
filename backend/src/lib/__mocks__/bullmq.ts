export const accountDeletionQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
};

export const reminderQueue = {
  add: jest.fn(),
  upsertJobScheduler: jest.fn(),
};

export const notificationQueue = {
  add: jest.fn(),
  upsertJobScheduler: jest.fn(),
};

export const emailQueue = {
  add: jest.fn(),
};

export const redisConnection = {};
