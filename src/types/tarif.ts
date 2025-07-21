interface Tarif {
  id_tarif: number;
  daya: number;
  tarif_perkwh: number;
}

interface CreateTarifRequest {
  daya: number;
  tarif_perkwh: number;
}

interface UpdateTarifRequest {
  daya?: number;
  tarif_perkwh?: number;
}

interface TarifResponse {
  success: boolean;
  message: string;
  data?: Tarif | Tarif[];
  error?: string;
}

export { Tarif, CreateTarifRequest, UpdateTarifRequest, TarifResponse };
