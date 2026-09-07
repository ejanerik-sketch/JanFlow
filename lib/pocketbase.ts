import PocketBase from 'pocketbase';

export const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.janagencia.com.br';

export const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);
