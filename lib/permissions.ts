export const PERMISSION_KEYS = {
  ACCESS_ADMIN_PANEL: 'access_admin_panel',
  UPDATE_DATA: 'update_data',
  MODERATE_POSTS: 'moderate_posts',
  MODERATE_COMMENTS: 'moderate_comments',
  TEAM_MATCH_ORDER: 'team_match_order',
  VIEW_POST_STATS: 'view_post_stats',
  MANAGE_PROFILES: 'manage_profiles',
  FORCE_LOGOUT: 'force_logout',
  OVERLAY_PLACAR: 'overlay_placar',
  SCHEDULE_MATCHES: 'schedule_matches',
  SEND_NOTIFICATIONS: 'send_notifications',
  MANAGE_ADMINS: 'manage_admins',
  VIEW_STATUS: 'view_status',
  MANAGE_PICKS: 'manage_picks',
} as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
}

export const PERMISSIONS_LIST: PermissionDefinition[] = [
  {
    key: PERMISSION_KEYS.ACCESS_ADMIN_PANEL,
    label: 'Acesso ao Painel Admin',
    description:
      'Permite acessar a página de administração em /adminstracao. Necessário para que o link "Painel Admin" apareça no menu do usuário.',
  },
  {
    key: PERMISSION_KEYS.UPDATE_DATA,
    label: 'Atualizar Dados',
    description:
      'Permite usar o botão de atualização no navbar, que revalida páginas e reforma avatares/dados dos jogadores via API Faceit.',
  },
  {
    key: PERMISSION_KEYS.MODERATE_POSTS,
    label: 'Moderar Posts',
    description:
      'Permite aprovar, editar ou excluir qualquer postagem no feed da comunidade, inclusive de outros usuários.',
  },
  {
    key: PERMISSION_KEYS.MODERATE_COMMENTS,
    label: 'Moderar Comentários',
    description:
      'Permite excluir comentários inadequados em qualquer postagem do feed.',
  },
  {
    key: PERMISSION_KEYS.TEAM_MATCH_ORDER,
    label: 'Ordem de Partidas',
    description:
      'Permite definir e reordenar quais partidas aparecem em cada rodada na página de times.',
  },
  {
    key: PERMISSION_KEYS.VIEW_POST_STATS,
    label: 'Ver Estatísticas de Posts',
    description:
      'Permite visualizar o painel de estatísticas de engajamento (curtidas, comentários, etc.) nas postagens do feed.',
  },
  {
    key: PERMISSION_KEYS.MANAGE_PROFILES,
    label: 'Gerenciar Perfis',
    description:
      'Permite editar o perfil de qualquer jogador cadastrado na plataforma, incluindo jogadores de outras contas.',
  },
  {
    key: PERMISSION_KEYS.FORCE_LOGOUT,
    label: 'Deslogar Todos',
    description:
      'Permite forçar o logout de todos os usuários ao mesmo tempo através da opção no menu de conta.',
  },
  {
    key: PERMISSION_KEYS.OVERLAY_PLACAR,
    label: 'Overlay Placar',
    description:
      'Permite acessar e controlar o overlay de placar em /overlay/placar para uso em transmissões ao vivo.',
  },
  {
    key: PERMISSION_KEYS.SCHEDULE_MATCHES,
    label: 'Agendar Jogos',
    description:
      'Permite acessar /agendarjogo para criar, editar e remover partidas agendadas do campeonato.',
  },
  {
    key: PERMISSION_KEYS.SEND_NOTIFICATIONS,
    label: 'Enviar Notificações',
    description:
      'Permite enviar notificações push para todos ou para jogadores específicos cadastrados na plataforma.',
  },
  {
    key: PERMISSION_KEYS.MANAGE_ADMINS,
    label: 'Gerenciar Equipe e Permissões',
    description:
      'Permite definir níveis de acesso (Admin, Dev, etc.) e conceder ou revogar permissões de outros administradores.',
  },
  {
    key: PERMISSION_KEYS.VIEW_STATUS,
    label: 'Ver Status do Sistema',
    description:
      'Permite visualizar o painel de status e saúde dos serviços da plataforma (banco de dados, Faceit API, etc.).',
  },
  {
    key: PERMISSION_KEYS.MANAGE_PICKS,
    label: 'Gerenciar Pick\'Em (Redondo)',
    description:
      'Permite visualizar os picks de qualquer usuário no Pick\'Em, além de bloquear/desbloquear fases, sincronizar GUIDs e distribuir pontos Redondo.',
  },
];

