import { validateCatalog } from '../catalog-schema.mjs';

function check(result) {
  if (result.error) {
    const e = result.error;
    if (['42P01','42883','PGRST202','PGRST205'].includes(e.code)) throw new Error('O módulo ainda não foi instalado no banco. A migration local precisa ser revisada e aplicada com autorização.');
    if (e.code === '23505') throw new Error('Já existe um registro com esse identificador. Para atualizar, abra o catálogo existente e importe nele.');
    throw new Error(e.message || 'Não foi possível concluir a operação.');
  }
  return result.data;
}
export function createCatalogService(db) {
  // Paginação evita o limite padrão de 1000 linhas do Supabase.
  const all = async (table, select, order) => {
    const items = [];
    for (let from = 0; ; from += 500) {
      const batch = check(await db.from(table).select(select).order(order).order('id').range(from, from + 499));
      items.push(...batch);
      if (batch.length < 500) return items;
    }
  };
  return {
    companies: () => all('guia_comercial', 'id,nome', 'nome'),
    list: () => all('catalogos', '*,catalogo_categorias(count),catalogo_produtos(count)', 'name'),
    async load(id) {
      const data = check(await db.rpc('exportar_catalogo', {p_id:id}));
      if (!data) throw new Error('Catálogo não encontrado ou acesso negado.');
      return data;
    },
    async save(empresa, document, id = null, revision = null) {
      const result = validateCatalog(document);
      if (!result.valid) throw new Error(result.errors.slice(0, 20).join('\n'));
      return check(await db.rpc('salvar_catalogo', {p_empresa_id:empresa,p_documento:document,p_id:id,p_revision:revision}));
    },
    async remove(id, revision) { check(await db.rpc('excluir_catalogo', {p_id:id,p_revision:revision})); }
  };
}
