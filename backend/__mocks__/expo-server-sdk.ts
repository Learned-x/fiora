// Mock manuale di expo-server-sdk per i test (attivato con jest.mock('expo-server-sdk')).
// I metodi d'istanza sono jest.fn condivisi: i test li raggiungono con `new Expo()`.
const chunkPushNotifications = jest.fn((messages: unknown[]) => [messages]);
const sendPushNotificationsAsync = jest.fn(async () => [] as unknown[]);

export class Expo {
  static isExpoPushToken = jest.fn((token: string) => token.startsWith('ExponentPushToken'));
  chunkPushNotifications = chunkPushNotifications;
  sendPushNotificationsAsync = sendPushNotificationsAsync;
}

export type ExpoPushMessage = {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: string;
  priority?: string;
};

export default Expo;