export async function ensurePermissionsSchema(connection: any): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS admin_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      permission_key VARCHAR(100) NOT NULL,
      admin_level TINYINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_perm_level (permission_key, admin_level),
      KEY idx_admin_level (admin_level),
      KEY idx_permission_key (permission_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migrate legacy schema (permission_key + player_id) to level-based schema.
  const [adminLevelCol]: any = await connection.query(
    "SHOW COLUMNS FROM admin_permissions LIKE 'admin_level'"
  );
  if (!Array.isArray(adminLevelCol) || adminLevelCol.length === 0) {
    await connection.query('ALTER TABLE admin_permissions ADD COLUMN admin_level TINYINT NULL');

    const [playerIdCol]: any = await connection.query(
      "SHOW COLUMNS FROM admin_permissions LIKE 'player_id'"
    );
    if (Array.isArray(playerIdCol) && playerIdCol.length > 0) {
      await connection.query(`
        INSERT IGNORE INTO admin_permissions (permission_key, admin_level)
        SELECT DISTINCT ap.permission_key, p.admin
        FROM admin_permissions ap
        INNER JOIN players p ON p.id = ap.player_id
        WHERE p.admin BETWEEN 2 AND 5
      `);
    }

    await connection.query('DELETE FROM admin_permissions WHERE admin_level IS NULL');
    await connection.query('ALTER TABLE admin_permissions MODIFY COLUMN admin_level TINYINT NOT NULL');
  }

  const [indexes]: any = await connection.query('SHOW INDEX FROM admin_permissions');
  const indexNames = new Set((indexes as any[]).map((idx) => String(idx.Key_name)));

  if (!indexNames.has('uq_perm_level')) {
    await connection.query(
      'ALTER TABLE admin_permissions ADD UNIQUE KEY uq_perm_level (permission_key, admin_level)'
    );
  }
  if (!indexNames.has('idx_admin_level')) {
    await connection.query('ALTER TABLE admin_permissions ADD KEY idx_admin_level (admin_level)');
  }
  if (!indexNames.has('idx_permission_key')) {
    await connection.query('ALTER TABLE admin_permissions ADD KEY idx_permission_key (permission_key)');
  }
}

export async function hasPermission(
  connection: any,
  faceitGuid: string,
  permissionKey: PermissionKey
): Promise<boolean> {
  // Super-admin (level 1) always has every permission
  const [adminRows]: any = await connection.query(
    'SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1',
    [faceitGuid]
  );
  if (adminRows.length > 0 && Number(adminRows[0].admin) === 1) return true;

  if (!adminRows.length) return false;
  const level = Number(adminRows[0].admin);
  if (level < 2 || level > 5) return false;

  const [rows]: any = await connection.query(
    `SELECT id
     FROM admin_permissions
     WHERE permission_key = ? AND admin_level = ?
     LIMIT 1`,
    [permissionKey, level]
  );
  return rows.length > 0;
}

/**
 * Returns all permission keys available to the player identified by
 * `faceitGuid`. Admin level 1 gets every permission implicitly.
 */
export async function getPlayerPermissions(
  connection: any,
  faceitGuid: string
): Promise<string[]> {
  const [adminRows]: any = await connection.query(
    'SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1',
    [faceitGuid]
  );
  if (!adminRows.length) return [];
  const level = Number(adminRows[0].admin);
  // Super-admin (level 1) implicitly has every permission
  if (level === 1) return Object.values(PERMISSION_KEYS);
  if (level < 2 || level > 5) return [];

  const [rows]: any = await connection.query(
    'SELECT permission_key FROM admin_permissions WHERE admin_level = ?',
    [level]
  );
  return (rows as any[]).map((r) => r.permission_key);
}
