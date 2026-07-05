/**
 * Finalidade: página placeholder para telas cujo backend ainda não existe (Assinatura,
 *   Painel super-admin). Mantém a navegação completa sem prometer integração inexistente.
 * Relações: usada nas rotas /assinatura e /super-admin (App.tsx).
 */
export function PlaceholderPage({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div>
      <h2>{titulo}</h2>
      <div className="card">
        <p className="muted">{descricao}</p>
      </div>
    </div>
  );
}
