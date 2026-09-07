import PocketBase from 'pocketbase';

export async function getPocketBaseAdmin() {
  const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.janagencia.com.br';
  const pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);
  
  const email = process.env.POCKETBASE_ADMIN_EMAIL || 'ejanerik@gmail.com';
  const password = process.env.POCKETBASE_ADMIN_PASSWORD || 'JanFlow@2026!';

  try {
    // Tenta no formato v0.23 (_superusers)
    const authData = await pb.collection('_superusers').authWithPassword(email, password);
    console.log('[API/DB] Admin authed as _superusers successfully', !!pb.authStore.token);
  } catch (err1: any) {
    console.log('[API/DB] Admin auth as _superusers failed:', err1?.message);
    try {
      // Fallback formato antigo (admins)
      await pb.admins.authWithPassword(email, password);
      console.log('[API/DB] Admin authed as admins successfully');
    } catch (e: any) {
      console.error('[API/DB] Falha total ao autenticar admin no PocketBase:', e?.message);
    }
  }
  
  return pb;
}
