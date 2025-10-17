// ====================================
// DOM - Type Definitions
// ====================================

export type UserRole = 'admin' | 'semad' | 'secretaria' | 'publico';

export type MatterStatus = 
  | 'draft'           // Rascunho
  | 'submitted'       // Enviado para análise
  | 'under_review'    // Em análise pela SEMAD
  | 'approved'        // Aprovado
  | 'rejected'        // Rejeitado
  | 'published'       // Publicado
  | 'scheduled'       // Agendado para publicação
  | 'archived';       // Arquivado

export type SignatureType = 'eletronica' | 'digital' | 'none';

export type NotificationType = 
  | 'matter_submitted'
  | 'matter_approved'
  | 'matter_rejected'
  | 'matter_published'
  | 'comment_added'
  | 'deadline_alert';

export type HolidayType = 'nacional' | 'estadual' | 'municipal' | 'ponto_facultativo';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  cpf?: string;
  role: UserRole;
  secretaria_id?: number;
  active: number;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface Secretaria {
  id: number;
  name: string;
  acronym: string;
  email?: string;
  phone?: string;
  responsible?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  active: number;
  created_at: string;
}

export interface MatterType {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  active: number;
  order_position: number;
  created_at: string;
}

export interface Matter {
  id: number;
  title: string;
  content: string;
  summary?: string;
  matter_type: string;
  matter_type_id?: number;
  category_id?: number;
  secretaria_id: number;
  author_id: number;
  status: MatterStatus;
  version: number;
  parent_matter_id?: number;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  publication_date?: string;
  observations?: string;
  submitted_at?: string;
  submitted_by?: number;
  reviewed_at?: string;
  approved_at?: string;
  published_at?: string;
  scheduled_date?: string;
  reviewer_id?: number;
  review_notes?: string;
  rejection_reason?: string;
  canceled_at?: string;
  canceled_by?: number;
  cancelation_reason?: string;
  signature_hash?: string;
  signature_type?: SignatureType;
  signed_by?: number;
  signed_at?: string;
  server_timestamp?: string;
  edition_number?: string;
  page_number?: number;
  pdf_url?: string;
  pdf_hash?: string;
  layout_columns: number;
  created_at: string;
  updated_at: string;
}

export interface Edition {
  id: number;
  edition_number: string;
  edition_date: string;
  year: number;
  status: 'draft' | 'published' | 'archived';
  pdf_url?: string;
  pdf_hash?: string;
  total_pages?: number;
  published_at?: string;
  published_by?: number;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: number;
  name: string;
  date: string;
  type: HolidayType;
  recurring: number;
  year?: number;
  active: number;
  created_at: string;
  created_by?: number;
}

export interface Notification {
  id: number;
  user_id: number;
  matter_id?: number;
  type: NotificationType;
  title: string;
  message: string;
  read: number;
  sent_via_email: number;
  created_at: string;
  read_at?: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  entity_type: string;
  entity_id?: number;
  action: string;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Bindings para Cloudflare
export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
}

// Context type para Hono
export type HonoContext = {
  Bindings: Bindings;
  Variables: {
    user?: User;
  };
}
