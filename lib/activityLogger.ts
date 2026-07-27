import { getSupabaseAdmin } from './supabaseAdmin';

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
    const supabaseAdmin = getSupabaseAdmin();
    
    let name = params.userName;
    let email = params.userEmail || '';

    // Se nome não foi fornecido, tenta buscar no perfil
    if (!name && params.userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('name, email')
        .eq('id', params.userId)
        .maybeSingle();

      if (profile) {
        name = profile.name || profile.email?.split('@')[0];
        if (!email) email = profile.email || '';
      }
    }

    await supabaseAdmin.from('activity_logs').insert([{
      user_id: params.userId,
      user_name: name || email.split('@')[0] || 'Usuário',
      user_email: email,
      action: params.action,
      entity: params.entity,
      details: params.details,
      context: params.context || 'empresa',
      created_at: new Date().toISOString()
    }]);
  } catch (error) {
    // Log de atividade é uma funcionalidade auxiliar, não deve quebrar a operação principal
    console.error('Failed to insert activity log:', error);
  }
}
