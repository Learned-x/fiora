import { prisma } from '../lib/prisma';
import { ricalcolaScadenzeClima } from './reminder.service';

export interface UpdateProfileInput {
  name?: string;
  clima?: string;
  mostraNomiScientifici?: boolean;
  orarioReminder?: string;
  onboardingDone?: boolean;
  pushToken?: string | null;
}

const profileSelect = {
  id: true,
  email: true,
  name: true,
  clima: true,
  onboardingDone: true,
  mostraNomiScientifici: true,
  orarioReminder: true,
  pushToken: true,
} as const;

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { clima: true } });
  if (!current) {
    throw { code: 'USER_NOT_FOUND', status: 404, message: 'Utente non trovato' };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.clima !== undefined && { clima: input.clima }),
      ...(input.mostraNomiScientifici !== undefined && { mostraNomiScientifici: input.mostraNomiScientifici }),
      ...(input.orarioReminder !== undefined && { orarioReminder: input.orarioReminder }),
      ...(input.onboardingDone !== undefined && { onboardingDone: input.onboardingDone }),
      ...(input.pushToken !== undefined && { pushToken: input.pushToken }),
    },
    select: profileSelect,
  });

  if (input.clima !== undefined && input.clima !== current.clima) {
    await ricalcolaScadenzeClima(userId, input.clima);
  }

  return updated;
}
