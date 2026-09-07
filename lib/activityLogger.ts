import { getPocketBaseAdmin } from './pocketbaseAdmin';

export interface ActivityLogParams {
  userId: string;
  userEmail?: string;
  userName?: string;
  action: 'Criação' | 'Edição' | 'Exclusão';
  entity: 'Lançamentos' | 'Categorias' | 'Cartões' | 'Clientes' | 'Orçamentos' | 'Usuários';
  details: string;
  context?: 'empresa' | 'pessoal' | 'sistema';
}

export async function recordActivityLog(params: ActivityLogParams) {
  try {
    const pbAdmin = await getPocketBaseAdmin();
    
    let name = params.userName;
    let email = params.userEmail || '';

    if (!name && params.userId) {
      try {
        const user = await pbAdmin.collection('users').getOne(params.userId);
        if (user) {
          name = user.name || user.email?.split('@')[0];
          if (!email) email = user.email || '';
        }
      } catch (e) {
        // Ignorar se usuário não for encontrado
      }
    }

    await pbAdmin.collection('activity_logs').create({
      user_id: params.userId,
      user_name: name || email.split('@')[0] || 'Usuário',
      user_email: email,
      action: params.action,
      entity: params.entity,
      details: params.details,
      context: params.context || 'empresa'
    });
  } catch (error) {
    console.error('Failed to insert activity log:', error);
  }
}
