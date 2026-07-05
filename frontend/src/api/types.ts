/**
 * Finalidade: tipos das entidades retornadas pela API (espelham as projeções do backend).
 * Relações: usados pelas páginas ao consumir api/client.
 */
export interface Funcionario {
  id: string;
  nome: string;
  numeroTelefone: string;
  cpf: string | null;
  email: string | null;
  dataAdmissao: string | null;
  statusAlmoxarife: boolean;
  isRoot: boolean;
}

export interface Prestador {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  idFuncionario: string | null;
}

export type ToolStatus =
  | "disponivel"
  | "alugada"
  | "aguardando_orcamento"
  | "aguardando_liberacao"
  | "em_reparo"
  | "aguardando_devolucao"
  | "sucateada";

export interface Ferramenta {
  id: string;
  tipo: string;
  descricao: string | null;
  marca: string | null;
  status: ToolStatus;
}

export interface Emprestimo {
  id: string;
  idFerramenta: string;
  idDepositario: string;
  idFuncionarioEmprestador: string;
  dataSaida: string;
  dataRetorno: string | null;
}

export interface Orcamento {
  id: string;
  idFerramenta: string;
  idPrestador: string;
  tipoReparo: "interno" | "externo";
  descricaoServico: string | null;
  valorOrcamento: string;
  status: "pendente" | "liberado" | "recusado";
  canceledAt: string | null;
  dataCadastro: string;
}

export const STATUS_LABEL: Record<ToolStatus, string> = {
  disponivel: "Disponível",
  alugada: "Alugada",
  aguardando_orcamento: "Aguardando orçamento",
  aguardando_liberacao: "Aguardando liberação",
  em_reparo: "Em reparo",
  aguardando_devolucao: "Aguardando devolução",
  sucateada: "Sucateada",
};
