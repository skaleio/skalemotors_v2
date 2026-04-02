import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/types/database';

export type Document = Database['public']['Tables']['documents']['Row'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];
export type DocumentType = 'contrato_venta' | 'contrato_consignacion';
export type DocumentStatus = 'borrador' | 'generado' | 'firmado' | 'anulado';

export interface DocumentFilters {
  branchId?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  limit?: number;
}

const generateDocumentNumber = async (
  type: DocumentType,
  branchId: string | null
): Promise<string> => {
  const prefix = type === 'contrato_venta' ? 'CV' : 'CC';
  const year = new Date().getFullYear();

  let query = supabase
    .from('documents')
    .select('document_number', { count: 'exact' })
    .eq('type', type)
    .not('document_number', 'is', null);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { count } = await query;
  const nextNumber = String((count ?? 0) + 1).padStart(4, '0');
  return `${prefix}-${year}-${nextNumber}`;
};

export const documentService = {
  async getAll(filters: DocumentFilters = {}): Promise<Document[]> {
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async create(
    input: Omit<DocumentInsert, 'document_number'> & { branch_id?: string | null }
  ): Promise<Document> {
    const document_number = await generateDocumentNumber(
      input.type,
      input.branch_id ?? null
    );

    const { data, error } = await supabase
      .from('documents')
      .insert({ ...input, document_number })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DocumentUpdate): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: DocumentStatus): Promise<Document> {
    return this.update(id, { status });
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
  },
};
