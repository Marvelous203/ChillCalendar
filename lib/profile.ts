import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AuthUser } from './auth';

const PROFILES_PATH = path.join(process.cwd(), 'data', 'profiles.json');

export async function readDevProfiles(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(PROFILES_PATH, 'utf8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function writeDevProfile(userId: string, displayName: string): Promise<void> {
  const map = await readDevProfiles();
  map[userId] = displayName;
  await fs.mkdir(path.dirname(PROFILES_PATH), { recursive: true });
  await fs.writeFile(PROFILES_PATH, JSON.stringify(map, null, 2), 'utf8');
}

export async function getUserDisplayName(user: AuthUser): Promise<string> {
  const profiles = await readDevProfiles();
  const raw =
    profiles[user.id]?.trim() ||
    user.displayName?.trim() ||
    user.email.split('@')[0]?.trim() ||
    'Bạn';
  return raw.slice(0, 40);
}
